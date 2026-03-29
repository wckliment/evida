"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <span className="text-zinc-400">✓</span>;
  if (status === "error") return <span className="text-red-400">✕</span>;
  return <span className="text-cyan-300 animate-pulse">●</span>;
}

function getGroup(dateStr: string): "Today" | "Yesterday" | "Earlier" {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1 && now.getDate() === date.getDate()) return "Today";
  if (diffDays < 2 && now.getDate() - date.getDate() === 1) return "Yesterday";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "Earlier"] as const;

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/executions")
      .then((r) => r.json())
      .then((json) => setHistory(json.data || []));
  }, []);

  const grouped = GROUP_ORDER.reduce((acc, label) => {
    acc[label] = history.filter((item) => getGroup(item.created_at) === label);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="flex-1 flex flex-col px-8 py-8">
      <div className="max-w-4xl mx-auto w-full">
        {history.length === 0 ? (
          <span className="text-sm text-zinc-600">No executions yet.</span>
        ) : (
          GROUP_ORDER.map((label) => {
            const items = grouped[label];
            if (items.length === 0) return null;

            const isFirst = GROUP_ORDER.find((g) => grouped[g].length > 0) === label;

            return (
              <div key={label}>
                {isFirst ? (
                  <div className="text-xs text-zinc-500 mb-3">
                    <div className="flex justify-between">
                      <span>{label}</span>
                      <span className="opacity-70">
                        {items.filter((i) => i.status === "done").length} success • {items.filter((i) => i.status === "error").length} errors
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-10">
                    <div className="flex items-center justify-between text-xs text-zinc-600 mb-4">
                      <span>{label}</span>
                      <span className="opacity-70">
                        {items.filter((i) => i.status === "done").length} success • {items.filter((i) => i.status === "error").length} errors
                      </span>
                    </div>
                  </div>
                )}
                {items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/run?executionId=${item.id}`)}
                    className="group flex items-center gap-4 py-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900/60 px-2 -mx-2 transition-colors"
                  >
                    <div className="text-xs w-3 shrink-0">
                      <StatusIcon status={item.status} />
                    </div>

                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm text-zinc-100 truncate">{item.input}</span>
                      <span className="text-xs text-zinc-500 opacity-60">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>

                    <span className="text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Replay →
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
