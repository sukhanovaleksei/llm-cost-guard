import type { SpendSummary, UsageRecord } from '../../types/storage.js';

const toFiniteNumber = (value: string | undefined): number => {
  if (value === undefined) return 0;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const toNonNegativeInteger = (value: string | undefined): number => {
  if (value === undefined) return 0;

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) return 0;

  return parsedValue;
};

export const serializeUsageRecord = (record: UsageRecord): string => {
  return JSON.stringify(record);
};

export const deserializeUsageRecord = (value: string): UsageRecord => {
  return JSON.parse(value) as UsageRecord;
};

export const createEmptySpendSummary = (): SpendSummary => {
  return {
    requestCount: 0,
    executedCount: 0,
    blockedCount: 0,
    estimatedInputCostUsd: 0,
    estimatedWorstCaseCostUsd: 0,
    actualTotalCostUsd: 0,
  };
};

export const deserializeSpendSummary = (hash: Record<string, string>): SpendSummary => {
  return {
    requestCount: toNonNegativeInteger(hash.requestCount),
    executedCount: toNonNegativeInteger(hash.executedCount),
    blockedCount: toNonNegativeInteger(hash.blockedCount),
    estimatedInputCostUsd: toFiniteNumber(hash.estimatedInputCostUsd),
    estimatedWorstCaseCostUsd: toFiniteNumber(hash.estimatedWorstCaseCostUsd),
    actualTotalCostUsd: toFiniteNumber(hash.actualTotalCostUsd),
  };
};
