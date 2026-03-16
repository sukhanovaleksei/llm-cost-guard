import { RequestBudgetExceededError } from '../errors/RequestBudgetExceededError.js';
import { evaluatePolicies } from '../policies/evaluatePolicies.js';
import { buildPreflightEstimate } from '../preflight/buildPreflightEstimate.js';
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
      const preflight = buildPreflightEstimate(resolvedConfig, resolvedContext);
      const policyEvaluation = evaluatePolicies(resolvedConfig, preflight);

      if (policyEvaluation.decision.blocked) {
        if (resolvedConfig.mode === 'hard') {
          if (policyEvaluation.violation !== undefined) {
            throw new RequestBudgetExceededError({
              providerId: resolvedContext.provider.id,
              model: resolvedContext.provider.model,
              limitType: policyEvaluation.violation.limitType,
              configuredLimitUsd: policyEvaluation.violation.configuredLimitUsd,
              actualCostUsd: policyEvaluation.violation.actualCostUsd,
              estimatedInputCostUsd: preflight.estimatedInputCostUsd,
              estimatedWorstCaseCostUsd: preflight.estimatedWorstCaseCostUsd ?? 0,
            });
          }

          throw new RequestBudgetExceededError({
            providerId: resolvedContext.provider.id,
            model: resolvedContext.provider.model,
            limitType: 'worst-case',
            configuredLimitUsd: 0,
            actualCostUsd: preflight.estimatedWorstCaseCostUsd ?? 0,
            estimatedInputCostUsd: preflight.estimatedInputCostUsd,
            estimatedWorstCaseCostUsd: preflight.estimatedWorstCaseCostUsd ?? 0,
          });
        }

        return {
          context: resolvedContext,
          decision: policyEvaluation.decision,
          effectiveConfig,
          preflight,
          violation: policyEvaluation.violation,
        };
      }

      const result = await execute(resolvedContext);

      return {
        result,
        context: resolvedContext,
        decision: policyEvaluation.decision,
        effectiveConfig,
        preflight,
      };
    },
  };
};
