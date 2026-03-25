import type {
  ResolvedRequestBudgetPolicyConfig,
  ScopedRequestBudgetLimits,
} from '../types/policies.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { GuardDecision, RequestBudgetViolation } from '../types/run.js';

export interface RequestBudgetEvaluation {
  decision: GuardDecision;
  violation?: RequestBudgetViolation;
}

const createAllowDecision = (policyName: string): GuardDecision => {
  return {
    allowed: true,
    blocked: false,
    action: 'allow',
    checkedPolicies: [policyName],
  };
};

const createBlockedDecision = (reasonMessage: string, policyName: string): GuardDecision => {
  return {
    allowed: false,
    blocked: true,
    action: 'block',
    reasonCode: 'REQUEST_BUDGET_EXCEEDED',
    reasonMessage,
    checkedPolicies: [policyName],
  };
};

export const evaluateRequestBudget = (
  policy: ResolvedRequestBudgetPolicyConfig | ScopedRequestBudgetLimits | undefined,
  preflight: PreflightEstimate,
  policyName = 'requestBudget',
): RequestBudgetEvaluation => {
  if (policy === undefined) {
    return {
      decision: {
        allowed: true,
        blocked: false,
        action: 'allow',
        checkedPolicies: [],
      },
    };
  }

  const inputLimit = policy.maxEstimatedInputCostUsd;
  if (inputLimit !== undefined && preflight.estimatedInputCostUsd > inputLimit) {
    const violation: RequestBudgetViolation = {
      type: 'request-budget',
      limitType: 'input',
      configuredLimitUsd: inputLimit,
      actualCostUsd: preflight.estimatedInputCostUsd,
    };

    return {
      decision: createBlockedDecision(
        `Estimated input cost ${preflight.estimatedInputCostUsd.toFixed(6)} USD exceeds request input budget limit ${inputLimit.toFixed(6)} USD.`,
        policyName,
      ),
      violation,
    };
  }

  const worstCaseLimit = policy.maxEstimatedWorstCaseCostUsd;
  if (
    worstCaseLimit !== undefined &&
    preflight.estimatedWorstCaseCostUsd !== undefined &&
    preflight.estimatedWorstCaseCostUsd > worstCaseLimit
  ) {
    const violation: RequestBudgetViolation = {
      type: 'request-budget',
      limitType: 'worst-case',
      configuredLimitUsd: worstCaseLimit,
      actualCostUsd: preflight.estimatedWorstCaseCostUsd,
    };

    return {
      decision: createBlockedDecision(
        `Estimated worst-case cost ${preflight.estimatedWorstCaseCostUsd.toFixed(6)} USD exceeds request worst-case budget limit ${worstCaseLimit.toFixed(6)} USD.`,
        policyName,
      ),
      violation,
    };
  }

  return { decision: createAllowDecision(policyName) };
};
