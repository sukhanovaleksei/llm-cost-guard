import { buildPreflightEstimate } from '../preflight/buildPreflightEstimate.js';
import type { ResolvedGuardConfig } from '../types/config.js';
import type {
  ResolvedRequestBudgetPolicyConfig,
  ScopedRequestBudgetLimits,
} from '../types/policies.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type {
  AppliedDowngrade,
  RequestBudgetViolation,
  ResolvedRunContext,
  RunBreakdownInput,
} from '../types/run.js';
import { evaluateRequestBudget } from './evaluateRequestBudget.js';

export interface DowngradeEvaluationResult {
  context: ResolvedRunContext;
  preflight: PreflightEstimate;
  appliedDowngrade: AppliedDowngrade;
}

interface EvaluateDowngradeParams {
  config: ResolvedGuardConfig;
  context: ResolvedRunContext;
  breakdown: RunBreakdownInput | undefined;
  violation: RequestBudgetViolation;
  requestBudgetPolicy: ResolvedRequestBudgetPolicyConfig | ScopedRequestBudgetLimits | undefined;
  requestBudgetPolicyName: string;
}

const resolveEffectiveMaxTokens = (
  currentMaxTokens: number | undefined,
  fallbackMaxTokens: number | undefined,
): number | undefined => {
  if (fallbackMaxTokens === undefined) return currentMaxTokens;
  if (currentMaxTokens === undefined) return fallbackMaxTokens;

  return Math.min(currentMaxTokens, fallbackMaxTokens);
};

const buildCandidateContext = (
  context: ResolvedRunContext,
  fallbackModel: string | undefined,
  fallbackMaxTokens: number | undefined,
): ResolvedRunContext | undefined => {
  const effectiveModel = fallbackModel ?? context.provider.model;
  const effectiveMaxTokens = resolveEffectiveMaxTokens(
    context.provider.maxTokens,
    fallbackMaxTokens,
  );

  const modelChanged = effectiveModel !== context.provider.model;
  const maxTokensChanged = effectiveMaxTokens !== context.provider.maxTokens;

  if (!modelChanged && !maxTokensChanged) return undefined;

  return {
    ...context,
    provider: {
      id: context.provider.id,
      model: effectiveModel,
      ...(effectiveMaxTokens !== undefined ? { maxTokens: effectiveMaxTokens } : {}),
    },
  };
};

export const evaluateDowngrade = (
  params: EvaluateDowngradeParams,
): DowngradeEvaluationResult | undefined => {
  const { config, context, breakdown, violation, requestBudgetPolicy, requestBudgetPolicyName } =
    params;

  if (violation.type !== 'request-budget') return undefined;

  const policy = config.policies.downgrade?.onRequestBudgetExceeded;
  if (policy === undefined) return undefined;

  const candidateContext = buildCandidateContext(
    context,
    policy.fallbackModel,
    policy.fallbackMaxTokens,
  );

  if (candidateContext === undefined) return undefined;

  const candidatePreflight = buildPreflightEstimate(config, candidateContext, breakdown);
  const requestBudgetEvaluation = evaluateRequestBudget(
    requestBudgetPolicy,
    candidatePreflight,
    requestBudgetPolicyName,
  );

  if (requestBudgetEvaluation.decision.blocked) return undefined;

  return {
    context: candidateContext,
    preflight: candidatePreflight,
    appliedDowngrade: {
      reason: 'request-budget',
      originalProviderId: context.provider.id,
      effectiveProviderId: candidateContext.provider.id,
      originalModel: context.provider.model,
      effectiveModel: candidateContext.provider.model,
      ...(context.provider.maxTokens !== undefined
        ? { originalMaxTokens: context.provider.maxTokens }
        : {}),
      ...(candidateContext.provider.maxTokens !== undefined
        ? { effectiveMaxTokens: candidateContext.provider.maxTokens }
        : {}),
    },
  };
};
