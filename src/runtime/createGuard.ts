import { explainCostSpike } from '../analytics/explainCostSpike.js';
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
import type { CostSpikeExplanation } from '../types/analytics.js';
import type { Guard, GuardConfig } from '../types/config.js';
import type {
  ExecuteReturnValue,
  GuardResult,
  ResolvedRunContext,
  RunContext,
} from '../types/run.js';
import type { ActualUsage } from '../types/usage.js';
import { ensureRuntimeRegistration } from './ensureRuntimeRegistration.js';
import { resolveEffectiveConfig } from './resolveEffectiveConfig.js';
import { resolveGuardConfig } from './resolveGuardConfig.js';
import { resolveRunContext } from './resolveRunContext.js';

export const createGuard = (config: GuardConfig = {}): Guard => {
  const resolvedConfig = resolveGuardConfig(config);

  return {
    config: resolvedConfig,

    addProject(project): void {
      resolvedConfig.registry.addProject(project);
    },

    addProvider(projectId, provider): void {
      resolvedConfig.registry.addProvider(projectId, provider);
    },

    hasProject(projectId): boolean {
      return resolvedConfig.registry.hasProject(projectId);
    },

    hasProvider(projectId, providerId): boolean {
      return resolvedConfig.registry.hasProvider(projectId, providerId);
    },

    async run<TExecuteResult>(
      context: RunContext,
      execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
    ): Promise<GuardResult<TExecuteResult>> {
      const initialResolvedContext = resolveRunContext(resolvedConfig, context);

      ensureRuntimeRegistration(resolvedConfig, initialResolvedContext, context);

      const initialPreflight = buildPreflightEstimate(
        resolvedConfig,
        initialResolvedContext,
        context.breakdown,
      );

      const policyEvaluation = await evaluatePolicies(
        resolvedConfig,
        initialResolvedContext,
        initialPreflight,
        context.breakdown,
      );

      const resolvedContext = policyEvaluation.context;
      const preflight = policyEvaluation.preflight;
      const appliedDowngrade = policyEvaluation.appliedDowngrade;

      const effectiveConfig = resolveEffectiveConfig(resolvedConfig, context, resolvedContext);

      if (policyEvaluation.decision.blocked) {
        const blockedRecord = buildUsageRecord({
          context: resolvedContext,
          effectiveConfig,
          decision: policyEvaluation.decision,
          preflight,
          violation: policyEvaluation.violation,
          appliedDowngrade,
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
          appliedDowngrade,
        };
      }

      const executeReturnValue = await execute(resolvedContext);

      let result: TExecuteResult;
      let actualUsage: ActualUsage | undefined;
      let costSpikeExplanation: CostSpikeExplanation | undefined;

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

          costSpikeExplanation = await explainCostSpike({
            storage: resolvedConfig.storage,
            config: resolvedConfig.analytics.costSpike,
            context: resolvedContext,
            preflight,
            actualUsage,
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
        appliedDowngrade,
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
        appliedDowngrade,
        costSpikeExplanation,
      };
    },
  };
};
