import type { Guard, GuardConfig } from '../types/config.js';
import type { ExecuteFn, GuardResult, RunContext } from '../types/run.js';
import { resolveEffectiveConfig } from './resolveEffectiveConfig.js';
import { resolveGuardConfig } from './resolveGuardConfig.js';
import { resolveRunContext } from './resolveRunContext.js';

export const createGuard = (config: GuardConfig = {}): Guard => {
  const resolvedConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,
    async run<TResult = undefined>(
      context: RunContext,
      execute: ExecuteFn<TResult>,
    ): Promise<GuardResult<TResult>> {
      const resolvedContext = resolveRunContext(resolvedConfig, context);
      const effectiveConfig = resolveEffectiveConfig(resolvedConfig, context, resolvedContext);

      const result = await execute(resolvedContext);

      return {
        result,
        context: resolvedContext,
        decision: { allowed: true },
        effectiveConfig,
      };
    },
  };
};
