import { resolveEffectiveLimits } from '../runtime/resolveEffectiveLimits.js';
import type { ResolvedGuardConfig } from '../types/config.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type {
  AppliedDowngrade,
  GuardDecision,
  GuardViolation,
  ResolvedRunContext,
  RunBreakdownInput,
} from '../types/run.js';
import { evaluateAggregateBudget } from './evaluateAggregateBudget.js';
import { evaluateDowngrade } from './evaluateDowngrade.js';
import { evaluateRateLimit } from './evaluateRateLimit.js';
import { evaluateRequestBudget } from './evaluateRequestBudget.js';
import { evaluateScopedAggregateBudget } from './evaluateScopedAggregateBudget.js';
import { evaluateScopedRateLimit } from './evaluateScopedRateLimit.js';

export interface PolicyEvaluationResult {
  decision: GuardDecision;
  violation?: GuardViolation | undefined;
  context: ResolvedRunContext;
  preflight: PreflightEstimate;
  appliedDowngrade?: AppliedDowngrade | undefined;
}

const withCheckedPolicies = (decision: GuardDecision, checkedPolicies: string[]): GuardDecision => {
  return { ...decision, checkedPolicies };
};

const createAllowDecision = (
  checkedPolicies: string[],
  appliedDowngrade: AppliedDowngrade | undefined,
): GuardDecision => {
  return {
    allowed: true,
    blocked: false,
    action: appliedDowngrade === undefined ? 'allow' : 'downgrade',
    checkedPolicies,
  };
};

export const evaluatePolicies = async (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
  preflight: PreflightEstimate,
  breakdown: RunBreakdownInput | undefined,
): Promise<PolicyEvaluationResult> => {
  let effectiveContext = context;
  let effectivePreflight = preflight;
  let appliedDowngrade: AppliedDowngrade | undefined;
  let checkedPolicies: string[] = [];

  let effectiveLimitResolution = resolveEffectiveLimits(config, effectiveContext);

  const scopedRequestBudget = effectiveLimitResolution.limits.requestBudget;
  const scopedRequestBudgetSource = effectiveLimitResolution.sources.requestBudget;

  if (scopedRequestBudget !== undefined && scopedRequestBudgetSource !== undefined) {
    const scopedRequestBudgetPolicyName = `${scopedRequestBudgetSource}.limits.requestBudget`;

    const scopedRequestBudgetEvaluation = evaluateRequestBudget(
      scopedRequestBudget,
      effectivePreflight,
      scopedRequestBudgetPolicyName,
    );

    checkedPolicies = [
      ...checkedPolicies,
      ...scopedRequestBudgetEvaluation.decision.checkedPolicies,
    ];

    if (scopedRequestBudgetEvaluation.decision.blocked) {
      const scopedViolation = scopedRequestBudgetEvaluation.violation;

      if (scopedViolation?.type === 'request-budget') {
        const downgradeEvaluation = evaluateDowngrade({
          config,
          context: effectiveContext,
          breakdown,
          violation: scopedViolation,
          requestBudgetPolicy: scopedRequestBudget,
          requestBudgetPolicyName: scopedRequestBudgetPolicyName,
        });

        if (downgradeEvaluation !== undefined) {
          effectiveContext = downgradeEvaluation.context;
          effectivePreflight = downgradeEvaluation.preflight;
          appliedDowngrade = downgradeEvaluation.appliedDowngrade;
          checkedPolicies = [...checkedPolicies, 'downgrade.onRequestBudgetExceeded'];
        } else {
          return {
            decision: withCheckedPolicies(scopedRequestBudgetEvaluation.decision, checkedPolicies),
            violation: scopedViolation,
            context: effectiveContext,
            preflight: effectivePreflight,
          };
        }
      } else {
        return {
          decision: withCheckedPolicies(scopedRequestBudgetEvaluation.decision, checkedPolicies),
          violation: scopedRequestBudgetEvaluation.violation,
          context: effectiveContext,
          preflight: effectivePreflight,
        };
      }
    }
  }

  const requestBudgetEvaluation = evaluateRequestBudget(
    config.policies.requestBudget,
    effectivePreflight,
    'requestBudget',
  );

  checkedPolicies = [...checkedPolicies, ...requestBudgetEvaluation.decision.checkedPolicies];

  if (requestBudgetEvaluation.decision.blocked) {
    const requestBudgetViolation = requestBudgetEvaluation.violation;

    if (requestBudgetViolation?.type === 'request-budget') {
      const downgradeEvaluation = evaluateDowngrade({
        config,
        context: effectiveContext,
        breakdown,
        violation: requestBudgetViolation,
        requestBudgetPolicy: config.policies.requestBudget,
        requestBudgetPolicyName: 'requestBudget',
      });

      if (downgradeEvaluation !== undefined) {
        effectiveContext = downgradeEvaluation.context;
        effectivePreflight = downgradeEvaluation.preflight;
        appliedDowngrade = downgradeEvaluation.appliedDowngrade;
        checkedPolicies = [...checkedPolicies, 'downgrade.onRequestBudgetExceeded'];
      } else {
        return {
          decision: withCheckedPolicies(requestBudgetEvaluation.decision, checkedPolicies),
          violation: requestBudgetViolation,
          context: effectiveContext,
          preflight: effectivePreflight,
        };
      }
    } else {
      return {
        decision: withCheckedPolicies(requestBudgetEvaluation.decision, checkedPolicies),
        violation: requestBudgetEvaluation.violation,
        context: effectiveContext,
        preflight: effectivePreflight,
      };
    }
  }

  effectiveLimitResolution = resolveEffectiveLimits(config, effectiveContext);

  const scopedAggregateBudget = effectiveLimitResolution.limits.aggregateBudget;
  const scopedAggregateBudgetSource = effectiveLimitResolution.sources.aggregateBudget;

  if (
    scopedAggregateBudget?.monthlyUsd !== undefined &&
    scopedAggregateBudgetSource !== undefined
  ) {
    const scopedAggregateBudgetEvaluation = await evaluateScopedAggregateBudget({
      config,
      context: effectiveContext,
      preflight: effectivePreflight,
      scope: scopedAggregateBudgetSource,
      monthlyUsd: scopedAggregateBudget.monthlyUsd,
      policyName: `${scopedAggregateBudgetSource}.limits.aggregateBudget.monthlyUsd`,
    });

    checkedPolicies = [
      ...checkedPolicies,
      ...scopedAggregateBudgetEvaluation.decision.checkedPolicies,
    ];

    if (scopedAggregateBudgetEvaluation.decision.blocked) {
      return {
        decision: withCheckedPolicies(scopedAggregateBudgetEvaluation.decision, checkedPolicies),
        violation: scopedAggregateBudgetEvaluation.violation,
        context: effectiveContext,
        preflight: effectivePreflight,
        ...(appliedDowngrade !== undefined ? { appliedDowngrade } : {}),
      };
    }
  }

  const aggregateBudgetEvaluation = await evaluateAggregateBudget(
    config,
    effectiveContext,
    effectivePreflight,
  );

  checkedPolicies = [...checkedPolicies, ...aggregateBudgetEvaluation.decision.checkedPolicies];

  if (aggregateBudgetEvaluation.decision.blocked) {
    return {
      decision: withCheckedPolicies(aggregateBudgetEvaluation.decision, checkedPolicies),
      violation: aggregateBudgetEvaluation.violation,
      context: effectiveContext,
      preflight: effectivePreflight,
      ...(appliedDowngrade !== undefined ? { appliedDowngrade } : {}),
    };
  }

  const scopedRateLimit = effectiveLimitResolution.limits.rateLimit;
  const scopedRateLimitSource = effectiveLimitResolution.sources.rateLimit;

  if (scopedRateLimit?.requestsPerMinute !== undefined && scopedRateLimitSource !== undefined) {
    const scopedRateLimitEvaluation = await evaluateScopedRateLimit({
      config,
      context: effectiveContext,
      scope: scopedRateLimitSource,
      requestsPerMinute: scopedRateLimit.requestsPerMinute,
      policyName: `${scopedRateLimitSource}.limits.rateLimit.requestsPerMinute`,
    });

    checkedPolicies = [...checkedPolicies, ...scopedRateLimitEvaluation.decision.checkedPolicies];

    if (scopedRateLimitEvaluation.decision.blocked) {
      return {
        decision: withCheckedPolicies(scopedRateLimitEvaluation.decision, checkedPolicies),
        violation: scopedRateLimitEvaluation.violation,
        context: effectiveContext,
        preflight: effectivePreflight,
        ...(appliedDowngrade !== undefined ? { appliedDowngrade } : {}),
      };
    }
  }

  const rateLimitEvaluation = await evaluateRateLimit(config, effectiveContext);

  checkedPolicies = [...checkedPolicies, ...rateLimitEvaluation.decision.checkedPolicies];

  if (rateLimitEvaluation.decision.blocked) {
    return {
      decision: withCheckedPolicies(rateLimitEvaluation.decision, checkedPolicies),
      violation: rateLimitEvaluation.violation,
      context: effectiveContext,
      preflight: effectivePreflight,
      ...(appliedDowngrade !== undefined ? { appliedDowngrade } : {}),
    };
  }

  return {
    decision: createAllowDecision(checkedPolicies, appliedDowngrade),
    context: effectiveContext,
    preflight: effectivePreflight,
    ...(appliedDowngrade !== undefined ? { appliedDowngrade } : {}),
  };
};
