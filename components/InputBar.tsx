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
      <div className="flex items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 transition-colors focus-within:border-cyan-400/50 focus-within:ring-2 focus-within:ring-cyan-400/20">
        <textarea
          ref={inputRef}
          className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none overflow-y-auto"
          rows={1}
          placeholder="Ask anything. Commit answers to build better ones."
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
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 active:scale-95 transition disabled:opacity-30"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </div>
    </div>
  );
}
