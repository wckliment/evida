import { ask, MODEL } from "@/lib/llm";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const question = body?.question?.trim();

    if (!question) {
      return Response.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const { answer, reasoning, sources } = await ask(question);

    return Response.json({
      answer,
      reasoning,
      sources,
      model: MODEL,
    });
  } catch (err) {
    console.error("API error:", err);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}