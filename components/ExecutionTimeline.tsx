import type { StepRecord } from "@/lib/types/tracker";

const DOT: Record<string, string> = {
  done:    "bg-green-500",
  error:   "bg-red-500",
  running: "bg-zinc-500",
};

const LABEL: Record<string, string> = {
  ingest:   "Preparing",
  generate: "Thinking",
  stream:   "Streaming",
};

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

export function ExecutionTimeline({
  steps,
  totalDurationMs,
}: {
  steps: StepRecord[];
  totalDurationMs?: number;
}) {
  const slowest = Math.max(...steps.map((s) => s.durationMs || 0));

  return (
    <div className="pl-7 pt-2 pb-1">
      {steps.map((s, i) => {
        const isSlowest = (s.durationMs ?? 0) === slowest && slowest > 0;

        return (
          <div key={s.step} className="flex gap-3 hover:bg-zinc-800/40 rounded px-2 py-1 transition transition-opacity duration-300">
            {/* dot + connector column */}
            <div className="flex flex-col items-center">
              <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${DOT[s.status] ?? "bg-zinc-500"}`} />
              {i < steps.length - 1 && (
                <div className="w-px flex-1 bg-zinc-800 mt-1" />
              )}
            </div>

            {/* label + duration */}
            <div className="pl-1 pb-3 flex items-baseline gap-2">
              <span className={`text-xs ${isSlowest ? "text-yellow-400 font-semibold" : "text-zinc-400"}`}>
                {LABEL[s.step] ?? s.step}
              </span>
              {s.durationMs !== undefined && (
                <span className={`text-xs ${isSlowest ? "text-yellow-400" : "text-zinc-600"}`}>
                  {formatDuration(s.durationMs)}
                </span>
              )}
              {s.status === "error" && (
                <span className="text-xs text-red-500">Failed</span>
              )}
              {s.error && (
                <span className="text-xs text-red-400 truncate max-w-xs">{s.error}</span>
              )}
            </div>
          </div>
        );
      })}

      {totalDurationMs !== undefined && (
        <div className="pl-5 pt-0.5">
          <span className="text-xs text-zinc-500">Total: </span>
          <span className="text-xs text-zinc-300">{formatDuration(totalDurationMs)}</span>
        </div>
      )}
    </div>
  );
}
