"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InputBar from "../../components/InputBar";
import OutputPanel from "../../components/OutputPanel";
import ExecutionTrace from "../../components/ExecutionTrace";
import { ExecutionTimeline } from "@/components/ExecutionTimeline";

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

function diffWords(original: string, replay: string) {
  const oWords = original.split(" ");
  const rWords = replay.split(" ");
  const max = Math.max(oWords.length, rWords.length);
  const result = [];
  for (let i = 0; i < max; i++) {
    const o = oWords[i] ?? "";
    const r = rWords[i] ?? "";
    result.push({ word: r, changed: o !== r });
  }
  return result;
}

function diffLines(original: string, replay: string) {
  const originalLines = original.split("\n");
  const replayLines = replay.split("\n");
  const max = Math.max(originalLines.length, replayLines.length);
  const result = [];
  for (let i = 0; i < max; i++) {
    const o = originalLines[i] ?? "";
    const r = replayLines[i] ?? "";
    result.push({ original: o, replay: r, changed: o !== r });
  }
  return result;
}

function RunPage() {
  const [question, setQuestion] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [exec, setExec] = useState<{ step: ExecStep; mode: ExecMode; input?: string; output?: string; error?: string | null }>({
    step: "idle",
    mode: "idle",
  });
  const [originalOutput, setOriginalOutput] = useState<string | null>(null);
  const [replayOutput, setReplayOutput] = useState<string | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const isReplayRef = useRef(false);
  const replayCancelRef = useRef<{ cancelled: boolean } | null>(null);
  const searchParams = useSearchParams();
  const executionId = searchParams.get("executionId");
  const [execution, setExecution] = useState<any>(null);
  const [pendingReplay, setPendingReplay] = useState<string | null>(null);
  const router = useRouter();
  const inputParam = searchParams.get("input");
  const hasAutoRun = useRef(false);
  const priorExecutionRef = useRef<any>(null);

  useEffect(() => {
    if (executionId) {
      fetch(`/api/executions/${executionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.input && !hasAutoRun.current) {
            hasAutoRun.current = true;
            const { input: exInput, steps, result, output: exOutput } = data;
            priorExecutionRef.current = {
              input: exInput,
              steps,
              result: result ?? exOutput ?? null,
            };
            setQuestion(data.input);
            setTimeout(() => handleSubmit(null, data.input), 0);
          }
        })
        .catch((err) => {
          console.warn("Replay fetch failed:", err);
        });
      return;
    }

    if (inputParam && !hasAutoRun.current) {
      hasAutoRun.current = true;
      setQuestion(inputParam);
      setTimeout(() => handleSubmit(null, inputParam), 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!executionId && pendingReplay) {
      handleSubmit(null, pendingReplay);
      setPendingReplay(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, pendingReplay]);

  // Derived helpers used throughout
  // "done" and "error" are terminal display states — execution is no longer running
  console.log("[UI] exec.mode =", exec.mode);
  const loading = exec.mode !== "idle" && exec.step !== "done" && exec.step !== "error";
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const diff = originalOutput && replayOutput ? diffLines(originalOutput, replayOutput) : null;
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
    setReplayOutput(null);
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
      if (isReplayRef.current) {
        setReplayOutput(output);
        isReplayRef.current = false;
      }
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

    if (!isReplayRef.current) {
      setIsReplayMode(false);
      setReplayOutput(null);
    }
    setStreamedAnswer("");
    setExec({ mode: "live", step: "ingest", input: inputToUse, output: "", error: null });

    try {
      console.log("[Submit] sending to API =", inputToUse);
      const payload: Record<string, any> = { question: inputToUse };
      if (priorExecutionRef.current?.input) {
        payload.context = {
          replay: true,
          priorExecution: priorExecutionRef.current,
        };
      }
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      if (isReplayRef.current) {
        setReplayOutput(fullText);
        isReplayRef.current = false;
        try {
          const res = await fetch("/api/executions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: inputToUse,
              output: fullText,
              parentExecutionId: executionId || null,
            }),
          });
          if (!res.ok) {
            console.warn("Replay persistence failed");
          }
        } catch (err) {
          console.warn("[Replay Persist Failed]", err);
        }
      } else {
        setOriginalOutput(fullText);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: message }));
    }
  }

  function handleReplay() {
    if (!execution?.input) return;
    isReplayRef.current = true;
    setIsReplayMode(true);
    setReplayOutput(null);
    setPendingReplay(execution.input);
    router.push("/run");
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
        {originalOutput && !loading && (
          <div className="flex justify-end mt-1">
            <button
              className="text-xs text-zinc-400 hover:text-zinc-200 transition"
              onClick={() => {
                isReplayRef.current = true;
                setIsReplayMode(true);
                setReplayOutput(null);
                handleSubmit(null, question);
              }}
            >
              Replay Modified
            </button>
          </div>
        )}
        {originalOutput && (isReplayMode || replayOutput) ? (
          <div className="space-y-6 mt-4">
            <div>
              <div className="text-xs text-zinc-500 mb-2">Original Output</div>
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{originalOutput}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-zinc-500">
                  {loading ? "Replay Output (Streaming)" : "Replay Output"}
                </div>
                {replayOutput && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={showOnlyChanges}
                        onChange={(e) => setShowOnlyChanges(e.target.checked)}
                      />
                      Show only changes
                    </label>
                    <button
                      className="text-xs text-zinc-400 hover:text-zinc-200"
                      onClick={() => { setReplayOutput(null); setIsReplayMode(false); }}
                    >
                      Clear Replay
                    </button>
                  </div>
                )}
              </div>
              {!replayOutput ? (
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
              ) : (
                diff && (
                  <div className="text-sm text-zinc-300 leading-relaxed font-mono">
                    {(showOnlyChanges ? diff.filter(l => l.changed) : diff).map((line, i) => (
                      <div
                        key={i}
                        className={line.changed ? "bg-yellow-500/10 border-l-2 border-yellow-500 pl-2" : "pl-2"}
                      >
                        {line.changed && <span className="text-yellow-500 mr-2">•</span>}
                        {line.changed ? (() => {
                          const words = diffWords(line.original, line.replay);
                          return (
                            <span>
                              {words.map((w, idx) => (
                                <span key={idx} className={w.changed ? "bg-yellow-500/30 px-0.5" : ""}>
                                  {idx < words.length - 1 ? w.word + " " : w.word}
                                </span>
                              ))}
                            </span>
                          );
                        })() : (
                          line.replay || "\u00a0"
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
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
        )}
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
