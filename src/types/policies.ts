export interface RequestBudgetPolicyConfig {
  maxEstimatedInputCostUsd?: number;
  maxEstimatedWorstCaseCostUsd?: number | undefined;
}

export interface GuardPolicies {
  requestBudget?: RequestBudgetPolicyConfig;
}

export interface ResolvedRequestBudgetPolicyConfig {
  maxEstimatedInputCostUsd?: number | undefined;
  maxEstimatedWorstCaseCostUsd?: number | undefined;
}

export interface ResolvedGuardPolicies {
  requestBudget?: ResolvedRequestBudgetPolicyConfig | undefined;
}
