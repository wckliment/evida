import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const MODEL = "gpt-4o-mini";

export async function ask(question: string): Promise<string> {
  const response = await client.responses.create({
    model: MODEL,
    input: question,
  });

  return response.output_text ?? "";
}