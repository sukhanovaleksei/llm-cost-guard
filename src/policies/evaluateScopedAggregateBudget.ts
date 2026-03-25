import type { ResolvedGuardConfig } from '../types/config.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { AggregateBudgetViolation, GuardDecision, ResolvedRunContext } from '../types/run.js';
import type { SpendQuery } from '../types/storage.js';
import { buildUtcMonthlyWindow } from './buildBudgetWindows.js';

export interface ScopedAggregateBudgetEvaluation {
  decision: GuardDecision;
  violation?: AggregateBudgetViolation;
}

export interface ScopedAggregateBudgetParams {
  config: ResolvedGuardConfig;
  context: ResolvedRunContext;
  preflight: PreflightEstimate;
  scope: 'project' | 'provider';
  monthlyUsd: number;
  policyName: string;
  now?: Date;
}

const createAllowDecision = (policyName: string): GuardDecision => {
  return { allowed: true, blocked: false, action: 'allow', checkedPolicies: [policyName] };
};

const createBlockedDecision = (policyName: string, reasonMessage: string): GuardDecision => {
  return {
    allowed: false,
    blocked: true,
    action: 'block',
    reasonCode: 'AGGREGATE_BUDGET_EXCEEDED',
    reasonMessage,
    checkedPolicies: [policyName],
  };
};

const getEstimatedRequestCostUsd = (preflight: PreflightEstimate): number => {
  return preflight.estimatedWorstCaseCostUsd ?? preflight.estimatedInputCostUsd;
};

const buildScopedQuery = (
  context: ResolvedRunContext,
  scope: 'project' | 'provider',
  from: string,
  to: string,
): SpendQuery => {
  if (scope === 'provider')
    return { from, to, projectId: context.project.id, providerId: context.provider.id };

  return { from, to, projectId: context.project.id };
};

export const evaluateScopedAggregateBudget = async (
  params: ScopedAggregateBudgetParams,
): Promise<ScopedAggregateBudgetEvaluation> => {
  const { config, context, preflight, scope, monthlyUsd, policyName, now = new Date() } = params;

  const window = buildUtcMonthlyWindow(now);
  const query = buildScopedQuery(context, scope, window.from, window.to);
  const spendSummary = await config.storage.getSpendSummary(query);

  const currentSpendUsd = spendSummary.actualTotalCostUsd;
  const estimatedRequestCostUsd = getEstimatedRequestCostUsd(preflight);
  const projectedSpendUsd = currentSpendUsd + estimatedRequestCostUsd;

  if (projectedSpendUsd > monthlyUsd) {
    const violation: AggregateBudgetViolation = {
      type: 'aggregate-budget',
      scope,
      window: 'monthly',
      configuredLimitUsd: monthlyUsd,
      currentSpendUsd,
      estimatedRequestCostUsd,
      projectedSpendUsd,
    };

    return {
      decision: createBlockedDecision(
        policyName,
        `Projected ${scope} monthly spend ${projectedSpendUsd.toFixed(6)} USD exceeds configured limit ${monthlyUsd.toFixed(6)} USD.`,
      ),
      violation,
    };
  }

  return { decision: createAllowDecision(policyName) };
};
