import { InvalidBreakdownPartError } from '../errors/InvalidBreakdownPartError.js';
import { calculateInputCostUsd } from '../pricing/costCalculator.js';
import { estimateInputTokens } from '../tokenization/estimateInputTokens.js';
import type { PreflightBreakdown, PreflightBreakdownPart } from '../types/preflight.js';
import type { ResolvedPricingEntry } from '../types/pricing.js';
import type { RunBreakdownInput } from '../types/run.js';

const normalizeBreakdownKey = (key: string, partIndex: number): string => {
  const normalizedKey = key.trim();

  if (normalizedKey.length === 0)
    throw new InvalidBreakdownPartError(partIndex, 'key must be a non-empty string');

  return normalizedKey;
};

const buildBreakdownPart = (
  key: string,
  content: RunBreakdownInput['parts'][number]['content'],
  pricingEntry: ResolvedPricingEntry,
): PreflightBreakdownPart => {
  const estimatedTokens = estimateInputTokens(content);
  const estimatedInputCostUsd = calculateInputCostUsd(estimatedTokens, pricingEntry);

  return { key, estimatedTokens, estimatedInputCostUsd };
};

export const buildPreflightBreakdown = (
  breakdown: RunBreakdownInput | undefined,
  totalEstimatedInputTokens: number,
  pricingEntry: ResolvedPricingEntry,
): PreflightBreakdown | undefined => {
  if (breakdown === undefined || breakdown.parts.length === 0) return undefined;

  const parts = breakdown.parts.map((part, index) => {
    const normalizedKey = normalizeBreakdownKey(part.key, index);
    return buildBreakdownPart(normalizedKey, part.content, pricingEntry);
  });

  const attributedEstimatedTokens = parts.reduce((sum, part) => {
    return sum + part.estimatedTokens;
  }, 0);

  const attributedEstimatedInputCostUsd = parts.reduce((sum, part) => {
    return sum + part.estimatedInputCostUsd;
  }, 0);

  const unattributedEstimatedTokens = Math.max(
    totalEstimatedInputTokens - attributedEstimatedTokens,
    0,
  );

  const unattributedEstimatedInputCostUsd = calculateInputCostUsd(
    unattributedEstimatedTokens,
    pricingEntry,
  );

  return {
    parts,
    attributedEstimatedTokens,
    attributedEstimatedInputCostUsd,
    totalEstimatedInputTokens,
    unattributedEstimatedTokens,
    unattributedEstimatedInputCostUsd,
  };
};
