import type { GuardConfig, ResolvedGuardConfig } from "./config.js";

export const resolveGuardConfig = (config: GuardConfig = {}): ResolvedGuardConfig => {
  return {
    defaultProjectId: config.defaultProjectId,
    mode: config.mode ?? "hard",
  };
}