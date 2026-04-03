"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InputBar from "../../components/InputBar";
import OutputPanel from "../../components/OutputPanel";
import ExecutionTrace from "../../components/ExecutionTrace";
import { ExecutionTimeline } from "@/components/ExecutionTimeline";
import { getHighlightedDiff } from "@/lib/diff";

type ExecStep = "idle" | "ingest" | "analyze" | "generate" | "done" | "error";
type ExecMode = "idle" | "live" | "replay";
type InfluencedSource = {
  id: string;
  input: string;
};

// System awareness line — receives count from parent, wire committedCount fetch to real endpoint when available
function SystemAwarenessLine({ count }: { count: number | null }) {
  if (count === null) return null;
  if (count === 0) return (
    <div className="inline-flex items-center gap-2 text-xs bg-zinc-900/60 text-zinc-500 px-3 py-1 rounded-full border border-zinc-800 mt-2">
      ● Your system has no committed answers yet
    </div>
  );
  return (
    <div className="inline-flex items-center gap-2 text-xs bg-cyan-500/10 text-cyan-300 px-3 py-1 rounded-full border border-cyan-500/20 mt-2">
      ● Your system is already using {count} committed {count === 1 ? "answer" : "answers"}
    </div>
  );
}

function AnswerSkeleton() {
  return (
    <div className="border-l-2 border-neutral-700 pl-4 space-y-3 animate-pulse">
      <div className="h-4 bg-neutral-800 rounded w-3/4" />
      <div className="h-4 bg-neutral-800 rounded w-full" />
      <div className="h-4 bg-neutral-800 rounded w-5/6" />
      <div className="h-4 bg-neutral-800 rounded w-2/3" />
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "How do I build a SaaS MVP?",
  "Explain OAuth in simple terms",
  "Best way to structure a Node.js backend",
  "How should I design a scalable API?",
];

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

function AskPage() {
  const [question, setQuestion] = useState("");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [exec, setExec] = useState<{ step: ExecStep; mode: ExecMode; input?: string; output?: string; error?: string | null }>({
    step: "idle",
    mode: "idle",
  });
  const [originalOutput, setOriginalOutput] = useState<string | null>(null);
  const [replayOutput, setReplayOutput] = useState<string | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);
  // Committed count — used for pre-answer hint and awareness line
  const [committedCount, setCommittedCount] = useState<number | null>(null);
  // recentlyCommitted — set via sessionStorage when user commits in history, cleared on next submit
  const [recentlyCommitted, setRecentlyCommitted] = useState(false);
  // hasSeenAhaMoment — shown once per session when user completes commit → ask → result loop
  const [hasSeenAhaMoment, setHasSeenAhaMoment] = useState(false);
  // inline commit state
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [previousAnswer, setPreviousAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<InfluencedSource[]>([]);
  const [committed, setCommitted] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
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

  // Fetch committed count + read recentlyCommitted flag from sessionStorage
  useEffect(() => {
    fetch("/api/executions/results")
      .then((r) => r.json())
      .then((json) => setCommittedCount((json.data || []).length))
      .catch(() => setCommittedCount(0));
    if (sessionStorage.getItem("recentlyCommitted") === "true") {
      setRecentlyCommitted(true);
    }
    if (sessionStorage.getItem("hasSeenAhaMoment") === "true") {
      setHasSeenAhaMoment(true);
    }
  }, []);

  useEffect(() => {
    if (!executionId && pendingReplay) {
      handleSubmit(null, pendingReplay);
      setPendingReplay(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionId, pendingReplay]);

  const loading = exec.mode !== "idle" && exec.step !== "done" && exec.step !== "error";
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);
  const diff = originalOutput && replayOutput ? diffLines(originalOutput, replayOutput) : null;
  const step = exec.step;

  async function replayExecution(item: any) {
    if (exec.mode === "live" && exec.step !== "done") return;

    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
    }
    const token = { cancelled: false };
    replayCancelRef.current = token;

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
        setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: item.error || "Something went wrong" }));
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
      if (replayCancelRef.current === token) {
        replayCancelRef.current = null;
      }
    }
  }

  function handleRetry() {
    if (!exec.input) return;

    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
      replayCancelRef.current = null;
    }

    setExec({
      step: "idle",
      mode: "idle",
      error: null,
    });

    setStreamedAnswer("");

    handleSubmit(null, exec.input);
  }

  async function handleSubmit(e?: React.FormEvent | null, overrideInput?: string) {
    e?.preventDefault();
    const inputToUse = overrideInput ?? question;
    if (!inputToUse.trim()) return;

    if (replayCancelRef.current) {
      replayCancelRef.current.cancelled = true;
      replayCancelRef.current = null;
    }

    if (!isReplayRef.current) {
      setIsReplayMode(false);
      setReplayOutput(null);
    }
    setStreamedAnswer("");
    setCurrentExecutionId(null);
    setPreviousAnswer(null);
    setSources([]);
    setCommitted(false);
    setExec({ mode: "live", step: "ingest", input: inputToUse, output: "", error: null });
    // Clear recentlyCommitted after it's been "used" by this submission
    sessionStorage.removeItem("recentlyCommitted");

    try {
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

        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.startsWith("[STEP] ")) {
            setExec((prev) => ({ ...prev, step: line.slice(7).trim() as ExecStep }));
          } else if (line.startsWith("[EXEC_ID] ")) {
            setCurrentExecutionId(line.slice(10).trim());
          } else if (line.startsWith("[PREV_ANSWER] ")) {
            try {
              setPreviousAnswer(JSON.parse(line.slice(14).trim()));
            } catch {}
          } else if (line.startsWith("[SOURCES] ")) {
            try {
              setSources(JSON.parse(line.slice(10).trim()));
            } catch {}
          } else if (line.startsWith("[ERROR] ")) {
            const errMsg = line.slice(8).trim();
            setExec((prev) => ({ ...prev, step: "error", mode: "idle", error: errMsg }));
          }
        }

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

  async function handleCommit() {
    if (!currentExecutionId || committed || commitLoading) return;
    setCommitLoading(true);
    try {
      await fetch(`/api/executions/${currentExecutionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: "up" }),
      });
      setCommitted(true);
      sessionStorage.setItem("recentlyCommitted", "true");
      setCommittedCount((prev) => (prev !== null ? prev + 1 : 1));
      router.refresh();
    } catch (err) {
      console.warn("[Commit Error]", err);
    } finally {
      setCommitLoading(false);
    }
  }

  function handleReplay() {
    if (!execution?.input) return;
    isReplayRef.current = true;
    setIsReplayMode(true);
    setReplayOutput(null);
    setPendingReplay(execution.input);
    router.push("/ask");
  }

  const answerDone = exec.step === "done" && streamedAnswer;

  // Mark aha moment as seen the first time commit → ask → result loop completes
  useEffect(() => {
    if (answerDone && recentlyCommitted && !hasSeenAhaMoment) {
      setHasSeenAhaMoment(true);
      sessionStorage.setItem("hasSeenAhaMoment", "true");
    }
  }, [answerDone, recentlyCommitted, hasSeenAhaMoment]);

  return (
    <div className="flex-1 flex flex-col px-8 pb-12">
      <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 space-y-5">

        {/* Question Input Section */}
        <div>
          <div className="pt-8 pb-2">
            <h1 className="text-xl font-semibold text-zinc-100">Ask anything</h1>
            <SystemAwarenessLine count={committedCount} />
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <InputBar
              question={question}
              onQuestionChange={setQuestion}
              onSubmit={handleSubmit}
              loading={loading}
            />
            {exec.step === "idle" && (
              <div className="px-1 pb-1 space-y-3">
                <p className="text-xs text-zinc-500">Ask a question, then commit the best answer</p>
                <div>
                  <p className="text-xs text-zinc-600 mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => setQuestion(prompt)}
                        className="inline-block px-3 py-1.5 rounded-full bg-zinc-800/70 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer transition text-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answer Display Section */}
        {exec.step !== "idle" && (
          <div className={`rounded-xl border bg-neutral-900/50 p-6 ${(recentlyCommitted || (committedCount !== null && committedCount > 0)) ? "border-neutral-600" : "border-neutral-800"}`}>
            {originalOutput && (isReplayMode || replayOutput) ? (
              <div className="space-y-6">
                <div>
                  <div className="text-xs text-neutral-500 mb-3">Original Output</div>
                  <div className="border-l-2 border-neutral-700 pl-4 space-y-4">
                    <p className="text-base leading-relaxed text-zinc-300 whitespace-pre-wrap">{originalOutput}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-zinc-500">
                      {loading ? "Replay Output (Streaming)" : "Replay Output"}
                    </div>
                    {replayOutput && (
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showOnlyChanges}
                            onChange={(e) => setShowOnlyChanges(e.target.checked)}
                          />
                          Show only changes
                        </label>
                        <button
                          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                          onClick={() => { setReplayOutput(null); setIsReplayMode(false); }}
                        >
                          Clear Replay
                        </button>
                      </div>
                    )}
                  </div>
                  {!replayOutput ? (
                    loading && !streamedAnswer ? (
                      <AnswerSkeleton />
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
                    )
                  ) : (
                    diff && (
                      <div className="border-l-2 border-neutral-700 pl-4 text-sm text-zinc-300 leading-relaxed font-mono">
                        {(showOnlyChanges ? diff.filter(l => l.changed) : diff).map((line, i) => (
                          <div
                            key={i}
                            className={line.changed ? "bg-yellow-500/10 border-l-2 border-yellow-500 pl-2 -ml-4" : ""}
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
              <div className="space-y-4">
                {recentlyCommitted ? (
                  <p className="text-xs text-neutral-500 mb-2">This answer reflects what you just committed</p>
                ) : committedCount !== null && committedCount > 0 ? (
                  <p className="text-xs text-neutral-500 mb-2">Influenced by your committed answers</p>
                ) : null}
                <p className="text-xs text-neutral-500">System Response</p>
                {loading && !streamedAnswer ? (
                  <AnswerSkeleton />
                ) : exec.step === "error" ? (
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
                  <div className="border-l-2 border-neutral-700 pl-4">
                    <div
                      className="text-base leading-relaxed text-zinc-200 whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{
                        __html: previousAnswer
                          ? getHighlightedDiff(previousAnswer, streamedAnswer)
                          : streamedAnswer,
                      }}
                    />
                    {step !== "done" &&
                      (exec.mode === "live" || (exec.mode === "replay" && step === "generate")) && (
                        <span className="opacity-50 animate-pulse text-zinc-200">|</span>
                      )}
                    {sources && sources.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-neutral-500">
                          Influenced by your committed answers
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {sources.map((source) => (
                            <span
                              key={source.id}
                              className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-md border border-neutral-700"
                            >
                              {source.input}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {previousAnswer && !loading && (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 mt-4">
                    <p className="text-xs text-neutral-500 mb-2">Previous answer</p>
                    <p className="text-sm text-neutral-400 leading-relaxed whitespace-pre-wrap">
                      {previousAnswer}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Replay Modified — shown after first answer completes */}
            {originalOutput && !loading && !isReplayMode && (
              <div className="flex justify-end mt-4 pt-3 border-t border-neutral-800">
                <button
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
          </div>
        )}

        {/* Commit Section */}
        {answerDone && !isReplayMode && !replayOutput && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-6 pt-5 pb-6">
            {committed ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-400">Committed ✓</p>
                <p className="text-xs text-zinc-500">This answer will shape future responses. Ask a similar question to see the difference.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">Use this answer to improve future responses</p>
                <button
                  onClick={handleCommit}
                  disabled={commitLoading || committed}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-white text-black hover:bg-neutral-100 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {commitLoading ? "Committing..." : "Commit Answer"}
                </button>
              </div>
            )}
          </div>
        )}

        <ExecutionTrace step={step} loading={loading} />
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AskPage />
    </Suspense>
  );
}
