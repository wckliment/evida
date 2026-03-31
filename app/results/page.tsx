"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

function truncate(text: string, length = 200) {
  if (!text) return "";
  return text.length > length ? text.slice(0, length) + "…" : text;
}

export default function ResultsPage() {
  const [results, setResults] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/executions/results")
      .then((r) => r.json())
      .then((json) => setResults(json.data || []));
  }, []);

  return (
    <div className="flex-1 flex flex-col px-8 py-8">
      <div className="max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-zinc-100">Best Answers</h1>
          <p className="text-sm text-zinc-500 mt-1">
            These answers shape how your system responds.
          </p>
          {results.length > 0 && (
            <p className="text-xs text-zinc-600 mt-1">
              You&apos;ve committed {results.length} {results.length === 1 ? "answer" : "answers"}
            </p>
          )}
        </div>

        {results.length === 0 ? (
          <div className="text-sm text-zinc-600">
            <div>No committed answers yet.</div>
            <div className="mt-1 text-xs text-zinc-700">
              Commit answers to start building better answers
            </div>
          </div>
        ) : (
          <div>
            {results.map((item, index) => (
              <div
                key={item.id}
                className={`py-4 ${index < results.length - 1 ? "border-b border-zinc-800" : ""}`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <span className="text-xs text-zinc-600">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => router.push(`/ask?input=${encodeURIComponent(item.input)}`)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition font-medium"
                    >
                      Run again →
                    </button>
                    <button
                      onClick={() => router.push(`/ask?executionId=${item.id}`)}
                      className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                    >
                      View Details →
                    </button>
                  </div>
                </div>
                <div className="mb-2">
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                    Part of your system
                  </span>
                </div>
                <div className="text-sm font-medium text-zinc-100 leading-snug line-clamp-2 mb-1">
                  {item.input}
                </div>
                {item.output && (
                  <div className="text-sm text-zinc-500 leading-relaxed">
                    {truncate(item.output)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
