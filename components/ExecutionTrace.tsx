type ExecStep = "idle" | "ingest" | "analyze" | "generate" | "done" | "error";

interface ExecutionTraceProps {
  step: ExecStep;
  loading: boolean;
}

const STEPS: { key: ExecStep; label: string }[] = [
  { key: "ingest", label: "Ingest" },
  { key: "analyze", label: "Analyze" },
  { key: "generate", label: "Generate" },
  { key: "done", label: "Done" },
];

const STEP_ORDER: ExecStep[] = ["ingest", "analyze", "generate", "done"];

export default function ExecutionTrace({ step }: ExecutionTraceProps) {
  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className="border-t border-zinc-800 py-2 text-xs">
      <div className="flex gap-4">
        {STEPS.map(({ key, label }) => {
          const stepIndex = STEP_ORDER.indexOf(key);
          const isActive = step === key;
          const isDone = currentIndex > stepIndex || step === "done";

          if (isActive) {
            return (
              <span key={key} className="text-cyan-300">
                <span className="inline-block animate-pulse">● </span>
                {label}
              </span>
            );
          }

          if (isDone) {
            return (
              <span key={key} className="text-zinc-400">
                ✓ {label}
              </span>
            );
          }

          return (
            <span key={key} className="text-zinc-500 opacity-50">
              {label}
            </span>
          );
        })}

        {step === "error" && (
          <span className="text-zinc-400">✕ Error</span>
        )}
      </div>
    </div>
  );
}
