import type { ResolvedGuardConfig } from '../types/config.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { GuardDecision, RequestBudgetViolation } from '../types/run.js';
import { evaluateRequestBudget } from './evaluateRequestBudget.js';

export interface PolicyEvaluationResult {
  decision: GuardDecision;
  violation?: RequestBudgetViolation | undefined;
}

export const evaluatePolicies = (
  config: ResolvedGuardConfig,
  preflight: PreflightEstimate,
): PolicyEvaluationResult => {
  const requestBudgetEvaluation = evaluateRequestBudget(config.policies.requestBudget, preflight);

  return requestBudgetEvaluation;
};
