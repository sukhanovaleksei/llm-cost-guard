import type { PricingEntry, ResolvedPricingEntry } from '../types/pricing.js';

const normalizeCurrency = (currency?: 'USD'): 'USD' => {
  return currency ?? 'USD';
};

export const resolvePricingTable = (
  pricingEntries: PricingEntry[] | undefined,
): ResolvedPricingEntry[] => {
  if (!pricingEntries || pricingEntries.length === 0) return [];

  return pricingEntries.map((entry) => ({
    providerId: entry.providerId.trim(),
    model: entry.model.trim(),
    inputCostPerMillionTokens: entry.inputCostPerMillionTokens,
    outputCostPerMillionTokens: entry.outputCostPerMillionTokens,
    cachedInputCostPerMillionTokens: entry.cachedInputCostPerMillionTokens,
    currency: normalizeCurrency(entry.currency),
  }));
};
