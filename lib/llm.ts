import OpenAI from "openai";

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

export async function ask(question: string): Promise<EvidaResponse> {
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
