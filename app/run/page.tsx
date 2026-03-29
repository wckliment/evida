"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EvidaLogo from "../../components/EvidaLogo";

type ExecStep = "idle" | "ingest" | "analyze" | "generate" | "done" | "error";
type ExecMode = "idle" | "live" | "replay";

// Step label mapping
const STEP_LABELS: Record<ExecStep, string> = {
  idle: "",
  ingest: "Ingest",
  analyze: "Analyze",
  generate: "Generate Response",
  done: "Done",
  error: "Error",
};

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Token held by the currently-running replay. Setting .cancelled = true stops it.
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

  const isIngestActive = step === "ingest";
  const isAnalyzeActive = step === "analyze";
  const isGenerateActive = step === "generate";

  const isIngestDone = step !== "idle" && step !== "ingest";
  const isAnalyzeDone = step === "generate" || step === "done" || step === "error";
  const isGenerateDone = step === "done";

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
    <div className="min-h-screen bg-black flex flex-col">

      {/* Top bar */}
      <header className="w-full px-6 pt-4 pb-2 flex flex-col">
        <EvidaLogo size={225} />
        <div className="mt-5 border-b border-zinc-800" />
      </header>

      {/* Main content */}
      <main className="flex-1 grid grid-cols-[320px_200px_minmax(600px,1fr)] gap-6 p-6 max-w-[90rem] w-full mx-auto">

        {/* Left: Intent */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col gap-4 h-full min-h-[420px] max-h-[600px] min-w-0">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide">Intent</h2>

          <div className="flex flex-col flex-1 gap-3">
            <textarea
              ref={inputRef}
              className="w-full flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none whitespace-normal break-words"
              rows={10}
              placeholder="Describe what you want Evida to do..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
            />

            <div className="mt-auto pt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => handleSubmit()}
                disabled={loading || !question.trim()}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm text-black hover:bg-cyan-400 disabled:opacity-50"
              >
                {loading ? "Running..." : "Run"}
              </button>
            </div>
          </div>
        </div>

        {/* Center: Execution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col gap-4 h-full min-h-[420px] max-h-[600px]">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide">Execution</h2>

          <div className="flex flex-col gap-3 text-sm mt-2 justify-start">
            {/* Ingest */}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isIngestDone
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                    : isIngestActive
                    ? "bg-cyan-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    : "bg-zinc-600 opacity-40"
                }`}
              />
              <span className={`transition-colors duration-200 ${isIngestDone ? "text-zinc-200" : isIngestActive ? "text-zinc-100" : "text-zinc-500"}`}>
                {STEP_LABELS.ingest}
              </span>
            </div>

            {/* Analyze */}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isAnalyzeDone
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                    : isAnalyzeActive
                    ? "bg-cyan-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    : "bg-zinc-600 opacity-40"
                }`}
              />
              <span className={`transition-colors duration-200 ${isAnalyzeDone ? "text-zinc-200" : isAnalyzeActive ? "text-zinc-100" : "text-zinc-500"}`}>
                {STEP_LABELS.analyze}
              </span>
            </div>

            {/* Generate Response */}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  isGenerateDone
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                    : isGenerateActive
                    ? "bg-cyan-400 animate-[pulse_1.2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                    : "bg-zinc-600 opacity-40"
                }`}
              />
              <span className={`transition-colors duration-200 ${isGenerateDone ? "text-zinc-200" : isGenerateActive ? "text-zinc-100" : "text-zinc-500"}`}>
                {STEP_LABELS.generate}
              </span>
            </div>

            {/* Done */}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  step === "done"
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
                    : "bg-zinc-600 opacity-40"
                }`}
              />
              <span className={`transition-colors duration-200 ${step === "done" ? "text-zinc-200" : "text-zinc-500"}`}>
                {STEP_LABELS.done}
              </span>
            </div>

            {/* Error */}
            <div className="flex items-center gap-2 py-1">
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  step === "error"
                    ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                    : "bg-zinc-600 opacity-40"
                }`}
              />
              <span className={`transition-colors duration-200 ${step === "error" ? "text-red-400" : "text-zinc-500"}`}>
                {STEP_LABELS.error}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col gap-4 h-full min-h-[420px] min-w-0 max-h-[600px]">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide">Output</h2>

          {step === "error" ? (
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <pre className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide text-sm text-red-400 leading-7 font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {exec.error || "An error occurred"}
              </pre>
              <div className="flex flex-col gap-1">
                <div className="text-xs text-zinc-400">Retrying (last run): {exec.input}</div>
                {question !== exec.input && (
                  <div className="text-xs text-zinc-500">Current input: {question}</div>
                )}
              </div>
              <button
                onClick={handleRetry}
                disabled={exec.mode === "live"}
                className="self-start rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500 disabled:opacity-50"
              >
                Retry
              </button>
            </div>
          ) : (
            <pre className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden scrollbar-hide text-sm text-zinc-200 leading-7 font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {streamedAnswer || <span className="text-zinc-500">Waiting for execution...</span>}
              {step !== "done" && (exec.mode === "live" || (exec.mode === "replay" && step === "generate")) && (
                <span className="animate-[pulse_1.2s_ease-in-out_infinite]">|</span>
              )}
            </pre>
          )}
        </div>


      </main>
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
