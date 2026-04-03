"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, History, Bookmark } from "lucide-react";

const navItems = [
  { href: "/ask", label: "Ask", Icon: MessageSquare },
  { href: "/history", label: "History", Icon: History },
  { href: "/best-answers", label: "Best Answers", Icon: Bookmark },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-900 bg-zinc-950 px-4 py-6 flex flex-col">
      <div className="mb-6 flex justify-start">
        <div className="flex items-center justify-center h-10 w-10 rounded-md bg-zinc-800 text-cyan-400" title="Evida">
          <span className="text-xl leading-none">◈</span>
        </div>
      </div>
      <div className="text-xs text-zinc-500 uppercase tracking-wide mt-6 mb-2 pl-1">
        Navigation
      </div>
      <nav className="flex flex-col space-y-1">
        {navItems.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
