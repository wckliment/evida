export type StepName = "ingest" | "generate" | "stream";

export type Plan = {
  steps: string[];
};

export type StepRecord = {
  step: StepName;
  status: "running" | "done" | "error";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  error?: string;
};

export type ExecutionTrace = {
  steps: StepRecord[];
  totalDurationMs: number;
  error?: string;
};
