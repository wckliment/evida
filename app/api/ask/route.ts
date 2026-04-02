import { execute_plan, generate_plan} from "@/lib/llm";
import { getSupabaseClient } from "@/lib/supabase";
import { runExecution } from "@/lib/execution";
import { ExecutionTracker } from "@/lib/execution-tracker";


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
    const replayContext = body?.context?.replay === true ? body.context.priorExecution : null;
    console.log("[API] received question =", question);

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
          const supabase = getSupabaseClient();
          
          let executionId: string | undefined;
          const tracker = new ExecutionTracker();

          try {
            tracker.step("ingest");
            executionId = await runExecution(question);
            tracker.end();
            console.log("[API] execution started:", executionId);
            console.log("[API] question:", question);

            if (
              process.env.NODE_ENV === "development" &&
              question.includes("__ERROR_TEST__")
            ) {
              throw new Error("Intentional test error");
            }

            if (executionId) {
              controller.enqueue(encoder.encode(`[EXEC_ID] ${executionId}\n`));
            }
            controller.enqueue(encoder.encode("[STEP] ingest\n"));
            await delay(25);
            controller.enqueue(encoder.encode("[STEP] analyze\n"));

            controller.enqueue(encoder.encode("[STEP] generate\n"));

            tracker.step("generate");
            const canReuse =
              replayContext &&
              Array.isArray(replayContext.steps) &&
              replayContext.steps.length > 0 &&
              replayContext.input &&
              question === replayContext.input?.trim();

            let plan;
            if (canReuse && replayContext.plan) {
              console.log("[Replay] Using stored plan");
              plan = replayContext.plan;
            } else if (canReuse) {
              console.log("[Replay] Fallback to reconstructed plan");
              plan = {
                input: replayContext.input,
                steps: replayContext.steps.map((s: any) => s.step),
              };
            } else {
              if (replayContext) console.log("[Replay] Generating new plan");
              plan = await generate_plan(question);
            }
            console.log("[Plan Used]:", plan.steps);
            const { answer } = await execute_plan(plan, !!canReuse);
            tracker.end();

            console.log("[API] answer length:", answer?.length);
            console.log("[API] answer preview:", answer?.slice(0, 80));

            const fullText = answer || "";
            const tokens = fullText.match(/\S+\s*/g) || [];

            tracker.step("stream");
            for (const token of tokens) {
              controller.enqueue(encoder.encode(token));
              await delay(25);
            }
            tracker.end();

            // FIRST: persist to DB
            if (executionId) {
              try {
                console.log("[API] writing done to DB:", executionId, "output length:", fullText.length);
                const trace = tracker.flush();
                const { data: doneData, error: doneError, count: doneCount } = await supabase
                  .from("executions")
                  .update({ status: "done", output: fullText, steps: trace.steps, total_duration_ms: trace.totalDurationMs })
                  .eq("id", executionId)
                  .select();
                console.log("[API] done update result:", {
                  executionId,
                  doneError,
                  doneCount,
                  doneData,
                });
                if (doneError) {
                  console.error("[API] done update error:", doneError);
                }
              } catch (dbErr) {
                console.error("[API] DB write failed:", dbErr);
              }
            }

            // THEN: close
            try { controller.close(); } catch {}
          } catch (err) {
            const message = err instanceof Error ? err.message : "Internal error";
            console.log("[API] error occurred:", message);
            console.log("[API] marking error:", executionId);

            // FIRST: persist to DB
            if (executionId) {
              try {
                console.log("[API] writing error to DB:", executionId);
                const trace = tracker.flush(message);
                const { data: errorData, error: errorWriteError, count: errorCount } = await supabase
                  .from("executions")
                  .update({ status: "error", error: message, steps: trace.steps, total_duration_ms: trace.totalDurationMs })
                  .eq("id", executionId)
                  .select();
                console.log("[API] error update result:", {
                  executionId,
                  errorWriteError,
                  errorCount,
                  errorData,
                });
                if (errorWriteError) {
                  console.error("[API] error update error:", errorWriteError);
                }
              } catch (dbErr) {
                console.error("[API] DB write failed:", dbErr);
              }
            }

            // THEN: send stream message
            try {
              controller.enqueue(encoder.encode(`[ERROR] ${message}\n`));
            } catch (e) {
              console.warn("[API] enqueue failed:", e);
            }

            // THEN: close
            try { controller.close(); } catch {}
          }
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