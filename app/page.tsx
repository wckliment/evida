"use client";

import { useState, useEffect, useRef } from "react";
import EvidaLogo from "../components/EvidaLogo";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idle" | "ingest" | "analyze" | "generate" | "done">("idle");
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  function loadExecution(item: any) {
    setQuestion(item.input);
    setStreamedAnswer(item.output || "");
    setStep("done");
    setError("");
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(item.input.length, item.input.length);
    }, 0);
  }

  async function refreshHistory() {
    const res = await fetch("/api/executions");
    const json = await res.json();
    setHistory(json.data || []);
  }

  useEffect(() => { refreshHistory(); }, []);

  const isIngestActive = step === "ingest";
  const isAnalyzeActive = step === "analyze";
  const isGenerateActive = step === "generate";

  const isIngestDone = step !== "idle" && step !== "ingest";
  const isAnalyzeDone = step === "generate" || step === "done";
  const isGenerateDone = step === "done";

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError("");
    setStreamedAnswer("");
    setStep("idle");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
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
            setStep(line.slice(7).trim() as "ingest" | "analyze" | "generate");
          }
        }

        // Remaining buffer is answer text (no newline yet) — flush immediately
        if (buffer && !buffer.startsWith("[STEP]")) {
          fullText += buffer;
          setStreamedAnswer(fullText);
          buffer = "";
        }
      }

      setStep("done");
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("idle");
    } finally {
      setLoading(false);
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
      <main className="flex-1 grid grid-cols-[1.2fr_1fr_1.2fr_1fr] gap-6 p-6 max-w-[90rem] w-full mx-auto">
        
        {/* Left: Intent */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col gap-4 h-full min-h-[420px] max-h-[600px]">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide">Intent</h2>

          <div className="flex flex-col flex-1 gap-3">
            <textarea
              ref={inputRef}
              className="w-full flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none"
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
            {/* Ingest Input */}
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
                Ingest Input
              </span>
            </div>

            {/* Analyze Intent */}
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
                Analyze Intent
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
                Generate Response
              </span>
            </div>
          </div>
        </div>

        {/* Right: Output */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col gap-4 h-full min-h-[420px] max-h-[600px]">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide">Output</h2>

          <pre className="text-sm text-zinc-200 leading-7 font-mono whitespace-pre-wrap">
            {streamedAnswer || <span className="text-zinc-500">Waiting for execution...</span>}
            {loading && (
              <span className="animate-[pulse_1.2s_ease-in-out_infinite]">|</span>
            )}
          </pre>
        </div>

        {/* History */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-5 flex flex-col h-full min-h-[420px] max-h-[600px]">
          <h2 className="text-xs text-zinc-500 uppercase tracking-wide border-b border-zinc-800 pb-2 mb-3">History</h2>

          <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1">
            {history.length === 0 && (
              <span className="text-xs text-zinc-500">No executions yet.</span>
            )}
            {history.map((item) => (
              <div key={item.id} onClick={() => loadExecution(item)} className="flex flex-col gap-1 border-b border-zinc-800 pb-3 cursor-pointer hover:bg-zinc-800 rounded px-1 -mx-1 transition-colors">
                <span className="text-[10px] text-zinc-500">
                  {new Date(item.created_at).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-300 truncate">{item.input}</span>
                {item.output && (
                  <span className="text-xs text-zinc-500 leading-5">
                    {item.output.slice(0, 120)}
                    {item.output.length > 120 ? "…" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}