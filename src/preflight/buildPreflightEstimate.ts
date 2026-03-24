import { MissingPricingEntryError } from '../errors/MissingPricingEntryError.js';
import { calculateInputCostUsd, calculateWorstCaseCostUsd } from '../pricing/costCalculator.js';
import { resolvePricingEntry } from '../pricing/resolvePricingEntry.js';
import { estimateInputTokens } from '../tokenization/estimateInputTokens.js';
import type { ResolvedGuardConfig } from '../types/config.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { ResolvedRunContext, RunBreakdownInput } from '../types/run.js';
import { buildPreflightBreakdown } from './buildPreflightBreakdown.js';

export const buildPreflightEstimate = (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
  breakdown: RunBreakdownInput | undefined,
): PreflightEstimate => {
  const providerId = context.provider.id;
  const model = context.provider.model;

  const pricingEntry = resolvePricingEntry(config.pricing, providerId, model);
  if (!pricingEntry) throw new MissingPricingEntryError(providerId, model);

  const estimatedInputTokens = estimateInputTokens(context.request);
  const estimatedInputCostUsd = calculateInputCostUsd(estimatedInputTokens, pricingEntry);
  const estimatedWorstCaseCostUsd = calculateWorstCaseCostUsd(
    estimatedInputTokens,
    context.provider.maxTokens,
    pricingEntry,
  );

  const preflightBreakdown = buildPreflightBreakdown(breakdown, estimatedInputTokens, pricingEntry);

  return {
    providerId,
    model,
    estimatedInputTokens,
    estimatedInputCostUsd,
    estimatedWorstCaseCostUsd,
    pricing: {
      inputCostPerMillionTokens: pricingEntry.inputCostPerMillionTokens,
      outputCostPerMillionTokens: pricingEntry.outputCostPerMillionTokens,
      currency: pricingEntry.currency,
    },
    breakdown: preflightBreakdown,
  };
};
