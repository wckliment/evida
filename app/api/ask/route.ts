import { ask } from "@/lib/llm";

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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

        controller.enqueue(encoder.encode("[STEP] ingest\n"));
        await delay(25);

        controller.enqueue(encoder.encode("[STEP] analyze\n"));

        const { answer } = await ask(question);

        controller.enqueue(encoder.encode("[STEP] generate\n"));

        const fullText = answer || "";
        const words = fullText.split(" ");

        for (let i = 0; i < words.length; i++) {
          const chunk = i === 0 ? words[i] : " " + words[i];
          controller.enqueue(encoder.encode(chunk));
          await delay(25);
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("API error:", err);

    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}