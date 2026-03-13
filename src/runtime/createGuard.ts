import type { Guard, GuardConfig } from "../types/config.js";
import type { ExecuteFn, GuardResult, RunContext } from "../types/run.js";
import { resolveGuardConfig } from "../types/runtime.js";
import { resolveRunContext } from "./resolveRunContext.js";

export const createGuard = (config: GuardConfig = {}): Guard => {
  const resolvedConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,
    async run<TResult, TRequest = undefined>(
      context: RunContext<TRequest>,
      execute: ExecuteFn<TResult, TRequest>
    ): Promise<GuardResult<TResult, TRequest>> {
      const resolvedContext = resolveRunContext(resolvedConfig, context);
      const result = await execute(resolvedContext);

      return { result, context: resolvedContext, decision: { allowed: true } };
    },
  };
}