import type {
  RateLimitCheckInput,
  RateLimitState,
  SpendSummary,
  StorageAdapter,
  UsageRecord,
} from '../types/storage.js';
import { matchesQuery } from '../utils/query.js';
import { resolveNowMs, toIsoString } from '../utils/time.js';

interface MemoryRateLimitWindow {
  count: number;
  resetAtMs: number;
}

const cloneUsageRecord = (record: UsageRecord): UsageRecord => {
  return structuredClone(record);
};

const createEmptySpendSummary = (): SpendSummary => {
  return {
    requestCount: 0,
    executedCount: 0,
    blockedCount: 0,
    estimatedInputCostUsd: 0,
    estimatedWorstCaseCostUsd: 0,
    actualTotalCostUsd: 0,
  };
};

export const createMemoryStorage = (): StorageAdapter => {
  const records: UsageRecord[] = [];
  const rateLimitWindows = new Map<string, MemoryRateLimitWindow>();

  return {
    recordUsage(record) {
      records.push(cloneUsageRecord(record));
    },

    listUsage(query) {
      return records.filter((record) => matchesQuery(record, query)).map(cloneUsageRecord);
    },

    getSpendSummary(query) {
      const filteredRecords = records.filter((record) => matchesQuery(record, query));

      return filteredRecords.reduce<SpendSummary>((summary, record) => {
        return {
          requestCount: summary.requestCount + 1,
          executedCount: summary.executedCount + (record.executed ? 1 : 0),
          blockedCount: summary.blockedCount + (record.blocked ? 1 : 0),
          estimatedInputCostUsd:
            summary.estimatedInputCostUsd + record.preflight.estimatedInputCostUsd,
          estimatedWorstCaseCostUsd:
            summary.estimatedWorstCaseCostUsd + (record.preflight.estimatedWorstCaseCostUsd ?? 0),
          actualTotalCostUsd:
            summary.actualTotalCostUsd + (record.actualUsage?.actualTotalCostUsd ?? 0),
        };
      }, createEmptySpendSummary());
    },

    checkAndIncrementRateLimit(input: RateLimitCheckInput): RateLimitState {
      const nowMs = resolveNowMs(input.now);
      const existingWindow = rateLimitWindows.get(input.key);

      if (existingWindow === undefined || nowMs >= existingWindow.resetAtMs) {
        const nextWindow: MemoryRateLimitWindow = {
          count: 1,
          resetAtMs: nowMs + input.windowMs,
        };

        rateLimitWindows.set(input.key, nextWindow);

        return {
          allowed: true,
          count: 1,
          remaining: Math.max(input.limit - 1, 0),
          resetAt: toIsoString(nextWindow.resetAtMs),
        };
      }

      if (existingWindow.count >= input.limit)
        return {
          allowed: false,
          count: existingWindow.count,
          remaining: 0,
          resetAt: toIsoString(existingWindow.resetAtMs),
        };

      existingWindow.count += 1;

      return {
        allowed: true,
        count: existingWindow.count,
        remaining: Math.max(input.limit - existingWindow.count, 0),
        resetAt: toIsoString(existingWindow.resetAtMs),
      };
    },
  };
};
