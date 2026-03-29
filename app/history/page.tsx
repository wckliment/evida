"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/executions")
      .then((r) => r.json())
      .then((json) => setHistory(json.data || []));
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="w-full px-6 pt-6 pb-4 border-b border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-wide">History</h1>
      </header>

      <main className="flex-1 p-6 max-w-3xl w-full">
        {history.length === 0 && (
          <span className="text-sm text-zinc-500">No executions yet.</span>
        )}
        <div className="flex flex-col gap-2">
          {history.map((item) => (
            <div
              key={item.id}
              onClick={() => router.push(`/run?executionId=${item.id}`)}
              className="flex flex-col gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-4 cursor-pointer hover:bg-zinc-800 transition-colors"
            >
              <span className="text-[10px] text-zinc-500">
                {new Date(item.created_at).toLocaleString()}
              </span>
              <span className="text-sm text-zinc-200 truncate">{item.input}</span>
              {item.output && (
                <span className="text-xs text-zinc-500 leading-5 mt-1">
                  {item.output.slice(0, 120)}
                  {item.output.length > 120 ? "…" : ""}
                </span>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
