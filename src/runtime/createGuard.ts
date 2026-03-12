import { MissingProjectIdError } from "../errors/MissingProjectIdError.js";
import type { GuardConfig } from "../types/config.js";
import type { Guard, ResolvedGuardConfig } from "../types/runtime.js";
import { resolveGuardConfig } from "../types/runtime.js";

export function createGuard(config: GuardConfig = {}): Guard {
  const resolvedConfig: ResolvedGuardConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,

    async run(context, execute) {
      const effectiveProjectId =
        context.projectId ?? resolvedConfig.defaultProjectId;

      if (!effectiveProjectId)
        throw new MissingProjectIdError();

      const result = await execute();

      return {
        result,
        decision: {
          allowed: true,
          blocked: false,
        },
      };
    },
  };
}