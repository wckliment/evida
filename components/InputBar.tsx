import { useRef, useEffect } from "react";

interface InputBarProps {
  question: string;
  onQuestionChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent | null) => void;
  loading: boolean;
}

export default function InputBar({ question, onQuestionChange, onSubmit, loading }: InputBarProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [question]);

  return (
    <div className="pt-8 pb-4">
      <div className="flex items-end gap-3 rounded-[28px] border border-zinc-800 bg-zinc-950/80 px-5 py-3">
        <textarea
          ref={inputRef}
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none overflow-y-auto"
          rows={1}
          placeholder="Describe what you want Evida to do..."
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          disabled={loading}
        />
        <button
          onClick={() => onSubmit()}
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-full px-4 py-2 text-sm text-cyan-300 hover:text-cyan-200 disabled:opacity-30"
        >
          {loading ? "Running..." : "Run"}
        </button>
      </div>
    </div>
  );
}
