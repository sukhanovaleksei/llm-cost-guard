export interface RequestBudgetPolicyConfig {
  maxEstimatedInputCostUsd?: number;
  maxEstimatedWorstCaseCostUsd?: number | undefined;
}

export interface AggregateBudgetPolicyConfig {
  dailyUsd?: number;
  monthlyUsd?: number;
  perUserDailyUsd?: number;
  perProjectMonthlyUsd?: number;
  perProviderMonthlyUsd?: number;
}

export interface RateLimitPolicyConfig {
  requestsPerMinute?: number;
  perUserRequestsPerMinute?: number;
  perProjectRequestsPerMinute?: number;
  perProviderRequestsPerMinute?: number;
}

export interface GuardPolicies {
  requestBudget?: RequestBudgetPolicyConfig;
  aggregateBudget?: AggregateBudgetPolicyConfig;
  rateLimit?: RateLimitPolicyConfig;
  downgrade?: DowngradePolicyConfig;
}

export interface ResolvedRequestBudgetPolicyConfig {
  maxEstimatedInputCostUsd?: number | undefined;
  maxEstimatedWorstCaseCostUsd?: number | undefined;
}

export interface ResolvedAggregateBudgetPolicyConfig {
  dailyUsd?: number | undefined;
  monthlyUsd?: number | undefined;
  perUserDailyUsd?: number | undefined;
  perProjectMonthlyUsd?: number | undefined;
  perProviderMonthlyUsd?: number | undefined;
}

export interface ResolvedRateLimitPolicyConfig {
  requestsPerMinute?: number | undefined;
  perUserRequestsPerMinute?: number | undefined;
  perProjectRequestsPerMinute?: number | undefined;
  perProviderRequestsPerMinute?: number | undefined;
}

export interface ResolvedGuardPolicies {
  requestBudget?: ResolvedRequestBudgetPolicyConfig | undefined;
  aggregateBudget?: ResolvedAggregateBudgetPolicyConfig | undefined;
  rateLimit?: ResolvedRateLimitPolicyConfig | undefined;
  downgrade?: ResolvedDowngradePolicyConfig | undefined;
}

export interface DowngradeOnRequestBudgetExceededConfig {
  fallbackModel?: string;
  fallbackMaxTokens?: number;
}

export interface DowngradePolicyConfig {
  onRequestBudgetExceeded?: DowngradeOnRequestBudgetExceededConfig;
}

export interface ResolvedDowngradeOnRequestBudgetExceededConfig {
  fallbackModel?: string | undefined;
  fallbackMaxTokens?: number | undefined;
}

export interface ResolvedDowngradePolicyConfig {
  onRequestBudgetExceeded?: ResolvedDowngradeOnRequestBudgetExceededConfig | undefined;
}

export interface ScopedRequestBudgetLimits {
  maxEstimatedInputCostUsd?: number;
  maxEstimatedWorstCaseCostUsd?: number;
}

export interface ScopedAggregateBudgetLimits {
  monthlyUsd?: number;
}

export interface ScopedRateLimitLimits {
  requestsPerMinute?: number;
}

export interface ScopedLimits {
  requestBudget?: ScopedRequestBudgetLimits;
  aggregateBudget?: ScopedAggregateBudgetLimits;
  rateLimit?: ScopedRateLimitLimits;
}

export type ScopedLimitSource = 'project' | 'provider';

export interface EffectiveLimitSources {
  requestBudget?: ScopedLimitSource;
  aggregateBudget?: ScopedLimitSource;
  rateLimit?: ScopedLimitSource;
}
