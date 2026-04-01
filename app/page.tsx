import Link from "next/link";
import EvidaLogo from "@/components/EvidaLogo";

export default function Page() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 py-16">
      <div className="max-w-2xl w-full text-center">
        <div className="flex flex-col items-start mb-10">
          <EvidaLogo size={395} />
          <p className="text-xs text-zinc-500 mt-1 ml-6">Build better answers</p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/5 blur-3xl" />
          <div className="relative">
            <div className="text-sm text-zinc-300 tracking-widest uppercase mb-6">
              Ask → Commit → Build Better Answers
            </div>
            <h1 className="text-3xl font-semibold text-zinc-100 mb-4">
              Build answers that improve{" "}
              <span className="whitespace-nowrap">
                because of <span className="text-cyan-400">you</span>
              </span>
            </h1>
            <div className="mb-10">
              <p className="text-sm text-zinc-400">You decide what the system learns</p>
              <p className="text-sm text-zinc-400 mt-1">Commit what matters to shape future answers</p>
              <p className="text-xs text-zinc-500 mt-2">See the difference after one commit</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-6 mb-0 text-left bg-zinc-900 rounded-lg px-6 py-5 border border-zinc-800">
          <div className="flex items-start gap-4">
            <span className="text-xs text-zinc-600 font-mono pt-0.5 w-4 shrink-0">1</span>
            <div>
              <div className="text-sm font-medium text-zinc-200">Ask a question</div>
              <div className="text-xs text-zinc-500 mt-0.5">Get an answer instantly</div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-xs text-zinc-600 font-mono pt-0.5 w-4 shrink-0">2</span>
            <div>
              <div className="text-sm font-medium text-zinc-200">Commit what matters</div>
              <div className="text-xs text-zinc-500 mt-0.5">Add it to your system</div>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-xs text-zinc-600 font-mono pt-0.5 w-4 shrink-0">3</span>
            <div>
              <div className="text-sm font-medium text-zinc-200">See better answers</div>
              <div className="text-xs text-zinc-500 mt-0.5">Built from what you committed</div>
            </div>
          </div>
        </div>

        <Link
          href="/ask"
          className="inline-block mt-8 px-6 py-3 bg-cyan-500 text-black text-sm font-semibold rounded hover:bg-cyan-400 transition-colors"
        >
          Start Asking
        </Link>
      </div>
    </div>
  );
}
