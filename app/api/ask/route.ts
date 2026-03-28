import { ask } from "@/lib/llm";
import { supabase } from "@/lib/supabase";

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

        const { data: execution } = await supabase
          .from("executions")
          .insert({ input: question, status: "ingest" })
          .select("id")
          .single();
        const executionId = execution?.id;

        controller.enqueue(encoder.encode("[STEP] ingest\n"));
        await delay(25);

        await supabase
          .from("executions")
          .update({ status: "analyze" })
          .eq("id", executionId);

        controller.enqueue(encoder.encode("[STEP] analyze\n"));

        const { answer } = await ask(question);

        await supabase
          .from("executions")
          .update({ status: "generate" })
          .eq("id", executionId);

        controller.enqueue(encoder.encode("[STEP] generate\n"));

        const fullText = answer || "";
        const tokens = fullText.match(/\S+\s*/g) || [];

        for (const token of tokens) {
          controller.enqueue(encoder.encode(token));
          await delay(25);
        }

        await supabase
          .from("executions")
          .update({ status: "done", output: fullText })
          .eq("id", executionId);

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