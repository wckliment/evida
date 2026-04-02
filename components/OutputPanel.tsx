interface OutputPanelProps {
  streamedAnswer: string;
  loading: boolean;
  error: string | null | undefined;
  execInput: string | undefined;
  execMode: string;
  question: string;
  step: string;
  onRetry: () => void;
}

export default function OutputPanel({
  streamedAnswer,
  error,
  execInput,
  execMode,
  question,
  step,
  onRetry,
}: OutputPanelProps) {
  const showCursor =
    step !== "done" && (execMode === "live" || (execMode === "replay" && step === "generate"));

  return (
    <div className="border-l-2 border-neutral-700 pl-4">
      {step === "error" ? (
        <div className="flex flex-col gap-4">
          <p className="text-base leading-relaxed text-red-400 whitespace-pre-wrap">
            {error || "An error occurred"}
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Last run: {execInput}</span>
            {question !== execInput && (
              <span className="text-xs text-zinc-600">Current input: {question}</span>
            )}
          </div>
          <button
            onClick={onRetry}
            disabled={execMode === "live"}
            className="self-start text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <p className="text-base leading-relaxed text-zinc-200 whitespace-pre-wrap">
          {streamedAnswer || undefined}
          {showCursor && <span className="opacity-50 animate-pulse">|</span>}
        </p>
      )}
    </div>
  );
}
