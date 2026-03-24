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

  const requestBudgetEvaluation = evaluateRequestBudget(
    config.policies.requestBudget,
    effectivePreflight,
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
