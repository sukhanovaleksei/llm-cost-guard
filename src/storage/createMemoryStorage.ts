import type { SpendQuery, SpendSummary, StorageAdapter, UsageRecord } from '../types/storage.js';

const matchesFrom = (record: UsageRecord, from?: string): boolean => {
  if (from === undefined) return true;

  return new Date(record.timestamp).getTime() >= new Date(from).getTime();
};

const matchesTo = (record: UsageRecord, to?: string): boolean => {
  if (to === undefined) return true;

  return new Date(record.timestamp).getTime() <= new Date(to).getTime();
};

const matchesQuery = (record: UsageRecord, query?: SpendQuery): boolean => {
  if (query === undefined) return true;

  if (query.projectId !== undefined && record.projectId !== query.projectId) return false;
  if (query.providerId !== undefined && record.providerId !== query.providerId) return false;
  if (query.model !== undefined && record.model !== query.model) return false;
  if (query.userId !== undefined && record.userId !== query.userId) return false;
  if (query.feature !== undefined && record.feature !== query.feature) return false;
  if (query.endpoint !== undefined && record.endpoint !== query.endpoint) return false;
  if (query.tag !== undefined && !record.tags.includes(query.tag)) return false;
  if (!matchesFrom(record, query.from)) return false;
  if (!matchesTo(record, query.to)) return false;

  return true;
};

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
  };
};
