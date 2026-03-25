import type {
  ScopedAggregateBudgetLimits,
  ScopedLimits,
  ScopedRateLimitLimits,
  ScopedRequestBudgetLimits,
} from '../types/policies.js';
import { normalizePositiveInteger, normalizePositiveNumber } from '../utils/normalize.js';

const normalizeScopedRequestBudgetLimits = (
  limits: ScopedRequestBudgetLimits | undefined,
): ScopedRequestBudgetLimits | undefined => {
  if (limits === undefined) return undefined;

  const maxEstimatedInputCostUsd = normalizePositiveNumber(limits.maxEstimatedInputCostUsd);
  const maxEstimatedWorstCaseCostUsd = normalizePositiveNumber(limits.maxEstimatedWorstCaseCostUsd);

  if (maxEstimatedInputCostUsd === undefined && maxEstimatedWorstCaseCostUsd === undefined)
    return undefined;

  return {
    ...(maxEstimatedInputCostUsd !== undefined ? { maxEstimatedInputCostUsd } : {}),
    ...(maxEstimatedWorstCaseCostUsd !== undefined ? { maxEstimatedWorstCaseCostUsd } : {}),
  };
};

const normalizeScopedAggregateBudgetLimits = (
  limits: ScopedAggregateBudgetLimits | undefined,
): ScopedAggregateBudgetLimits | undefined => {
  if (limits === undefined) return undefined;

  const monthlyUsd = normalizePositiveNumber(limits.monthlyUsd);
  if (monthlyUsd === undefined) return undefined;

  return { monthlyUsd };
};

const normalizeScopedRateLimitLimits = (
  limits: ScopedRateLimitLimits | undefined,
): ScopedRateLimitLimits | undefined => {
  if (limits === undefined) return undefined;

  const requestsPerMinute = normalizePositiveInteger(limits.requestsPerMinute);
  if (requestsPerMinute === undefined) return undefined;

  return { requestsPerMinute };
};

export const normalizeScopedLimits = (
  limits: ScopedLimits | undefined,
): ScopedLimits | undefined => {
  if (limits === undefined) return undefined;

  const requestBudget = normalizeScopedRequestBudgetLimits(limits.requestBudget);
  const aggregateBudget = normalizeScopedAggregateBudgetLimits(limits.aggregateBudget);
  const rateLimit = normalizeScopedRateLimitLimits(limits.rateLimit);

  if (requestBudget === undefined && aggregateBudget === undefined && rateLimit === undefined)
    return undefined;

  return {
    ...(requestBudget !== undefined ? { requestBudget } : {}),
    ...(aggregateBudget !== undefined ? { aggregateBudget } : {}),
    ...(rateLimit !== undefined ? { rateLimit } : {}),
  };
};
