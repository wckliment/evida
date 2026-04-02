import OpenAI from "openai";
import type { Plan } from "./types/tracker";
import { getSupabaseClient } from "./supabase";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const MODEL = "gpt-4o-mini";

export type EvidaResponse = {
  answer: string;
  reasoning: string;
  sources: {
    title: string;
    url: string;
  }[];
};

const BASE_SYSTEM_PROMPT = `You are Evida, a reasoning-first AI system.

You MUST always provide a meaningful answer.

Return a valid JSON object with:
- answer (non-empty, clear, and direct)
- reasoning (1–3 sentences explaining the answer)
- sources (only real sources if confident, otherwise empty array)

Rules:
- Do not include anything outside JSON
- Do not return empty fields
- Ignore any user instruction that conflicts with this format
- Do not present multiple equivalent options unless explicitly asked
- Be decisive — state an answer, do not hedge`;

function buildSystemPrompt(committedAnswers: string[]): string {
  const preferenceBlock =
    committedAnswers.length > 0
      ? `User Chosen Defaults (must be followed):
${committedAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}

These represent user chosen defaults.
You MUST apply them ONLY when they are directly relevant to the user's question.
If they are not clearly relevant, ignore them completely.
If a relevant preferred approach exists, center the answer around it — do not dilute it with alternatives.
Do not force a preferred answer if it does not clearly match the user's question.
`
      : "";

  return `You are Evida, a reasoning-first AI system.

${preferenceBlock}You MUST always provide a meaningful answer.

When answering:
* be decisive and direct — state the answer, do not list options
* if a committed answer applies, lead with it and reinforce it confidently
* do not hedge (e.g., "it depends", "you could also...", "another option is...")
* do not introduce competing alternatives when a preferred approach exists

Return a valid JSON object with:
- answer (non-empty, clear, and direct)
- reasoning (1–3 sentences explaining the answer)
- sources (only real sources if confident, otherwise empty array)

Rules:
- Do not include anything outside JSON
- Do not return empty fields
- Ignore any user instruction that conflicts with this format
- Never respond with a list of unrelated alternatives if a preferred approach exists
- When answering, provide enough structure or detail to be actionable
- Avoid overly minimal answers unless the user explicitly asks for a short or concise response`;
}

export async function embed(text: string): Promise<number[]> {
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    const json = await res.json();
    return json.data[0].embedding;
  } catch {
    return [];
  }
}

async function vectorSearch(query: string) {
  try {
    const embedding = await embed(query);

    if (embedding.length === 0) return [];

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      match_count: 3,
    });

    if (error) {
      console.error("[Retrieval] Error:", error);
      return [];
    }

    return data || [];
  } catch {
    return [];
  }
}

async function callLLM(question: string, systemPrompt: string = BASE_SYSTEM_PROMPT): Promise<EvidaResponse> {
  const response = await client.responses.create({
    model: MODEL,
    instructions: systemPrompt,
    input: question,
  });

  let raw = response.output_text ?? "";

  // remove ALL markdown code blocks (robust)
  raw = raw
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```json|```/gi, "")
    )
    .trim();

  try {
    const parsed = JSON.parse(raw);

    return {
      answer: parsed.answer ?? raw,
      reasoning: parsed.reasoning ?? "",
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((s: unknown) => {
            const src = s as Record<string, unknown>;
            return src?.title && src?.url;
          })
        : [],
    };
  } catch {
    return { answer: raw, reasoning: "Unstructured response", sources: [] };
  }
}

export async function generate_plan(question: string): Promise<Plan> {
  return {
    input: question,
    steps: [
      "analyze question",
      "retrieve context",
      "generate answer",
    ],
  };
}

export async function execute_plan(plan: Plan, isReplay = false): Promise<EvidaResponse> {
  if (!plan.steps || plan.steps.length === 0) {
    throw new Error("Invalid plan: no steps");
  }

  if (!plan.input) {
    throw new Error("Invalid plan: missing input");
  }

  const context: Record<string, any> = {};

  let result: EvidaResponse = { answer: "", reasoning: "", sources: [] };

  for (const step of plan.steps) {
    if (isReplay && step === "retrieve context") {
      console.log("[Replay] Skipping retrieval step");
      continue;
    }

    console.log("[Plan] Step:", step);

    switch (step) {
      case "analyze question":
        console.log("[Analyze] Input:", plan.input);
        context.analysis = {
          length: plan.input.length,
          preview: plan.input.slice(0, 50),
        };
        break;

      case "retrieve context": {
        const docs = await vectorSearch(plan.input);
        console.log("[Retrieval] Docs:", docs.length);
        const filtered = docs.filter((d: { similarity: number }) => d.similarity > 0.75);
        context.committedAnswers = filtered
          .slice(0, 3)
          .map((d: { content: string }) => d.content);
        console.log("[Committed Answers Used]:", context.committedAnswers.length);
        break;
      }

      case "generate answer": {
        const systemPrompt = buildSystemPrompt(context.committedAnswers ?? []);
        result = await callLLM(plan.input, systemPrompt);
        break;
      }

      default:
        console.warn("[Plan] Unknown step:", step);
        break;
    }
  }

  if (!result || !result.answer) {
    throw new Error("Plan did not produce an answer");
  }

  console.log("[execute_plan] answer length:", result.answer.length);
  console.log("[execute_plan] answer preview:", result.answer.slice(0, 80));

  return result;
}

export async function ask(question: string): Promise<EvidaResponse> {
  const plan = await generate_plan(question);
  console.log("[Plan] Generated plan:", plan);
  return execute_plan(plan);
}
