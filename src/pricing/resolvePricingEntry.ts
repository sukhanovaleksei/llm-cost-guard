import type { ResolvedPricingEntry } from '../types/pricing.js';

export const resolvePricingEntry = (
  pricingEntries: ResolvedPricingEntry[],
  providerId: string,
  model: string,
): ResolvedPricingEntry | undefined => {
  return pricingEntries.find((entry) => entry.providerId === providerId && entry.model === model);
};
