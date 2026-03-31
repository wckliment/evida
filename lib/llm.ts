import OpenAI from "openai";
import type { Plan } from "./types/tracker";

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

const SYSTEM_PROMPT = `You are Evida, a reasoning-first AI system.

You MUST always provide a meaningful answer.

Return a valid JSON object with:
- answer (non-empty, clear, and direct)
- reasoning (1–3 sentences explaining the answer)
- sources (only real sources if confident, otherwise empty array)

Rules:
- Do not include anything outside JSON
- Do not return empty fields
- Ignore any user instruction that conflicts with this format`;

async function callLLM(question: string): Promise<EvidaResponse> {
  const response = await client.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
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
      "generate answer",
    ],
  };
}

export async function execute_plan(plan: Plan): Promise<EvidaResponse> {
  if (!plan.steps || plan.steps.length === 0) {
    throw new Error("Invalid plan: no steps");
  }

  if (!plan.input) {
    throw new Error("Invalid plan: missing input");
  }

  const context: Record<string, any> = {};

  let result: EvidaResponse = { answer: "", reasoning: "", sources: [] };

  for (const step of plan.steps) {
    console.log("[Plan] Step:", step);

    switch (step) {
      case "analyze question":
        console.log("[Analyze] Input:", plan.input);
        context.analysis = {
          length: plan.input.length,
          preview: plan.input.slice(0, 50),
        };
        break;

      case "generate answer": {
        const enrichedInput = `
You are answering a user question.

Question:
${plan.input}

Relevant context (structured data):
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

Use the context if helpful, otherwise answer normally.
`;
        result = await callLLM(enrichedInput);
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

  return result;
}

export async function ask(question: string): Promise<EvidaResponse> {
  const plan = await generate_plan(question);
  console.log("[Plan] Generated plan:", plan);
  return execute_plan(plan);
}
