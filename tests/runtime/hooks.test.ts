import { describe, expect, it, vi } from 'vitest';

import { createGuard, createMemoryStorage, RequestBudgetExceededError } from '../../src/index.js';
import type { CostSpikeDetectedEvent, ExecuteErrorEvent } from '../../src/types/hooks.js';

const createGuardWithPricing = (config: Parameters<typeof createGuard>[0] = {}) => {
  return createGuard({
    defaultProjectId: 'app-main',
    pricing: [
      {
        providerId: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
      },
      {
        providerId: 'openai',
        model: 'gpt-4o',
        inputCostPerMillionTokens: 2.5,
        outputCostPerMillionTokens: 10,
      },
    ],
    ...config,
  });
};

describe('guard hooks', () => {
  it('calls lifecycle hooks in order on successful execution', async () => {
    const calls: string[] = [];

    const guard = createGuardWithPricing({
      hooks: {
        onRunStart: () => {
          calls.push('start');
        },
        onPreflightBuilt: () => {
          calls.push('preflight');
        },
        onPolicyEvaluated: () => {
          calls.push('policy');
        },
        onExecuteSuccess: () => {
          calls.push('success');
        },
        onUsageRecorded: () => {
          calls.push('recorded');
        },
      },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        request: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
      },
    );

    expect(result.result).toEqual({ ok: true });
    expect(calls).toEqual(['start', 'preflight', 'policy', 'success', 'recorded']);
  });

  it('calls onRequestBlocked and onUsageRecorded when blocked', async () => {
    const onRequestBlocked = vi.fn();
    const onUsageRecorded = vi.fn();

    const guard = createGuardWithPricing({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
      hooks: { onRequestBlocked, onUsageRecorded },
    });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o', maxTokens: 4000 },
          request: {
            messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
          },
        },
        async () => {
          return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
        },
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    expect(onRequestBlocked).toHaveBeenCalledTimes(1);
    expect(onUsageRecorded).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestDowngraded when downgrade is applied', async () => {
    const onRequestDowngraded = vi.fn();

    const guard = createGuardWithPricing({
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: {
          onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini', fallbackMaxTokens: 200 },
        },
      },
      hooks: { onRequestDowngraded },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o', maxTokens: 2000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async (context) => {
        return {
          result: { model: context.provider.model, maxTokens: context.provider.maxTokens },
          usage: { inputTokens: 100, outputTokens: 20 },
        };
      },
    );

    expect(onRequestDowngraded).toHaveBeenCalledTimes(1);
    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.context.provider.maxTokens).toBe(200);
  });

  it('calls onExecuteError and rethrows the original error', async () => {
    const onExecuteError = vi.fn<(event: ExecuteErrorEvent) => void>();
    const guard = createGuardWithPricing({ hooks: { onExecuteError } });

    const error = new Error('provider failed');

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
          request: { messages: [{ role: 'user', content: 'Hello' }] },
        },
        async () => {
          throw error;
        },
      ),
    ).rejects.toThrow('provider failed');

    expect(onExecuteError).toHaveBeenCalledTimes(1);
    expect(onExecuteError.mock.calls[0]?.[0].error).toBe(error);
  });

  it('does not break the main flow when a hook throws', async () => {
    const guard = createGuardWithPricing({
      hooks: {
        onPreflightBuilt: () => {
          throw new Error('hook failed');
        },
      },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        request: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
      },
    );

    expect(result.result).toEqual({ ok: true });
  });

  it('calls onCostSpikeDetected when a spike is detected', async () => {
    const storage = createMemoryStorage();
    const onCostSpikeDetected = vi.fn<(event: CostSpikeDetectedEvent) => void>();

    const guard = createGuardWithPricing({
      storage,
      analytics: {
        costSpike: {
          enabled: true,
          minBaselineSamples: 2,
          multiplierThreshold: 2,
          absoluteDeltaUsdThreshold: 0.000001,
        },
      },
      hooks: { onCostSpikeDetected },
    });

    const context = {
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 500 },
      request: { messages: [{ role: 'user', content: 'Hello' }] },
      attribution: { feature: 'chat' },
    };

    await guard.run(context, async () => {
      return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 10 } };
    });

    await guard.run(context, async () => {
      return { result: { ok: true }, usage: { inputTokens: 110, outputTokens: 12 } };
    });

    await guard.run(context, async () => {
      return { result: { ok: true }, usage: { inputTokens: 1500, outputTokens: 500 } };
    });

    expect(onCostSpikeDetected).toHaveBeenCalledTimes(1);
    expect(onCostSpikeDetected.mock.calls[0]?.[0].costSpikeExplanation.detected).toBe(true);
  });
});
