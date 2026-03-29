"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import InputBar from "../../components/InputBar";
import OutputPanel from "../../components/OutputPanel";
import ExecutionTrace from "../../components/ExecutionTrace";

type ExecStep = "idle" | "ingest" | "analyze" | "generate" | "done" | "error";
type ExecMode = "idle" | "live" | "replay";

// Deterministic replay timing constants
const REPLAY_INGEST_MS = 500;
const REPLAY_ANALYZE_MS = 700;
const REPLAY_PRE_GENERATE_MS = 300;
const REPLAY_CHARS_PER_TICK = 6;
const REPLAY_TICK_MS = 25;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function RunPage() {
  const [question, setQuestion] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [exec, setExec] = useState<{ step: ExecStep; mode: ExecMode; input?: string; output?: string; error?: string | null }>({
    step: "idle",
    mode: "idle",
  });
  const replayCancelRef = useRef<{ cancelled: boolean } | null>(null);
  const searchParams = useSearchParams();

  // If navigated here with ?executionId=..., fetch and replay that execution
  useEffect(() => {
    const executionId = searchParams.get("executionId");
    if (!executionId) return;

    async function fetchExecutionUntilFinalized(id: string) {
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`/api/executions/${id}`);
        const item = await res.json();

        console.log("[RUN] poll attempt:", i, item.status);

        if (item.status === "done" || item.status === "error") {
          return item;
        }

        await new Promise(r => setTimeout(r, 150));
      }

      return null;
    }

    (async () => {
      const item = await fetchExecutionUntilFinalized(executionId);

      if (!item) {
        console.warn("[RUN] execution never finalized");
        return;
      }

      console.log("[RUN] executionId:", executionId);
      console.log("[RUN] fetched item:", item);
      console.log("[RUN] item.status:", item?.status);
      console.log("[RUN] item.error:", item?.error);
      console.log("[RUN] item.output:", item?.output);

      replayExecution(item);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Derived helpers used throughout
  // "done" and "error" are terminal display states — execution is no longer running
  console.log("[UI] exec.mode =", exec.mode);
  const loading = exec.mode !== "idle" && exec.step !== "done" && exec.step !== "error";
  const step = exec.step;

  async function replayExecution(item: any) {
    // Don't interrupt an active live execution (done is terminal, replay over it is fine)
    if (exec.mode === "live" && exec.step !== "done") return;

    // Cancel any replay already in progress
    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    replayCancelRef.current = token;

    console.log("[Replay] setting input:", item.input);
    setQuestion(item.input);
    setStreamedAnswer("");
    setExec({ step: "ingest", mode: "replay", input: item.input, error: null });

    try {
      await delay(REPLAY_INGEST_MS);
      if (token.cancelled) return;

      await delay(REPLAY_ANALYZE_MS);
      if (token.cancelled) return;
      setExec((prev) => ({ ...prev, step: "analyze", mode: "replay" }));

      if (item.status === "error") {
        await delay(REPLAY_ANALYZE_MS);
        if (token.cancelled) return;
        setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: item.error || "Execution failed" }));
        setStreamedAnswer("");
        return;
      }

      await delay(REPLAY_PRE_GENERATE_MS);
      if (token.cancelled) return;
      setExec((prev) => ({ ...prev, step: "generate", mode: "replay" }));

      const output = item.output || "";
      let revealed = 0;
      while (revealed < output.length) {
        await delay(REPLAY_TICK_MS);
        if (token.cancelled) return;
        revealed = Math.min(revealed + REPLAY_CHARS_PER_TICK, output.length);
        setStreamedAnswer(output.slice(0, revealed));
      }

      setExec((prev) => ({ ...prev, step: "done", mode: "idle" }));
    } catch {
      if (!token.cancelled) {
        setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: "Replay failed" }));
      }
    } finally {
      // Only clear the ref if this token is still the active one
      if (replayCancelRef.current === token) {
        replayCancelRef.current = null;
      }
    }
  }

  function handleRetry() {
    console.log("[Retry] exec.input:", exec.input);
    if (!exec.input) return;

    // cancel any replay
    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
      replayCancelRef.current = null;
    }

    // reset execution state
    setExec({
      step: "idle",
      mode: "idle",
      error: null,
    });

    // clear output
    setStreamedAnswer("");

    handleSubmit(null, exec.input);
  }

  async function handleSubmit(e?: React.FormEvent | null, overrideInput?: string) {
    e?.preventDefault();
    const inputToUse = overrideInput ?? question;
    console.log("[Submit] overrideInput =", overrideInput);
    console.log("[Submit] question (state) =", question);
    console.log("[Submit] inputToUse =", inputToUse);
    if (!inputToUse.trim()) return;

    // Cancel any replay in progress before starting a live execution
    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
      replayCancelRef.current = null;
    }

    setStreamedAnswer("");
    setExec({ mode: "live", step: "ingest", input: inputToUse, output: "", error: null });

    try {
      console.log("[Submit] sending to API =", inputToUse);
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: inputToUse }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer) {
            fullText += buffer;
            setStreamedAnswer(fullText);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Extract complete newline-terminated lines ([STEP] markers)
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.startsWith("[STEP] ")) {
            setExec((prev) => ({ ...prev, step: line.slice(7).trim() as ExecStep }));
          } else if (line.startsWith("[ERROR] ")) {
            const errMsg = line.slice(8).trim();
            setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: errMsg }));
          }
        }

        // Remaining buffer is answer text (no newline yet) — flush immediately
        if (buffer && !buffer.startsWith("[STEP]") && !buffer.startsWith("[ERROR]")) {
          fullText += buffer;
          setStreamedAnswer(fullText);
          buffer = "";
        }
      }

      setExec((prev) => prev.step === "error" ? prev : { ...prev, step: "done", mode: "idle" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: message }));
    }
  }

  return (
    <div className="flex-1 flex flex-col px-8 h-full">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1">
        <InputBar
          question={question}
          onQuestionChange={setQuestion}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <OutputPanel
          streamedAnswer={streamedAnswer}
          loading={loading}
          error={exec.error}
          execInput={exec.input}
          execMode={exec.mode}
          question={question}
          step={step}
          onRetry={handleRetry}
        />
        <ExecutionTrace step={step} loading={loading} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <RunPage />
    </Suspense>
  );
}
