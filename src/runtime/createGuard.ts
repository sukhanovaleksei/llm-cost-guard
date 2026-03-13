import type { GuardConfig } from "../types/config.js";
import type { Guard, ResolvedGuardConfig } from "../types/runtime.js";
import { resolveGuardConfig } from "../types/runtime.js";
import { resolveRunContext } from "./resolveRunContext.js";

export const createGuard = (config: GuardConfig = {}): Guard => {
  const resolvedConfig: ResolvedGuardConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,
    async run(context, execute) {
      const resolvedContext = resolveRunContext(context, resolvedConfig);
      const result = await execute();

      return {
        result,
        context: resolvedContext,
        decision: { allowed: true, blocked: false }
      };
    }
  };
}