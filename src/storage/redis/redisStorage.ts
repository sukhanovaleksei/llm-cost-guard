import type {
  RateLimitCheckInput,
  RateLimitState,
  SpendQuery,
  SpendSummary,
  StorageAdapter,
  UsageRecord,
} from '../../types/storage.js';
import { matchesQuery } from '../../utils/query.js';
import {
  isSameUtcDayWindow,
  isSameUtcMonthWindow,
  resolveNowMs,
  toIsoString,
} from '../../utils/time.js';
import { isPositiveInteger, resolvePositiveInteger } from '../../utils/validation.js';
import {
  buildDailyGlobalSummaryKey,
  buildDailyUserSummaryKey,
  buildMonthlyGlobalSummaryKey,
  buildMonthlyProjectSummaryKey,
  buildMonthlyProviderSummaryKey,
  buildRateLimitStorageKey,
  buildUsageIndexKey,
  buildUsageRecordKey,
  getUtcDayId,
  getUtcMonthId,
  resolveRedisNamespace,
} from './redisKeys.js';
import {
  createEmptySpendSummary,
  deserializeSpendSummary,
  deserializeUsageRecord,
  serializeUsageRecord,
} from './redisSerialization.js';
import type { RedisStorageClient } from './redisTypes.js';

export interface RedisStorageOptions {
  client: RedisStorageClient;
  namespace?: string;
  usageRecordTtlSeconds?: number;
  dailySummaryTtlSeconds?: number;
  monthlySummaryTtlSeconds?: number;
}

interface SummaryTarget {
  key: string;
  ttlSeconds: number;
}

const DEFAULT_DAILY_SUMMARY_TTL_SECONDS = 40 * 24 * 60 * 60;
const DEFAULT_MONTHLY_SUMMARY_TTL_SECONDS = 400 * 24 * 60 * 60;
const DEFAULT_BATCH_SIZE = 100;

const createSummaryTargets = (
  namespace: string,
  record: UsageRecord,
  dailySummaryTtlSeconds: number,
  monthlySummaryTtlSeconds: number,
): SummaryTarget[] => {
  const dayId = getUtcDayId(record.timestamp);
  const monthId = getUtcMonthId(record.timestamp);

  const targets: SummaryTarget[] = [
    {
      key: buildDailyGlobalSummaryKey(namespace, dayId),
      ttlSeconds: dailySummaryTtlSeconds,
    },
    {
      key: buildMonthlyGlobalSummaryKey(namespace, monthId),
      ttlSeconds: monthlySummaryTtlSeconds,
    },
    {
      key: buildMonthlyProjectSummaryKey(namespace, monthId, record.projectId),
      ttlSeconds: monthlySummaryTtlSeconds,
    },
    {
      key: buildMonthlyProviderSummaryKey(namespace, monthId, record.projectId, record.providerId),
      ttlSeconds: monthlySummaryTtlSeconds,
    },
  ];

  if (record.userId !== undefined) {
    targets.push({
      key: buildDailyUserSummaryKey(namespace, dayId, record.userId),
      ttlSeconds: dailySummaryTtlSeconds,
    });
  }

  return targets;
};

const updateSummaryHash = async (
  client: RedisStorageClient,
  key: string,
  ttlSeconds: number,
  record: UsageRecord,
): Promise<void> => {
  await client.hIncrBy(key, 'requestCount', 1);
  await client.hIncrBy(key, 'executedCount', record.executed ? 1 : 0);
  await client.hIncrBy(key, 'blockedCount', record.blocked ? 1 : 0);

  await client.hIncrByFloat(key, 'estimatedInputCostUsd', record.preflight.estimatedInputCostUsd);
  await client.hIncrByFloat(
    key,
    'estimatedWorstCaseCostUsd',
    record.preflight.estimatedWorstCaseCostUsd ?? 0,
  );
  await client.hIncrByFloat(key, 'actualTotalCostUsd', record.actualUsage?.actualTotalCostUsd ?? 0);

  await client.expire(key, ttlSeconds);
};

const chunkArray = <TValue>(values: TValue[], chunkSize: number): TValue[][] => {
  if (values.length === 0) return [];

  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
};

const toScoreBound = (value: string | undefined, fallback: '-inf' | '+inf'): number | string => {
  if (value === undefined) return fallback;

  return new Date(value).getTime();
};

const reduceSpendSummary = (records: UsageRecord[]): SpendSummary => {
  return records.reduce<SpendSummary>((summary, record) => {
    return {
      requestCount: summary.requestCount + 1,
      executedCount: summary.executedCount + (record.executed ? 1 : 0),
      blockedCount: summary.blockedCount + (record.blocked ? 1 : 0),
      estimatedInputCostUsd: summary.estimatedInputCostUsd + record.preflight.estimatedInputCostUsd,
      estimatedWorstCaseCostUsd:
        summary.estimatedWorstCaseCostUsd + (record.preflight.estimatedWorstCaseCostUsd ?? 0),
      actualTotalCostUsd:
        summary.actualTotalCostUsd + (record.actualUsage?.actualTotalCostUsd ?? 0),
    };
  }, createEmptySpendSummary());
};

const hasUnsupportedSummaryFilters = (query: SpendQuery): boolean => {
  return (
    query.model !== undefined ||
    query.feature !== undefined ||
    query.endpoint !== undefined ||
    query.tag !== undefined
  );
};

const resolvePreAggregatedSummaryKey = (
  namespace: string,
  query?: SpendQuery,
): string | undefined => {
  if (query === undefined) return undefined;
  if (query.from === undefined || query.to === undefined) return undefined;
  if (hasUnsupportedSummaryFilters(query)) return undefined;

  const hasUserId = query.userId !== undefined;
  const hasProjectId = query.projectId !== undefined;
  const hasProviderId = query.providerId !== undefined;

  if (isSameUtcDayWindow(query.from, query.to) && !hasProjectId && !hasProviderId && !hasUserId)
    return buildDailyGlobalSummaryKey(namespace, getUtcDayId(query.from));

  if (isSameUtcMonthWindow(query.from, query.to) && !hasProjectId && !hasProviderId && !hasUserId)
    return buildMonthlyGlobalSummaryKey(namespace, getUtcMonthId(query.from));

  if (isSameUtcDayWindow(query.from, query.to) && hasUserId && !hasProjectId && !hasProviderId)
    return buildDailyUserSummaryKey(namespace, getUtcDayId(query.from), query.userId as string);

  if (isSameUtcMonthWindow(query.from, query.to) && hasProjectId && !hasProviderId && !hasUserId)
    return buildMonthlyProjectSummaryKey(
      namespace,
      getUtcMonthId(query.from),
      query.projectId as string,
    );

  if (isSameUtcMonthWindow(query.from, query.to) && hasProjectId && hasProviderId && !hasUserId)
    return buildMonthlyProviderSummaryKey(
      namespace,
      getUtcMonthId(query.from),
      query.projectId as string,
      query.providerId as string,
    );

  return undefined;
};

const readUsageRecords = async (
  client: RedisStorageClient,
  namespace: string,
  recordIds: string[],
): Promise<UsageRecord[]> => {
  const chunks = chunkArray(recordIds, DEFAULT_BATCH_SIZE);
  const records: UsageRecord[] = [];

  for (const chunk of chunks) {
    const keys = chunk.map((recordId) => buildUsageRecordKey(namespace, recordId));
    const values = await client.mGet(keys);

    for (const value of values) {
      if (value === null) continue;

      records.push(deserializeUsageRecord(value));
    }
  }

  return records;
};

export const createRedisStorage = (options: RedisStorageOptions): StorageAdapter => {
  const namespace = resolveRedisNamespace(options.namespace);
  const usageIndexKey = buildUsageIndexKey(namespace);

  const usageRecordTtlSeconds = isPositiveInteger(options.usageRecordTtlSeconds)
    ? options.usageRecordTtlSeconds
    : undefined;

  const dailySummaryTtlSeconds = resolvePositiveInteger(
    options.dailySummaryTtlSeconds,
    DEFAULT_DAILY_SUMMARY_TTL_SECONDS,
  );

  const monthlySummaryTtlSeconds = resolvePositiveInteger(
    options.monthlySummaryTtlSeconds,
    DEFAULT_MONTHLY_SUMMARY_TTL_SECONDS,
  );

  return {
    async recordUsage(record: UsageRecord): Promise<void> {
      const recordKey = buildUsageRecordKey(namespace, record.id);
      const serializedRecord = serializeUsageRecord(record);
      const timestampMs = new Date(record.timestamp).getTime();

      await options.client.set(recordKey, serializedRecord);
      await options.client.zAdd(usageIndexKey, [{ score: timestampMs, value: record.id }]);

      if (usageRecordTtlSeconds !== undefined) {
        await options.client.expire(recordKey, usageRecordTtlSeconds);
      }

      const summaryTargets = createSummaryTargets(
        namespace,
        record,
        dailySummaryTtlSeconds,
        monthlySummaryTtlSeconds,
      );

      for (const target of summaryTargets) {
        await updateSummaryHash(options.client, target.key, target.ttlSeconds, record);
      }
    },

    async listUsage(query?: SpendQuery): Promise<UsageRecord[]> {
      const minScore = toScoreBound(query?.from, '-inf');
      const maxScore = toScoreBound(query?.to, '+inf');

      const recordIds = await options.client.zRangeByScore(usageIndexKey, minScore, maxScore);
      if (recordIds.length === 0) return [];

      const records = await readUsageRecords(options.client, namespace, recordIds);

      return records.filter((record) => matchesQuery(record, query));
    },

    async getSpendSummary(query?: SpendQuery): Promise<SpendSummary> {
      const preAggregatedSummaryKey = resolvePreAggregatedSummaryKey(namespace, query);

      if (preAggregatedSummaryKey !== undefined) {
        const hash = await options.client.hGetAll(preAggregatedSummaryKey);
        return deserializeSpendSummary(hash);
      }

      const records = await this.listUsage(query);
      return reduceSpendSummary(records);
    },

    async checkAndIncrementRateLimit(input: RateLimitCheckInput): Promise<RateLimitState> {
      const key = buildRateLimitStorageKey(namespace, input.key);
      const nowMs = resolveNowMs(input.now);

      const count = await options.client.incr(key);

      if (count === 1) {
        await options.client.pExpire(key, input.windowMs);
      }

      let ttlMs = await options.client.pTTL(key);

      if (ttlMs < 0) {
        await options.client.pExpire(key, input.windowMs);
        ttlMs = input.windowMs;
      }

      const resetAtMs = nowMs + ttlMs;

      return {
        allowed: count <= input.limit,
        count,
        remaining: Math.max(input.limit - count, 0),
        resetAt: toIsoString(resetAtMs),
      };
    },
  };
};
