import { supabase } from "./supabase";

/**
 * Lifecycle manager for a single execution.
 * Handles DB state transitions from ingest → analyze → generate
 * and returns the executionId for the caller to continue with.
 *
 * PASS 1: DB lifecycle only — streaming stays in the route.
 */
export async function runExecution(input: string): Promise<string> {
  let executionId: string | null = null;

  try {
    const { data, error } = await supabase
      .from("executions")
      .insert({ input, status: "ingest" })
      .select("id")
      .single();

    if (error || !data) throw new Error("Failed to create execution record");
    executionId = data.id as string;

    // Placeholder for future RAG context retrieval
    const context = null; // eslint-disable-line @typescript-eslint/no-unused-vars

    await supabase
      .from("executions")
      .update({ status: "analyze" })
      .eq("id", executionId);

    await supabase
      .from("executions")
      .update({ status: "generate" })
      .eq("id", executionId);

    return executionId;
  } catch (err) {
    if (executionId) {
      await supabase
        .from("executions")
        .update({ status: "error" })
        .eq("id", executionId);
    }
    throw err;
  }
}
