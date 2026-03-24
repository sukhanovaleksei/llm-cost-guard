import { AggregateBudgetExceededError } from '../errors/AggregateBudgetExceededError.js';
import { MissingPricingEntryError } from '../errors/MissingPricingEntryError.js';
import { RateLimitedError } from '../errors/RateLimitedError.js';
import { RequestBudgetExceededError } from '../errors/RequestBudgetExceededError.js';
import { buildUsageRecord } from '../execution/buildUsageRecord.js';
import { isExecuteResultEnvelope } from '../execution/isExecuteResultEnvelope.js';
import { normalizeExecuteUsage } from '../execution/normalizeExecuteUsage.js';
import { reconcileActualUsage } from '../execution/reconcileActualUsage.js';
import { evaluatePolicies } from '../policies/evaluatePolicies.js';
import { buildPreflightEstimate } from '../preflight/buildPreflightEstimate.js';
import { resolvePricingEntry } from '../pricing/resolvePricingEntry.js';
import type { Guard, GuardConfig } from '../types/config.js';
import type {
  ExecuteReturnValue,
  GuardResult,
  ResolvedRunContext,
  RunContext,
} from '../types/run.js';
import type { ActualUsage } from '../types/usage.js';
import { resolveEffectiveConfig } from './resolveEffectiveConfig.js';
import { resolveGuardConfig } from './resolveGuardConfig.js';
import { resolveRunContext } from './resolveRunContext.js';

export const createGuard = (config: GuardConfig = {}): Guard => {
  const resolvedConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,
    async run<TExecuteResult>(
      context: RunContext,
      execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
    ): Promise<GuardResult<TExecuteResult>> {
      const resolvedContext = resolveRunContext(resolvedConfig, context);
      const effectiveConfig = resolveEffectiveConfig(resolvedConfig, context, resolvedContext);
      const preflight = buildPreflightEstimate(resolvedConfig, resolvedContext);
      const policyEvaluation = await evaluatePolicies(resolvedConfig, resolvedContext, preflight);

      if (policyEvaluation.decision.blocked) {
        const blockedRecord = buildUsageRecord({
          context: resolvedContext,
          effectiveConfig,
          decision: policyEvaluation.decision,
          preflight,
          violation: policyEvaluation.violation,
          executed: false,
        });

        await resolvedConfig.storage.recordUsage(blockedRecord);

        if (resolvedConfig.mode === 'hard') {
          if (policyEvaluation.violation?.type === 'request-budget')
            throw new RequestBudgetExceededError({
              providerId: resolvedContext.provider.id,
              model: resolvedContext.provider.model,
              limitType: policyEvaluation.violation.limitType,
              configuredLimitUsd: policyEvaluation.violation.configuredLimitUsd,
              actualCostUsd: policyEvaluation.violation.actualCostUsd,
              estimatedInputCostUsd: preflight.estimatedInputCostUsd,
              estimatedWorstCaseCostUsd: preflight.estimatedWorstCaseCostUsd ?? 0,
            });

          if (policyEvaluation.violation?.type === 'aggregate-budget')
            throw new AggregateBudgetExceededError({
              providerId: resolvedContext.provider.id,
              model: resolvedContext.provider.model,
              scope: policyEvaluation.violation.scope,
              window: policyEvaluation.violation.window,
              configuredLimitUsd: policyEvaluation.violation.configuredLimitUsd,
              currentSpendUsd: policyEvaluation.violation.currentSpendUsd,
              estimatedRequestCostUsd: policyEvaluation.violation.estimatedRequestCostUsd,
              projectedSpendUsd: policyEvaluation.violation.projectedSpendUsd,
            });

          if (policyEvaluation.violation?.type === 'rate-limit')
            throw new RateLimitedError({
              providerId: resolvedContext.provider.id,
              model: resolvedContext.provider.model,
              scope: policyEvaluation.violation.scope,
              configuredLimit: policyEvaluation.violation.configuredLimit,
              currentCount: policyEvaluation.violation.currentCount,
              retryAfterSeconds: policyEvaluation.violation.retryAfterSeconds,
            });

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

      const executeReturnValue = await execute(resolvedContext);

      let result: TExecuteResult;
      let actualUsage: ActualUsage | undefined;

      if (isExecuteResultEnvelope(executeReturnValue)) {
        result = executeReturnValue.result;

        const normalizedUsage = normalizeExecuteUsage(executeReturnValue.usage);

        if (normalizedUsage !== undefined) {
          const pricingEntry = resolvePricingEntry(
            resolvedConfig.pricing,
            resolvedContext.provider.id,
            resolvedContext.provider.model,
          );
          if (!pricingEntry)
            throw new MissingPricingEntryError(
              resolvedContext.provider.id,
              resolvedContext.provider.model,
            );

          actualUsage = reconcileActualUsage({
            usage: normalizedUsage,
            preflight,
            pricingEntry,
          });
        }
      } else {
        result = executeReturnValue;
      }

      const usageRecord = buildUsageRecord({
        context: resolvedContext,
        effectiveConfig,
        decision: policyEvaluation.decision,
        preflight,
        actualUsage,
        executed: true,
      });

      await resolvedConfig.storage.recordUsage(usageRecord);

      return {
        result,
        context: resolvedContext,
        decision: policyEvaluation.decision,
        effectiveConfig,
        preflight,
        actualUsage,
      };
    },
  };
};
