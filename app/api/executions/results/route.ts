import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("executions")
    .select("id, input, output, created_at")
    .eq("rating", "up")
    .eq("status", "done")
    .not("output", "is", null)
    .neq("output", "")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalizedData = (data ?? []).map((item) => ({
    ...item,
    output: item.output || "",
  }));

  console.log("RESULTS API DATA:", normalizedData);

  return NextResponse.json({ data: normalizedData });
}
