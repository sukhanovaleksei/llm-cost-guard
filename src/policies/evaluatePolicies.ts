import type { ResolvedGuardConfig } from '../types/config.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { GuardDecision, GuardViolation, ResolvedRunContext } from '../types/run.js';
import { evaluateAggregateBudget } from './evaluateAggregateBudget.js';
import { evaluateRateLimit } from './evaluateRateLimit.js';
import { evaluateRequestBudget } from './evaluateRequestBudget.js';

export interface PolicyEvaluationResult {
  decision: GuardDecision;
  violation?: GuardViolation | undefined;
}

const createAllowDecision = (checkedPolicies: string[]): GuardDecision => {
  return { allowed: true, blocked: false, action: 'allow', checkedPolicies };
};

export const evaluatePolicies = async (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
  preflight: PreflightEstimate,
): Promise<PolicyEvaluationResult> => {
  const requestBudgetEvaluation = evaluateRequestBudget(config.policies.requestBudget, preflight);
  if (requestBudgetEvaluation.decision.blocked) return requestBudgetEvaluation;

  const aggregateBudgetEvaluation = await evaluateAggregateBudget(config, context, preflight);
  if (aggregateBudgetEvaluation.decision.blocked) return aggregateBudgetEvaluation;

  const rateLimitEvaluation = await evaluateRateLimit(config, context);
  if (rateLimitEvaluation.decision.blocked) return rateLimitEvaluation;

  return {
    decision: createAllowDecision([
      ...requestBudgetEvaluation.decision.checkedPolicies,
      ...aggregateBudgetEvaluation.decision.checkedPolicies,
      ...rateLimitEvaluation.decision.checkedPolicies,
    ]),
  };
};
