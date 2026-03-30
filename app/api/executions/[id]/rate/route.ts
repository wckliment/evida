import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
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

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
