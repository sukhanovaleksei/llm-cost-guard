import type { PreflightEstimate } from '../types/preflight.js';
import type { PricingEntry } from '../types/pricing.js';
import type { ActualUsage, NormalizedUsage } from '../types/usage.js';

const roundUsd = (value: number): number => {
  return Number(value.toFixed(12));
};

export const reconcileActualUsage = (params: {
  usage: NormalizedUsage;
  preflight: PreflightEstimate;
  pricingEntry: PricingEntry;
}): ActualUsage => {
  const { usage, preflight, pricingEntry } = params;

  const actualInputCostUsd =
    (usage.inputTokens / 1_000_000) * pricingEntry.inputCostPerMillionTokens;
  const actualOutputCostUsd =
    (usage.outputTokens / 1_000_000) * pricingEntry.outputCostPerMillionTokens;
  const actualTotalCostUsd = actualInputCostUsd + actualOutputCostUsd;

  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    actualInputCostUsd: roundUsd(actualInputCostUsd),
    actualOutputCostUsd: roundUsd(actualOutputCostUsd),
    actualTotalCostUsd: roundUsd(actualTotalCostUsd),
    deltaFromEstimatedInputCostUsd: roundUsd(actualInputCostUsd - preflight.estimatedInputCostUsd),
    deltaFromEstimatedWorstCaseCostUsd: roundUsd(
      actualTotalCostUsd - (preflight.estimatedWorstCaseCostUsd ?? 0),
    ),
  };
};
