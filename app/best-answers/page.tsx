"use client";

import { useState, useEffect } from "react";

function groupByQuestion(answers: any[]): [string, any[]][] {
  const map = new Map<string, any[]>();
  for (const item of answers) {
    const key = item.input ?? "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

export default function BestAnswersPage() {
  const [answers, setAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/executions/results")
      .then((r) => r.json())
      .then((json) => setAnswers(json.data || []))
      .catch(() => setAnswers([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = groupByQuestion(answers);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-8">
        <p className="text-sm text-neutral-500">Loading...</p>
      </div>
    );
  }

  if (!answers || answers.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-8 text-center">
        <p className="text-sm text-neutral-500">No answers committed yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
      {groups.map(([question, items]) => (
        <div
          key={question}
          className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 space-y-4"
        >
          <p className="text-sm font-medium text-zinc-200">{question}</p>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={
                  index === 0
                    ? "border-l-2 border-neutral-500 pl-4 bg-neutral-900/70 rounded-md p-4"
                    : "border-l-2 border-neutral-700 pl-4 bg-neutral-950/40 rounded-md p-3 opacity-80"
                }
              >
                {index === 0 && (
                  <p className="text-xs text-neutral-500 mb-1">
                    Primary answer
                  </p>
                )}
                <p className="text-base leading-relaxed text-zinc-200 whitespace-pre-wrap">
                  {item.output || item.result}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
