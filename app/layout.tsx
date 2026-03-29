import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Evida",
  description: "Evida AI Execution Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-black text-zinc-100">
        {/* Sidebar */}
        <aside className="w-[220px] shrink-0 bg-zinc-950 border-r border-zinc-800 flex flex-col gap-6 px-4 py-6">
          <span className="text-sm font-semibold text-zinc-100 tracking-wide">Evida</span>
          <nav className="flex flex-col gap-1">
            <Link
              href="/run"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              Run
            </Link>
            <Link
              href="/history"
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              History
            </Link>
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
