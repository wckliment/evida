"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExecutionTimeline } from "@/components/ExecutionTimeline";

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/executions")
      .then((r) => r.json())
      .then((json) => setHistory(json.data || []));
  }, []);

  async function handleRate(id: string, value: "up" | "down") {
    try {
      const res = await fetch(`/api/executions/${id}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: value }),
      });
      if (!res.ok) {
        console.warn("Rating failed");
      }
    } catch (err) {
      console.warn("[Rating Error]", err);
    }
  }

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
                {(() => {
                  const itemMap = new Map<string, any>();
                  const rootItems: any[] = [];
                  items.forEach((exec) => itemMap.set(exec.id, { ...exec, children: [] }));
                  itemMap.forEach((exec) => {
                    if (exec.parentExecutionId && itemMap.has(exec.parentExecutionId)) {
                      itemMap.get(exec.parentExecutionId).children.push(exec);
                    } else {
                      rootItems.push(exec);
                    }
                  });

                  itemMap.forEach((exec) => {
                    exec.children.sort((a: any, b: any) =>
                      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                  });

                  rootItems.sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );

                  const renderItem = (item: any, isReplay = false) => (
                    <div key={item.id}>
                      <div className="group flex items-center py-3 border-b border-zinc-800 hover:bg-zinc-900/60 px-2 -mx-2 transition-colors">
                        <div
                          onClick={() =>
                            setExpandedId((prev) => (prev === item.id ? null : item.id))
                          }
                          className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                        >
                          <div className="text-xs w-3 shrink-0">
                            <StatusIcon status={item.status} />
                          </div>

                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <span className={`text-sm truncate ${isReplay ? "text-zinc-400" : "text-zinc-100"}`}>
                              {item.input}
                            </span>
                            <span className="text-xs text-zinc-500 opacity-60">
                              {isReplay && <span className="text-cyan-700 mr-1">replay</span>}
                              {new Date(item.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 ml-auto shrink-0">
                          <span
                            onClick={() =>
                              setExpandedId((prev) => (prev === item.id ? null : item.id))
                            }
                            className="text-xs text-zinc-500 cursor-pointer"
                          >
                            {expandedId === item.id ? "Collapse ↑" : "Expand ↓"}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRate(item.id, "up")}
                              className="text-xs px-2 py-1 rounded text-zinc-500 hover:bg-zinc-800 hover:text-green-400 transition"
                            >
                              👍
                            </button>
                            <button
                              onClick={() => handleRate(item.id, "down")}
                              className="text-xs px-2 py-1 rounded text-zinc-500 hover:bg-zinc-800 hover:text-red-400 transition"
                            >
                              👎
                            </button>
                          </div>
                          <button
                            onClick={() => router.push(`/run?executionId=${item.id}`)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                          >
                            Open →
                          </button>
                        </div>
                      </div>
                      {expandedId === item.id && (
                        <div
                          className="ml-6 mt-3 space-y-3 transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.steps && (
                            <ExecutionTimeline
                              steps={item.steps}
                              totalDurationMs={item.total_duration_ms}
                            />
                          )}
                          {item.output && (
                            <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                              {item.output}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );

                  return rootItems.map((exec) => (
                    <div key={exec.id}>
                      {renderItem(exec)}
                      {exec.children.length > 0 && (
                        <div className="ml-6 border-l border-zinc-700 pl-4">
                          {exec.children.map((child: any) => (
                            <div
                              key={child.id}
                              className="flex gap-2 items-start"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-zinc-600 text-xs mt-3.5">↳</span>
                              <div className="flex-1">{renderItem(child, true)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ));
                })()}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
