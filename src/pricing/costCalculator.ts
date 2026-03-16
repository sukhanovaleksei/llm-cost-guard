import type { ResolvedPricingEntry } from '../types/pricing.js';

export const calculateInputCostUsd = (inputTokens: number, entry: ResolvedPricingEntry): number => {
  return (inputTokens / 1_000_000) * entry.inputCostPerMillionTokens;
};

export const calculateOutputCostUsd = (
  outputTokens: number,
  entry: ResolvedPricingEntry,
): number => {
  return (outputTokens / 1_000_000) * entry.outputCostPerMillionTokens;
};

export const calculateWorstCaseCostUsd = (
  inputTokens: number,
  maxTokens: number | undefined,
  entry: ResolvedPricingEntry,
): number | undefined => {
  if (maxTokens === undefined) return undefined;

  const inputCostUsd = calculateInputCostUsd(inputTokens, entry);
  const outputCostUsd = calculateOutputCostUsd(maxTokens, entry);

  return inputCostUsd + outputCostUsd;
};
