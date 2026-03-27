import { describe, expect, it } from 'vitest';

import type { UsageRecord } from '../../src/index.js';
import { createMemoryStorage } from '../../src/index.js';

const createUsageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => {
  return {
    id: 'record-1',
    runId: 'run-1',
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

describe('createMemoryStorage', () => {
  it('aggregates spend summary across records', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-1',
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
        providerId: 'anthropic',
        model: 'claude-3-5-haiku',
        preflight: {
          providerId: 'anthropic',
          model: 'claude-3-5-haiku',
          estimatedInputTokens: 200,
          estimatedInputCostUsd: 0.002,
          estimatedWorstCaseCostUsd: 0.006,
          pricing: { inputCostPerMillionTokens: 2, outputCostPerMillionTokens: 4, currency: 'USD' },
        },
        actualUsage: {
          inputTokens: 200,
          outputTokens: 25,
          totalTokens: 225,
          actualInputCostUsd: 0.002,
          actualOutputCostUsd: 0.001,
          actualTotalCostUsd: 0.003,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: -0.003,
        },
      }),
    );

    await storage.recordUsage(
      createUsageRecord({
        id: 'record-3',
        providerId: 'openai',
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
    );

    const summary = await storage.getSpendSummary();

    expect(summary).toEqual({
      requestCount: 3,
      executedCount: 2,
      blockedCount: 1,
      estimatedInputCostUsd: 0.004,
      estimatedWorstCaseCostUsd: 0.016,
      actualTotalCostUsd: 0.006,
    });
  });

  it('filters summary by providerId', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(createUsageRecord({ id: 'record-1', providerId: 'openai' }));
    await storage.recordUsage(createUsageRecord({ id: 'record-2', providerId: 'anthropic' }));

    const summary = await storage.getSpendSummary({ providerId: 'openai' });

    expect(summary.requestCount).toBe(1);
    expect(summary.executedCount).toBe(1);
    expect(summary.blockedCount).toBe(0);
  });

  it('allows requests until limit is reached and blocks the next one', async () => {
    const storage = createMemoryStorage();

    const first = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 2,
      windowMs: 60_000,
      now: '2026-03-23T10:00:00.000Z',
    });

    const second = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 2,
      windowMs: 60_000,
      now: '2026-03-23T10:00:10.000Z',
    });

    const third = await storage.checkAndIncrementRateLimit({
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
    expect(third.count).toBe(2);
    expect(third.remaining).toBe(0);
  });

  it('resets rate limit window after expiration', async () => {
    const storage = createMemoryStorage();

    await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:00:00.000Z',
    });

    const blocked = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:00:30.000Z',
    });

    const afterReset = await storage.checkAndIncrementRateLimit({
      key: 'rl:global:rpm',
      limit: 1,
      windowMs: 60_000,
      now: '2026-03-23T10:01:01.000Z',
    });

    expect(blocked.allowed).toBe(false);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.count).toBe(1);
  });
});
