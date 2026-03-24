import type { BreakdownBaselinePart, BreakdownBaselineSnapshot } from '../types/analytics.js';
import type { UsageRecord } from '../types/storage.js';
import { getMedian } from './math.js';

interface BreakdownAccumulator {
  estimatedTokens: number[];
  estimatedInputCostUsd: number[];
}

const getOrCreateAccumulator = (
  accumulators: Map<string, BreakdownAccumulator>,
  key: string,
): BreakdownAccumulator => {
  const existing = accumulators.get(key);
  if (existing) return existing;

  const created: BreakdownAccumulator = { estimatedTokens: [], estimatedInputCostUsd: [] };

  accumulators.set(key, created);

  return created;
};

const buildPart = (key: string, accumulator: BreakdownAccumulator): BreakdownBaselinePart => {
  return {
    key,
    sampleCount: accumulator.estimatedTokens.length,
    medianEstimatedTokens: getMedian(accumulator.estimatedTokens),
    medianEstimatedInputCostUsd: getMedian(accumulator.estimatedInputCostUsd),
  };
};

export const buildBreakdownBaseline = (
  records: UsageRecord[],
): BreakdownBaselineSnapshot | undefined => {
  const accumulators = new Map<string, BreakdownAccumulator>();
  let sampleCount = 0;

  for (const record of records) {
    const breakdown = record.preflight.breakdown;
    if (breakdown === undefined) continue;

    sampleCount += 1;

    for (const part of breakdown.parts) {
      const accumulator = getOrCreateAccumulator(accumulators, part.key);
      accumulator.estimatedTokens.push(part.estimatedTokens);
      accumulator.estimatedInputCostUsd.push(part.estimatedInputCostUsd);
    }

    const unattributedAccumulator = getOrCreateAccumulator(accumulators, 'unattributed');

    unattributedAccumulator.estimatedTokens.push(breakdown.unattributedEstimatedTokens);
    unattributedAccumulator.estimatedInputCostUsd.push(breakdown.unattributedEstimatedInputCostUsd);
  }

  if (sampleCount === 0) return undefined;

  const parts = Array.from(accumulators.entries())
    .map(([key, accumulator]) => buildPart(key, accumulator))
    .sort((left, right) => left.key.localeCompare(right.key));

  return { sampleCount, parts };
};
