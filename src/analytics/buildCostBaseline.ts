import type { CostBaselineSnapshot } from '../types/analytics.js';
import type { UsageRecord } from '../types/storage.js';
import { buildBreakdownBaseline } from './breakdownBaseline.js';
import { getMedian, getPercentile } from './math.js';

export const buildCostBaseline = (records: UsageRecord[]): CostBaselineSnapshot | undefined => {
  const actualTotalCosts: number[] = [];
  const inputTokens: number[] = [];
  const outputTokens: number[] = [];

  for (const record of records) {
    if (record.actualUsage === undefined) continue;

    actualTotalCosts.push(record.actualUsage.actualTotalCostUsd);
    inputTokens.push(record.actualUsage.inputTokens);
    outputTokens.push(record.actualUsage.outputTokens);
  }

  if (actualTotalCosts.length === 0) return undefined;

  return {
    sampleCount: actualTotalCosts.length,
    medianActualTotalCostUsd: getMedian(actualTotalCosts),
    p90ActualTotalCostUsd: getPercentile(actualTotalCosts, 0.9),
    medianInputTokens: getMedian(inputTokens),
    medianOutputTokens: getMedian(outputTokens),
    breakdown: buildBreakdownBaseline(records),
  };
};
