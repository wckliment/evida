"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ExecutionTimeline } from "@/components/ExecutionTimeline";

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <span className="text-zinc-500">✓</span>;
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

function getItemId(item: any) {
  return item.id ?? item.execution_id ?? item._id;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({});
  const [committed, setCommitted] = useState<Record<string, boolean>>({});
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
    <div className="flex flex-col px-8 py-8">
      <div className="max-w-4xl mx-auto w-full">

        {/* Page Header */}
        <div className="pt-2 pb-6">
          <h1 className="text-xl font-semibold text-zinc-100">History</h1>
          <p className="text-xs text-neutral-500 mt-1">
            {history.length} {history.length === 1 ? "question" : "questions"}
          </p>
        </div>

        {history.length === 0 ? (
          <div className="text-sm text-zinc-600">
            <div>No questions yet.</div>
            <div className="mt-1 text-xs text-zinc-700">
              Ask your first question to get started
            </div>
          </div>
        ) : (
          GROUP_ORDER.map((label) => {
            const items = grouped[label];
            if (items.length === 0) return null;

            const isFirst = GROUP_ORDER.find((g) => grouped[g].length > 0) === label;

            return (
              <div key={label}>
                {/* Group Label */}
                <div className={`flex items-center gap-3 mb-3 ${!isFirst ? "mt-10" : ""}`}>
                  <span className="text-xs text-neutral-500 shrink-0">{label}</span>
                  <div className="flex-1 h-px bg-neutral-800" />
                </div>

                {(() => {
                  const itemMap = new Map<string, any>();
                  const rootItems: any[] = [];
                  items.forEach((exec) => {
                    const execId = getItemId(exec);
                    if (!execId) return;
                    itemMap.set(execId, { ...exec, children: [] });
                  });
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

                  const renderItem = (item: any, isReplay = false) => {
                    const itemId = getItemId(item);
                    const isCommitted = !!(itemId && (item.rating === "up" || ratings[itemId] === "up" || committed[itemId]));
                    const isExpanded = expandedId === itemId;

                    return (
                      <div key={itemId}>
                        {/* Row */}
                        <div
                          className="group flex items-center py-3 border-b border-zinc-800/60 hover:bg-neutral-900/40 px-2 -mx-2 cursor-pointer transition-colors"
                          onClick={() => setExpandedId((prev) => (prev === itemId ? null : itemId))}
                        >
                          {/* Status */}
                          <div className="text-xs w-4 shrink-0">
                            <StatusIcon status={item.status} />
                          </div>

                          {/* Question + meta */}
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0 ml-3">
                            <span className={`text-sm font-medium truncate ${isReplay ? "text-zinc-400" : "text-zinc-200"}`}>
                              {item.input}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500">
                                {isReplay && <span className="text-cyan-700/80 mr-1">replay</span>}
                                {new Date(item.created_at).toLocaleString()}
                              </span>
                              {isCommitted && (
                                <span className="text-xs text-emerald-500/80 font-medium">committed</span>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-3 ml-auto shrink-0">
                            <button
                              title="Add this answer to your knowledge system. Future answers will be built using it."
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!itemId || isCommitted) return;
                                setRatings((prev) => ({ ...prev, [itemId]: "up" }));
                                setCommitted((prev) => ({ ...prev, [itemId]: true }));
                                handleRate(itemId, "up");
                                sessionStorage.setItem("recentlyCommitted", "true");
                              }}
                              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                                isCommitted
                                  ? "text-emerald-400 bg-emerald-500/10 cursor-default"
                                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                              }`}
                            >
                              {isCommitted ? "Committed ✓" : "Commit"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                itemId && router.push(`/ask?executionId=${itemId}`);
                              }}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Run again →
                            </button>
                            <span className="text-xs text-zinc-600 w-16 text-right">
                              {isExpanded ? "Collapse ↑" : "Expand ↓"}
                            </span>
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        {isExpanded && (
                          <div
                            className="mx-2 mt-1 mb-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {Array.isArray(item.steps) && item.steps.length > 0 && (
                              <ExecutionTimeline
                                steps={item.steps}
                                totalDurationMs={item.total_duration_ms}
                              />
                            )}
                            {(item.output || item.result) ? (
                              <div className="border-l-2 border-neutral-700 pl-4">
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                  {item.output || item.result}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-600">No output recorded for this execution.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return rootItems.map((exec) => (
                    <div key={getItemId(exec)}>
                      {renderItem(exec, false)}
                      {exec.children.length > 0 && (
                        <div className="ml-6 border-l border-zinc-800 pl-4">
                          {exec.children.map((child: any) => {
                            const childId = getItemId(child);
                            return (
                              <div
                                key={childId}
                                className="flex gap-2 items-start"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-zinc-700 text-xs mt-3.5">↳</span>
                                <div className="flex-1">{renderItem(child, true)}</div>
                              </div>
                            );
                          })}
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
