import type { ResolvedGuardConfig } from '../types/config.js';
import type { ResolvedAggregateBudgetPolicyConfig } from '../types/policies.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type {
  AggregateBudgetScope,
  AggregateBudgetViolation,
  GuardDecision,
  ResolvedRunContext,
} from '../types/run.js';
import type { SpendQuery } from '../types/storage.js';
import { buildUtcDailyWindow, buildUtcMonthlyWindow } from './buildBudgetWindows.js';

export interface AggregateBudgetEvaluation {
  decision: GuardDecision;
  violation?: AggregateBudgetViolation | undefined;
}

interface AggregateBudgetCheck {
  policyName: string;
  scope: AggregateBudgetScope;
  window: 'daily' | 'monthly';
  configuredLimitUsd: number;
  query: SpendQuery;
}

const createAllowDecision = (checkedPolicies: string[]): GuardDecision => {
  return { allowed: true, blocked: false, action: 'allow', checkedPolicies };
};

const createBlockedDecision = (checkedPolicies: string[], reasonMessage: string): GuardDecision => {
  return {
    allowed: false,
    blocked: true,
    action: 'block',
    reasonCode: 'AGGREGATE_BUDGET_EXCEEDED',
    reasonMessage,
    checkedPolicies,
  };
};

const getEstimatedRequestCostUsd = (preflight: PreflightEstimate): number => {
  return preflight.estimatedWorstCaseCostUsd ?? preflight.estimatedInputCostUsd;
};

const buildChecks = (
  policy: ResolvedAggregateBudgetPolicyConfig,
  context: ResolvedRunContext,
  now: Date,
): AggregateBudgetCheck[] => {
  const checks: AggregateBudgetCheck[] = [];

  const dailyWindow = buildUtcDailyWindow(now);
  const monthlyWindow = buildUtcMonthlyWindow(now);

  if (policy.dailyUsd !== undefined) {
    checks.push({
      policyName: 'aggregateBudget.dailyUsd',
      scope: 'global',
      window: 'daily',
      configuredLimitUsd: policy.dailyUsd,
      query: { from: dailyWindow.from, to: dailyWindow.to },
    });
  }

  if (policy.monthlyUsd !== undefined) {
    checks.push({
      policyName: 'aggregateBudget.monthlyUsd',
      scope: 'global',
      window: 'monthly',
      configuredLimitUsd: policy.monthlyUsd,
      query: { from: monthlyWindow.from, to: monthlyWindow.to },
    });
  }

  if (policy.perUserDailyUsd !== undefined && context.user?.id !== undefined) {
    checks.push({
      policyName: 'aggregateBudget.perUserDailyUsd',
      scope: 'user',
      window: 'daily',
      configuredLimitUsd: policy.perUserDailyUsd,
      query: { from: dailyWindow.from, to: dailyWindow.to, userId: context.user.id },
    });
  }

  if (policy.perProjectMonthlyUsd !== undefined) {
    checks.push({
      policyName: 'aggregateBudget.perProjectMonthlyUsd',
      scope: 'project',
      window: 'monthly',
      configuredLimitUsd: policy.perProjectMonthlyUsd,
      query: { from: monthlyWindow.from, to: monthlyWindow.to, projectId: context.project.id },
    });
  }

  if (policy.perProviderMonthlyUsd !== undefined) {
    checks.push({
      policyName: 'aggregateBudget.perProviderMonthlyUsd',
      scope: 'provider',
      window: 'monthly',
      configuredLimitUsd: policy.perProviderMonthlyUsd,
      query: {
        from: monthlyWindow.from,
        to: monthlyWindow.to,
        projectId: context.project.id,
        providerId: context.provider.id,
      },
    });
  }

  return checks;
};

export const evaluateAggregateBudget = async (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
  preflight: PreflightEstimate,
  now: Date = new Date(),
): Promise<AggregateBudgetEvaluation> => {
  const policy = config.policies.aggregateBudget;
  if (policy === undefined) return { decision: createAllowDecision([]) };

  const estimatedRequestCostUsd = getEstimatedRequestCostUsd(preflight);
  const checks = buildChecks(policy, context, now);
  const checkedPolicies: string[] = [];

  for (const check of checks) {
    checkedPolicies.push(check.policyName);

    const spendSummary = await config.storage.getSpendSummary(check.query);
    const currentSpendUsd = spendSummary.actualTotalCostUsd;
    const projectedSpendUsd = currentSpendUsd + estimatedRequestCostUsd;

    if (projectedSpendUsd > check.configuredLimitUsd) {
      const violation: AggregateBudgetViolation = {
        type: 'aggregate-budget',
        scope: check.scope,
        window: check.window,
        configuredLimitUsd: check.configuredLimitUsd,
        currentSpendUsd,
        estimatedRequestCostUsd,
        projectedSpendUsd,
      };

      return {
        decision: createBlockedDecision(
          [...checkedPolicies],
          `Projected ${check.scope} ${check.window} spend ${projectedSpendUsd.toFixed(6)} USD exceeds configured limit ${check.configuredLimitUsd.toFixed(6)} USD.`,
        ),
        violation,
      };
    }
  }

  return { decision: createAllowDecision(checkedPolicies) };
};
