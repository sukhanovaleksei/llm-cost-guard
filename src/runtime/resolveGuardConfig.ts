import { resolvePricingTable } from '../pricing/resolvePricingTable.js';
import { createMemoryStorage } from '../storage/createMemoryStorage.js';
import type { GuardConfig, GuardDefaults, ResolvedGuardConfig } from '../types/config.js';
import type {
  GuardPolicies,
  ResolvedAggregateBudgetPolicyConfig,
  ResolvedGuardPolicies,
  ResolvedRequestBudgetPolicyConfig,
} from '../types/policies.js';
import { createRegistry } from './registry.js';

const defaultGuardDefaults: GuardDefaults = {
  project: { metadata: {} },
  provider: { metadata: {} },
  request: { metadata: {} },
};

const isPositiveNumber = (value: number | undefined): boolean => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const resolveRequestBudgetPolicy = (
  policies: GuardPolicies | undefined,
): ResolvedRequestBudgetPolicyConfig | undefined => {
  const inputLimit = policies?.requestBudget?.maxEstimatedInputCostUsd;
  const worstCaseLimit = policies?.requestBudget?.maxEstimatedWorstCaseCostUsd;

  const resolvedInputLimit = isPositiveNumber(inputLimit) ? inputLimit : undefined;
  const resolvedWorstCaseLimit = isPositiveNumber(worstCaseLimit) ? worstCaseLimit : undefined;

  if (resolvedInputLimit === undefined && resolvedWorstCaseLimit === undefined) {
    return undefined;
  }

  return {
    maxEstimatedInputCostUsd: resolvedInputLimit,
    maxEstimatedWorstCaseCostUsd: resolvedWorstCaseLimit,
  };
};

const resolvePolicies = (policies: GuardPolicies | undefined): ResolvedGuardPolicies => {
  return {
    requestBudget: resolveRequestBudgetPolicy(policies),
    aggregateBudget: resolveAggregateBudgetPolicy(policies),
  };
};

export const resolveGuardConfig = (config: GuardConfig = {}): ResolvedGuardConfig => {
  return {
    defaultProjectId: config.defaultProjectId,
    mode: config.mode ?? 'hard',
    defaults: {
      project: {
        ...defaultGuardDefaults.project,
        ...config.defaults?.project,
      },
      provider: {
        ...defaultGuardDefaults.provider,
        ...config.defaults?.provider,
      },
      request: {
        ...defaultGuardDefaults.request,
        ...config.defaults?.request,
      },
    },
    registry: createRegistry(config.projects ?? []),
    pricing: resolvePricingTable(config.pricing),
    policies: resolvePolicies(config.policies),
    storage: config.storage ?? createMemoryStorage(),
  };
};

const resolveAggregateBudgetPolicy = (
  policies: GuardPolicies | undefined,
): ResolvedAggregateBudgetPolicyConfig | undefined => {
  const dailyUsd = isPositiveNumber(policies?.aggregateBudget?.dailyUsd)
    ? policies?.aggregateBudget?.dailyUsd
    : undefined;

  const monthlyUsd = isPositiveNumber(policies?.aggregateBudget?.monthlyUsd)
    ? policies?.aggregateBudget?.monthlyUsd
    : undefined;

  const perUserDailyUsd = isPositiveNumber(policies?.aggregateBudget?.perUserDailyUsd)
    ? policies?.aggregateBudget?.perUserDailyUsd
    : undefined;

  const perProjectMonthlyUsd = isPositiveNumber(policies?.aggregateBudget?.perProjectMonthlyUsd)
    ? policies?.aggregateBudget?.perProjectMonthlyUsd
    : undefined;

  const perProviderMonthlyUsd = isPositiveNumber(policies?.aggregateBudget?.perProviderMonthlyUsd)
    ? policies?.aggregateBudget?.perProviderMonthlyUsd
    : undefined;

  if (
    dailyUsd === undefined &&
    monthlyUsd === undefined &&
    perUserDailyUsd === undefined &&
    perProjectMonthlyUsd === undefined &&
    perProviderMonthlyUsd === undefined
  )
    return undefined;

  return {
    dailyUsd,
    monthlyUsd,
    perUserDailyUsd,
    perProjectMonthlyUsd,
    perProviderMonthlyUsd,
  };
};
