import type { ExecuteFn, GuardResult, RunContext } from "./run.js";

export type GuardMode = "soft" | "hard";

export interface Guard {
  config: ResolvedGuardConfig;
  run<TResult>(context: RunContext, execute: ExecuteFn<TResult>): Promise<GuardResult<TResult>>;
}

export interface GuardConfig {
  defaultProjectId?: string;
  mode?: GuardMode;
}

export interface ResolvedGuardConfig {
  defaultProjectId?: string | undefined;
  mode: GuardMode;
}