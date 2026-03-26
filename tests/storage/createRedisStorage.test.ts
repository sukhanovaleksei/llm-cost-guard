import { describe, expect, it } from 'vitest';

import type { UsageRecord } from '../../src/index.js';
import { createMemoryStorage, createRedisStorage } from '../../src/index.js';
import { createFakeRedisStorageClient } from '../helpers/createFakeRedisStorageClient.js';

const createUsageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => {
  return {
    id: 'record-1',
    timestamp: '2026-03-23T10:00:00.000Z',
    projectId: 'app-main',
    providerId: 'openai',
    model: 'gpt-4o-mini',
    tags: [],
    metadata: {},
    decision: { allowed: true, blocked: false, action: 'allow', checkedPolicies: [] },
    preflight: {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      estimatedInputTokens: 100,
      estimatedInputCostUsd: 0.001,
      estimatedWorstCaseCostUsd: 0.005,
      pricing: { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 2, currency: 'USD' },
    },
    executed: true,
    blocked: false,
    ...overrides,
  };
};

describe('createRedisStorage', () => {
  it('stores usage records and returns them from listUsage', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-1',
        feature: 'chat',
        endpoint: '/api/chat',
        tags: ['billing', 'prod'],
      }),
    );

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('record-1');
    expect(records[0]?.feature).toBe('chat');
    expect(records[0]?.endpoint).toBe('/api/chat');
    expect(records[0]?.tags).toEqual(['billing', 'prod']);
  });

  it('filters usage records by query fields', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-1',
        providerId: 'openai',
        model: 'gpt-4o-mini',
        userId: 'user-1',
        feature: 'chat',
        endpoint: '/api/chat',
        tags: ['prod'],
      }),
    );

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-2',
        providerId: 'anthropic',
        model: 'claude-3-5-haiku',
        userId: 'user-2',
        feature: 'summarize',
        endpoint: '/api/summarize',
        tags: ['staging'],
      }),
    );

    const byProvider = await storage.listUsage({ providerId: 'openai' });
    const byUser = await storage.listUsage({ userId: 'user-2' });
    const byFeature = await storage.listUsage({ feature: 'chat' });
    const byEndpoint = await storage.listUsage({ endpoint: '/api/summarize' });
    const byTag = await storage.listUsage({ tag: 'prod' });

    expect(byProvider).toHaveLength(1);
    expect(byProvider[0]?.id).toBe('record-1');

    expect(byUser).toHaveLength(1);
    expect(byUser[0]?.id).toBe('record-2');

    expect(byFeature).toHaveLength(1);
    expect(byFeature[0]?.id).toBe('record-1');

    expect(byEndpoint).toHaveLength(1);
    expect(byEndpoint[0]?.id).toBe('record-2');

    expect(byTag).toHaveLength(1);
    expect(byTag[0]?.id).toBe('record-1');
  });

  it('filters usage records by time range', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({ id: 'record-1', timestamp: '2026-03-23T09:00:00.000Z' }),
    );
    await storage.recordUsage(
      createUsageRecord({ id: 'record-2', timestamp: '2026-03-23T11:00:00.000Z' }),
    );

    const records = await storage.listUsage({
      from: '2026-03-23T10:00:00.000Z',
      to: '2026-03-23T12:00:00.000Z',
    });

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('record-2');
  });

  it('matches memory storage semantics for generic spend summary queries', async () => {
    const memoryStorage = createMemoryStorage();

    const client = createFakeRedisStorageClient();
    const redisStorage = createRedisStorage({ client, namespace: 'test-storage' });

    const records: UsageRecord[] = [
      createUsageRecord({
        id: 'record-1',
        providerId: 'openai',
        actualUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          actualInputCostUsd: 0.001,
          actualOutputCostUsd: 0.002,
          actualTotalCostUsd: 0.003,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: -0.002,
        },
      }),
      createUsageRecord({
        id: 'record-2',
        providerId: 'openai',
        feature: 'chat',
        actualUsage: {
          inputTokens: 80,
          outputTokens: 20,
          totalTokens: 100,
          actualInputCostUsd: 0.001,
          actualOutputCostUsd: 0.001,
          actualTotalCostUsd: 0.002,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: -0.003,
        },
      }),
      createUsageRecord({
        id: 'record-3',
        providerId: 'anthropic',
        blocked: true,
        executed: false,
        decision: {
          allowed: false,
          blocked: true,
          action: 'block',
          reasonCode: 'REQUEST_BUDGET_EXCEEDED',
          reasonMessage: 'blocked',
          checkedPolicies: ['requestBudget'],
        },
        actualUsage: undefined,
      }),
    ];

    for (const record of records) {
      await memoryStorage.recordUsage(record);
      await redisStorage.recordUsage(record);
    }

    const memorySummary = await memoryStorage.getSpendSummary({
      providerId: 'openai',
      feature: 'chat',
    });
    const redisSummary = await redisStorage.getSpendSummary({
      providerId: 'openai',
      feature: 'chat',
    });

    expect(redisSummary).toEqual(memorySummary);
  });

  it('returns pre-aggregated global daily summary', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-1',
        timestamp: '2026-03-23T09:00:00.000Z',
        actualUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          actualInputCostUsd: 0.001,
          actualOutputCostUsd: 0.002,
          actualTotalCostUsd: 0.003,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: -0.002,
        },
      }),
    );

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-2',
        timestamp: '2026-03-23T18:00:00.000Z',
        actualUsage: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          actualInputCostUsd: 0.001,
          actualOutputCostUsd: 0.002,
          actualTotalCostUsd: 0.003,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: -0.002,
        },
      }),
    );

    const summary = await storage.getSpendSummary({
      from: '2026-03-23T00:00:00.000Z',
      to: '2026-03-23T23:59:59.999Z',
    });

    expect(summary).toEqual({
      requestCount: 2,
      executedCount: 2,
      blockedCount: 0,
      estimatedInputCostUsd: 0.002,
      estimatedWorstCaseCostUsd: 0.01,
      actualTotalCostUsd: 0.006,
    });
  });

  it('returns pre-aggregated global monthly summary', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({ id: 'record-1', timestamp: '2026-03-05T10:00:00.000Z' }),
    );
    await storage.recordUsage(
      createUsageRecord({ id: 'record-2', timestamp: '2026-03-20T10:00:00.000Z' }),
    );

    const summary = await storage.getSpendSummary({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
    });

    expect(summary.requestCount).toBe(2);
    expect(summary.executedCount).toBe(2);
    expect(summary.blockedCount).toBe(0);
    expect(summary.estimatedInputCostUsd).toBe(0.002);
    expect(summary.estimatedWorstCaseCostUsd).toBe(0.01);
  });

  it('returns pre-aggregated per-user daily summary', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(createUsageRecord({ id: 'record-1', userId: 'user-1' }));
    await storage.recordUsage(createUsageRecord({ id: 'record-2', userId: 'user-2' }));

    const summary = await storage.getSpendSummary({
      from: '2026-03-23T00:00:00.000Z',
      to: '2026-03-23T23:59:59.999Z',
      userId: 'user-1',
    });

    expect(summary.requestCount).toBe(1);
    expect(summary.executedCount).toBe(1);
    expect(summary.blockedCount).toBe(0);
  });

  it('returns pre-aggregated per-project monthly summary', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(createUsageRecord({ id: 'record-1', projectId: 'app-main' }));
    await storage.recordUsage(createUsageRecord({ id: 'record-2', projectId: 'other-app' }));

    const summary = await storage.getSpendSummary({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
      projectId: 'app-main',
    });

    expect(summary.requestCount).toBe(1);
    expect(summary.executedCount).toBe(1);
    expect(summary.blockedCount).toBe(0);
  });

  it('returns pre-aggregated per-provider monthly summary', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    await storage.recordUsage(
      createUsageRecord({ id: 'record-1', projectId: 'app-main', providerId: 'openai' }),
    );
    await storage.recordUsage(
      createUsageRecord({ id: 'record-2', projectId: 'app-main', providerId: 'anthropic' }),
    );

    const summary = await storage.getSpendSummary({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
      projectId: 'app-main',
      providerId: 'openai',
    });

    expect(summary.requestCount).toBe(1);
    expect(summary.executedCount).toBe(1);
    expect(summary.blockedCount).toBe(0);
  });

  it('shares rate limit state across storage instances with the same namespace', async () => {
    const client = createFakeRedisStorageClient();
    client.setNow('2026-03-23T10:00:00.000Z');

    const storageA = createRedisStorage({ client, namespace: 'shared-ns' });
    const storageB = createRedisStorage({ client, namespace: 'shared-ns' });

    const first = await storageA.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 2,
      windowMs: 60_000,
      now: '2026-03-23T10:00:00.000Z',
    });
    const second = await storageB.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 2,
      windowMs: 60_000,
      now: '2026-03-23T10:00:10.000Z',
    });
    const third = await storageA.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 2,
      windowMs: 60_000,
      now: '2026-03-23T10:00:20.000Z',
    });

    expect(first.allowed).toBe(true);
    expect(first.count).toBe(1);

    expect(second.allowed).toBe(true);
    expect(second.count).toBe(2);

    expect(third.allowed).toBe(false);
    expect(third.count).toBe(3);
    expect(third.remaining).toBe(0);
  });

  it('resets Redis-backed rate limit after the window expires', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({ client, namespace: 'test-storage' });

    client.setNow('2026-03-23T10:00:00.000Z');
    const first = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:00:00.000Z',
    });

    client.setNow('2026-03-23T10:00:30.000Z');
    const blocked = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:00:30.000Z',
    });

    client.setNow('2026-03-23T10:01:01.000Z');
    const afterReset = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:01:01.000Z',
    });

    expect(first.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.count).toBe(1);
  });

  it('isolates data by namespace', async () => {
    const client = createFakeRedisStorageClient();
    const storageA = createRedisStorage({ client, namespace: 'namespace-a' });
    const storageB = createRedisStorage({ client, namespace: 'namespace-b' });

    await storageA.recordUsage(createUsageRecord({ id: 'record-a' }));
    await storageB.recordUsage(createUsageRecord({ id: 'record-b' }));

    const recordsA = await storageA.listUsage();
    const recordsB = await storageB.listUsage();

    expect(recordsA).toHaveLength(1);
    expect(recordsA[0]?.id).toBe('record-a');

    expect(recordsB).toHaveLength(1);
    expect(recordsB[0]?.id).toBe('record-b');
  });

  it('expires usage records when usageRecordTtlSeconds is configured', async () => {
    const client = createFakeRedisStorageClient();
    const storage = createRedisStorage({
      client,
      namespace: 'test-storage',
      usageRecordTtlSeconds: 10,
    });

    client.setNow('2026-03-23T10:00:00.000Z');
    await storage.recordUsage(
      createUsageRecord({ id: 'record-1', timestamp: '2026-03-23T10:00:00.000Z' }),
    );

    client.setNow('2026-03-23T10:00:05.000Z');
    const beforeExpire = await storage.listUsage();

    client.setNow('2026-03-23T10:00:11.000Z');
    const afterExpire = await storage.listUsage();

    expect(beforeExpire).toHaveLength(1);
    expect(afterExpire).toHaveLength(0);
  });
});
