import { Inter, JetBrains_Mono } from "next/font/google";
import Image from "next/image";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Architecture — Evida",
  description: "Technical architecture overview for Evida's Recursive Execution Engine and Durable Knowledge system.",
};

const roadmap = [
  {
    phase: "Phase 1",
    label: "Standard API",
    status: "live",
    inference: "OpenAI-compatible REST",
    retrieval: "pgvector (cosine)",
    runtime: "Node.js / Next.js",
    validation: "Single-pass LLM judge",
    storage: "PostgreSQL JSONB",
    target: "Q1 2026",
  },
  {
    phase: "Phase 2",
    label: "NVIDIA NIM",
    status: "planned",
    inference: "NVIDIA NIM microservice",
    retrieval: "cuVS (GPU-accelerated ANN)",
    runtime: "TensorRT-LLM engine",
    validation: "Multi-pass recursive judge",
    storage: "Versioned knowledge graph",
    target: "Q3 2026",
  },
];

const monoStyle = { fontFamily: "var(--font-jetbrains-mono), 'Fira Code', 'Geist Mono', monospace" };
const sansStyle = { fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif" };

function Badge({ status }: { status: string }) {
  const styles =
    status === "live"
      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
      : "bg-cyan-950/40 text-cyan-300 border border-cyan-500/20";
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg ${styles}`}
      style={monoStyle}
    >
      {status}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span
        className="text-cyan-300 text-2xl font-medium tracking-tighter shrink-0"
        style={sansStyle}
      >
        {children}
      </span>
      <span className="block h-px flex-1 bg-gradient-to-r from-zinc-800 via-zinc-700 to-transparent" />
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-zinc-800/60 last:border-0">
      <span className="text-xs text-zinc-500 text-right max-w-[60%]" style={monoStyle}>{label}</span>
      <span className="text-xs text-zinc-200 text-right max-w-[60%]" style={monoStyle}>{value}</span>
    </div>
  );
}

export default function ArchitecturePage() {
  return (
    <div
      className="flex-1 min-h-screen bg-slate-950 text-zinc-100"
      style={sansStyle}
      data-fonts={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      {/* Inject font variables into this subtree */}
      <style>{`
        .arch-root { ${inter.variable}: initial; ${jetbrainsMono.variable}: initial; }
      `}</style>

      <div className="max-w-7xl mx-auto px-6 pt-20 pb-12 space-y-16">

        {/* Header */}
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-[0.25em] mb-3" style={monoStyle}>
            Evida · Technical Overview
          </p>
          <div className="flex items-center gap-6 mb-4">
            <Image src="/orbit-core.png" alt="Evida" width={120} height={120} className="h-[120px] w-auto shrink-0 drop-shadow-[0_0_18px_rgba(0,229,255,0.35)]" priority />
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-300">
              Technical Architecture
            </h1>
          </div>
          <p className="text-zinc-400 text-lg max-w-2xl mb-16 leading-relaxed">
            A recursive, GPU-acceleratable execution engine for building and maintaining durable, versioned knowledge from LLM interactions.
          </p>
        </div>

        {/* ── Recursive Execution Engine ── */}
        <section>
          <SectionLabel>Recursive Execution Engine</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-lg p-5">
              <h2 className="text-sm font-medium text-zinc-100 mb-1">Validation Loop Architecture</h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Every answer produced by Evida passes through a multi-stage validation loop before it is surfaced to the user or committed to the knowledge store. The loop is recursive: a judge model scores the answer against the original query and any committed context, and low-confidence responses are re-queued with a refined prompt until a confidence threshold is met or the retry budget is exhausted.
              </p>
              <div className="space-y-0">
                <DataRow label="loop.max_iterations" value="3" />
                <DataRow label="loop.confidence_threshold" value="0.82" />
                <DataRow label="loop.judge_model" value="claude-sonnet-4-6" />
                <DataRow label="loop.retry_strategy" value="prompt_refinement" />
                <DataRow label="loop.fallback" value="surface_with_low_conf_flag" />
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-lg p-5">
              <h2 className="text-sm font-medium text-zinc-100 mb-1">Execution Stages</h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                Each query moves through a deterministic pipeline. RAG retrieval injects committed knowledge before generation; the output is then scored, optionally re-generated, and finally presented alongside a provenance trace linking the answer back to the specific committed fragments that influenced it.
              </p>
              <ol className="space-y-2">
                {[
                  ["01", "Query normalization + intent classification"],
                  ["02", "RAG retrieval — top-k from committed knowledge"],
                  ["03", "Augmented generation with context injection"],
                  ["04", "Judge pass — confidence + relevance scoring"],
                  ["05", "Conditional re-generation (if below threshold)"],
                  ["06", "Provenance attribution + answer surfacing"],
                ].map(([n, label]) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className="text-[10px] text-cyan-600 pt-0.5 shrink-0" style={monoStyle}>{n}</span>
                    <span className="text-xs text-zinc-400 leading-relaxed">{label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="md:col-span-2 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent border border-white/5 backdrop-blur-md rounded-lg p-5">
              <h2 className="text-sm font-medium text-zinc-100 mb-3">Phase 2 Acceleration Target</h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed max-w-3xl">
                In Phase 2, the generation and judge steps will be served by a NVIDIA NIM microservice backed by TensorRT-LLM, reducing per-loop latency by an estimated 4–8× versus the current CPU-bound REST path. The retrieval step will migrate from pgvector to cuVS for GPU-accelerated approximate nearest-neighbor search, enabling sub-millisecond top-k lookups at knowledge-store scale.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                {[
                  { metric: "Inference latency", p1: "~1,200 ms", p2: "~150–300 ms", delta: "4–8×" },
                  { metric: "ANN retrieval (top-10)", p1: "~40 ms", p2: "<1 ms", delta: ">40×" },
                  { metric: "Loop throughput (req/s)", p1: "~12", p2: "~120+", delta: "10×" },
                ].map(({ metric, p1, p2, delta }) => (
                  <div key={metric} className="p-6 bg-slate-900 border border-white/5 backdrop-blur-md rounded-2xl shadow-xl hover:border-cyan-500/50 transition-all duration-300">
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4">{metric}</p>
                    <p className="text-4xl font-bold text-white mb-3" style={sansStyle}>{delta}</p>
                    <p className="text-sm text-zinc-500">faster</p>
                    <div className="mt-4 pt-4 border-t border-zinc-800 space-y-1" style={monoStyle}>
                      <div className="flex justify-between text-sm text-zinc-500">
                        <span>Phase 1</span><span>{p1}</span>
                      </div>
                      <div className="flex justify-between text-sm text-cyan-400" style={{ textShadow: "0 0 15px rgba(0,229,255,0.3)" }}>
                        <span>Phase 2</span><span>{p2}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Durable Knowledge ── */}
        <section>
          <SectionLabel>Durable Knowledge</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-lg p-5">
              <h2 className="text-sm font-medium text-zinc-100 mb-1">Versioning Model</h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                When a user commits a fragment, Evida creates an immutable versioned record. Each version carries a content hash, an embedding vector, and a lineage pointer to the previous version if one exists. Retrieval always queries the latest version of each fragment unless a historical snapshot is explicitly requested.
              </p>
              <div className="space-y-0">
                <DataRow label="record.id" value="uuid-v4" />
                <DataRow label="record.content_hash" value="sha256" />
                <DataRow label="record.embedding_model" value="text-embedding-3-small" />
                <DataRow label="record.embedding_dims" value="1536" />
                <DataRow label="record.lineage" value="linked list → root" />
                <DataRow label="record.mutability" value="immutable" />
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-lg p-5">
              <h2 className="text-sm font-medium text-zinc-100 mb-1">Commit Lifecycle</h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                A commit is the atomic unit of knowledge ingestion. It captures the source answer, the user's intent signal, the judge score at time of commit, and the resulting embedding. Commits are append-only; superseding a fragment creates a new version rather than mutating the existing record, preserving the full audit trail.
              </p>
              <ol className="space-y-2">
                {[
                  ["01", "User selects answer fragment to commit"],
                  ["02", "Content hash computed, dedup check performed"],
                  ["03", "Embedding generated and stored"],
                  ["04", "Version record written (append-only)"],
                  ["05", "Lineage pointer updated if superseding"],
                  ["06", "Index hot-swapped — available on next query"],
                ].map(([n, label]) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className="text-[10px] text-cyan-600 pt-0.5 shrink-0" style={monoStyle}>{n}</span>
                    <span className="text-xs text-zinc-400 leading-relaxed">{label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="md:col-span-2 overflow-hidden rounded-xl border border-zinc-800 bg-slate-900/50 backdrop-blur-sm p-2 shadow-2xl shadow-cyan-950/20">
              <div className="px-4 py-3 bg-zinc-800 rounded-t-lg">
                <span className="text-white text-sm font-medium tracking-wider">Knowledge Schema</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse" style={monoStyle}>
                  <thead>
                    <tr className="border-b border-zinc-700">
                      <th className="text-left px-4 py-2.5 text-white font-semibold tracking-wider">Field</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold tracking-wider">Type</th>
                      <th className="text-left px-4 py-2.5 text-white font-semibold tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["id",           "uuid",           "stable across versions"],
                      ["version",      "int",            "monotonically increasing"],
                      ["parent_id",    "uuid | null",    "previous version; null if root"],
                      ["content",      "text",           "committed fragment text"],
                      ["content_hash", "bytes[32]",      "sha256 for dedup"],
                      ["embedding",    "float32[1536]",  "Phase 1: pgvector · Phase 2: cuVS"],
                      ["judge_score",  "float",          "confidence at time of commit"],
                      ["committed_at", "timestamptz",    ""],
                      ["committed_by", "uuid",           "user reference"],
                    ].map(([field, type, note]) => (
                      <tr key={field} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/30">
                        <td className="px-4 py-2.5 text-cyan-300">{field}</td>
                        <td className="px-4 py-2.5 text-violet-300">{type}</td>
                        <td className="px-4 py-2.5 text-zinc-500">{note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>

        {/* ── Technical Roadmap ── */}
        <section>
          <SectionLabel>Technical Roadmap</SectionLabel>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-slate-900/50 backdrop-blur-sm p-2 shadow-2xl shadow-cyan-950/20">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse" style={monoStyle}>
                <thead>
                  <tr className="bg-zinc-800">
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Phase</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Inference</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Vector Retrieval</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Runtime</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Validation</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Storage</th>
                    <th className="text-left px-4 py-3 text-white font-semibold tracking-wider">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {roadmap.map((row) => {
                    const isPlanned = row.status === "planned";
                    const rowBase = isPlanned
                      ? "border-b border-cyan-900/40 bg-cyan-950/20 transition-colors hover:bg-cyan-950/30"
                      : "border-b border-zinc-800 transition-colors hover:bg-zinc-800/30";
                    const cellGlow = "";
                    return (
                      <tr key={row.phase} className={rowBase}>
                        <td className={`px-4 py-3 ${cellGlow}`}>
                          <div className="flex flex-col gap-1">
                            <span className="text-zinc-200 font-semibold">{row.phase}</span>
                            <div className="flex items-center gap-2">
                              <Badge status={row.status} />
                              <span className="text-[10px] text-zinc-500">{row.label}</span>
                            </div>
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-zinc-400 ${cellGlow}`}>{row.inference}</td>
                        <td className={`px-4 py-3 ${cellGlow}`}>
                          <span className={isPlanned ? "text-cyan-300" : "text-zinc-400"}>{row.retrieval}</span>
                        </td>
                        <td className={`px-4 py-3 ${cellGlow}`}>
                          <span className={isPlanned ? "text-cyan-300" : "text-zinc-400"}>{row.runtime}</span>
                        </td>
                        <td className={`px-4 py-3 text-zinc-400 ${cellGlow}`}>{row.validation}</td>
                        <td className={`px-4 py-3 text-zinc-400 ${cellGlow}`}>{row.storage}</td>
                        <td className={`px-4 py-3 text-zinc-500 ${cellGlow}`}>{row.target}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "NVIDIA NIM",
                desc: "Containerized inference microservices with optimized model serving. Drop-in replacement for the current REST generation path with no application-layer changes required.",
              },
              {
                title: "cuVS",
                desc: "NVIDIA RAPIDS GPU-accelerated vector search library. Replaces pgvector for ANN queries, enabling sub-millisecond retrieval over millions of committed knowledge embeddings.",
              },
              {
                title: "TensorRT-LLM",
                desc: "Compiler and runtime for LLM inference on NVIDIA GPUs. Powers both the generation and judge passes in Phase 2, delivering the latency reduction required for real-time recursive validation.",
              },
            ].map(({ title, desc }) => (
              <div key={title} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-cyan-400 mb-2" style={monoStyle}>{title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
          <span className="text-[10px] text-zinc-700" style={monoStyle}>evida · architecture · v0.2 · confidential</span>
          <span className="text-[10px] text-zinc-700" style={monoStyle}>© 2026 Evida</span>
        </div>

      </div>
    </div>
  );
}
