import { getSupabaseClient } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseClient();
    const { rating } = await req.json();

    if (!["up", "down"].includes(rating)) {
      return Response.json({ error: "Invalid rating" }, { status: 400 });
    }

    const { id } = await context.params;

    const { error } = await supabase
      .from("executions")
      .update({ rating })
      .eq("id", id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (rating === "up") {
      try {
        const { data: execution } = await supabase
          .from("executions")
          .select("input, output")
          .eq("id", id)
          .single();

        if (execution && execution.output) {
          const content = `
Question:
${execution.input}

Answer:
${execution.output}
`;

          const { embed } = await import("@/lib/llm");
          const embedding = await embed(content);

          if (embedding && embedding.length > 0) {
            await supabase.from("documents").insert({ content, embedding });
            console.log("[Learning] Stored execution:", id);
          }
        }
      } catch (err) {
        console.error("[Learning] Failed:", err);
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
