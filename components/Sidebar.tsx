import Link from "next/link";
import EvidaLogo from "./EvidaLogo";

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 bg-black px-4 py-6 flex flex-col">
      <div className="mt-1 mb-8">
        <EvidaLogo size={160} />
      </div>
      <nav className="flex flex-col gap-2 pl-1">
        <Link
          href="/ask"
          className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Ask
        </Link>
        <Link
          href="/history"
          className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          History
        </Link>
        <Link
          href="/results"
          className="px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Best Answers
        </Link>
      </nav>
    </aside>
  );
}
