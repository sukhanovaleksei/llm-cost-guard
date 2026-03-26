import { resolvePricingTable } from '../pricing/resolvePricingTable.js';
import { createMemoryStorage } from '../storage/memory/memoryStorage.js';
import type {
  GuardAnalyticsConfig,
  ResolvedCostSpikeConfig,
  ResolvedGuardAnalyticsConfig,
} from '../types/analytics.js';
import type { GuardConfig, GuardDefaults, ResolvedGuardConfig } from '../types/config.js';
import type { GuardHooks } from '../types/hooks.js';
import type {
  GuardPolicies,
  ResolvedAggregateBudgetPolicyConfig,
  ResolvedDowngradePolicyConfig,
  ResolvedGuardPolicies,
  ResolvedRateLimitPolicyConfig,
  ResolvedRequestBudgetPolicyConfig,
} from '../types/policies.js';
import {
  isPositiveInteger,
  isPositiveNumber,
  resolveNonEmptyString,
  resolvePositiveInteger,
  resolvePositiveNumber,
} from '../utils/validation.js';
import { createRegistry } from './registry.js';

const defaultGuardDefaults: GuardDefaults = {
  project: { metadata: {} },
  provider: { metadata: {} },
  request: { metadata: {} },
};

const defaultGuardHooks: GuardHooks = {};

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

const resolveRateLimitPolicy = (
  policies: GuardPolicies | undefined,
): ResolvedRateLimitPolicyConfig | undefined => {
  const requestsPerMinute = isPositiveInteger(policies?.rateLimit?.requestsPerMinute)
    ? policies?.rateLimit?.requestsPerMinute
    : undefined;

  const perUserRequestsPerMinute = isPositiveInteger(policies?.rateLimit?.perUserRequestsPerMinute)
    ? policies?.rateLimit?.perUserRequestsPerMinute
    : undefined;

  const perProjectRequestsPerMinute = isPositiveInteger(
    policies?.rateLimit?.perProjectRequestsPerMinute,
  )
    ? policies?.rateLimit?.perProjectRequestsPerMinute
    : undefined;

  const perProviderRequestsPerMinute = isPositiveInteger(
    policies?.rateLimit?.perProviderRequestsPerMinute,
  )
    ? policies?.rateLimit?.perProviderRequestsPerMinute
    : undefined;

  if (
    requestsPerMinute === undefined &&
    perUserRequestsPerMinute === undefined &&
    perProjectRequestsPerMinute === undefined &&
    perProviderRequestsPerMinute === undefined
  )
    return undefined;

  return {
    requestsPerMinute,
    perUserRequestsPerMinute,
    perProjectRequestsPerMinute,
    perProviderRequestsPerMinute,
  };
};

const resolveCostSpikeConfig = (
  analytics: GuardAnalyticsConfig | undefined,
): ResolvedCostSpikeConfig => {
  const costSpike = analytics?.costSpike;

  return {
    enabled: costSpike?.enabled ?? false,
    minBaselineSamples: resolvePositiveInteger(costSpike?.minBaselineSamples, 5),
    multiplierThreshold: resolvePositiveNumber(costSpike?.multiplierThreshold, 3),
    absoluteDeltaUsdThreshold: resolvePositiveNumber(costSpike?.absoluteDeltaUsdThreshold, 0.01),
    compareByFeature: costSpike?.compareByFeature ?? true,
    compareByEndpoint: costSpike?.compareByEndpoint ?? true,
    maxTopDrivers: resolvePositiveInteger(costSpike?.maxTopDrivers, 5),
  };
};

const resolveAnalytics = (
  analytics: GuardAnalyticsConfig | undefined,
): ResolvedGuardAnalyticsConfig => {
  return { costSpike: resolveCostSpikeConfig(analytics) };
};

const resolvePolicies = (policies: GuardPolicies | undefined): ResolvedGuardPolicies => {
  return {
    requestBudget: resolveRequestBudgetPolicy(policies),
    aggregateBudget: resolveAggregateBudgetPolicy(policies),
    rateLimit: resolveRateLimitPolicy(policies),
    downgrade: resolveDowngradePolicy(policies),
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
    analytics: resolveAnalytics(config.analytics),
    storage: config.storage ?? createMemoryStorage(),
    hooks: config.hooks ?? defaultGuardHooks,
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

const resolveDowngradePolicy = (
  policies: GuardPolicies | undefined,
): ResolvedDowngradePolicyConfig | undefined => {
  const rawPolicy = policies?.downgrade?.onRequestBudgetExceeded;

  const fallbackModel = resolveNonEmptyString(rawPolicy?.fallbackModel);
  const fallbackMaxTokens = isPositiveInteger(rawPolicy?.fallbackMaxTokens)
    ? rawPolicy?.fallbackMaxTokens
    : undefined;

  if (fallbackModel === undefined && fallbackMaxTokens === undefined) return undefined;

  return { onRequestBudgetExceeded: { fallbackModel, fallbackMaxTokens } };
};
