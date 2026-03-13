import type { GuardConfig, GuardMode } from "./config.js";
import type { GuardResult, RunContext } from "./run.js";

export interface ResolvedGuardConfig {
  defaultProjectId?: string | undefined;
  mode: GuardMode;
}

export type ExecuteFn<TResult> = () => Promise<TResult>;

export interface Guard {
  config: ResolvedGuardConfig;
  run<TResult>(context: RunContext, execute: ExecuteFn<TResult>): Promise<GuardResult<TResult>>;
}

export const resolveGuardConfig = (config: GuardConfig = {}): ResolvedGuardConfig => {
  return {
    defaultProjectId: config.defaultProjectId,
    mode: config.mode ?? "hard",
  };
}