import type { ExecutionTrace, StepName, StepRecord } from "./types/tracker";

export class ExecutionTracker {
  private readonly executionStart: number = Date.now();
  private steps: StepRecord[] = [];
  private active: StepRecord | null = null;

  step(name: StepName): void {
    this.closeActive();
    this.active = { step: name, status: "running", startedAt: Date.now() };
    this.steps.push(this.active);
  }

  end(error?: string): void {
    this.closeActive(error);
  }

  snapshot(): ExecutionTrace {
    const now = Date.now();
    const steps: StepRecord[] = this.steps.map((s) => {
      if (s.status !== "running") return s;
      return { ...s, durationMs: now - s.startedAt };
    });
    return {
      steps,
      totalDurationMs: now - this.executionStart,
    };
  }

  flush(error?: string): ExecutionTrace {
    this.closeActive(error);
    return {
      steps: this.steps,
      totalDurationMs: Date.now() - this.executionStart,
      ...(error !== undefined && { error }),
    };
  }

  private closeActive(error?: string): void {
    if (!this.active) return;
    this.active.endedAt = Date.now();
    this.active.durationMs = this.active.endedAt - this.active.startedAt;
    this.active.status = error ? "error" : "done";
    if (error) this.active.error = error;
    this.active = null;
  }
}
