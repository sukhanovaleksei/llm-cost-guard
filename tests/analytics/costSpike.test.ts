import { describe, expect, it } from 'vitest';

import { createGuard, createMemoryStorage } from '../../src/index.js';

describe('cost spike explanation', () => {
  it('returns undefined when cost spike analytics is disabled', async () => {
    const storage = createMemoryStorage();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      analytics: { costSpike: { enabled: false } },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } }),
    );

    expect(result.costSpikeExplanation).toBeUndefined();
  });

  it('returns undefined when baseline sample size is below threshold', async () => {
    const storage = createMemoryStorage();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      analytics: { costSpike: { enabled: true, minBaselineSamples: 3 } },
    });

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'seed request' }] },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } }),
    );

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'current request' }] },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 110, outputTokens: 40 } }),
    );

    expect(result.costSpikeExplanation).toBeUndefined();
  });

  it('detects a cost spike when current request is much more expensive than baseline', async () => {
    const storage = createMemoryStorage();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      analytics: {
        costSpike: {
          enabled: true,
          minBaselineSamples: 3,
          multiplierThreshold: 3,
          absoluteDeltaUsdThreshold: 0.0001,
        },
      },
    });

    for (let index = 0; index < 3; index += 1) {
      await guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          request: { messages: [{ role: 'user', content: `seed ${index}` }] },
        },
        async () => ({ result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } }),
      );
    }

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'very expensive request' }] },
        breakdown: {
          parts: [
            { key: 'user', content: 'very expensive request' },
            {
              key: 'retrieval',
              content: 'large retrieval context large retrieval context large retrieval context',
            },
          ],
        },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 1500, outputTokens: 900 } }),
    );

    expect(result.costSpikeExplanation).toBeDefined();
    expect(result.costSpikeExplanation?.detected).toBe(true);
    expect(result.costSpikeExplanation?.sampleCount).toBe(3);
    expect(result.costSpikeExplanation?.topDrivers.length).toBeGreaterThan(0);
  });

  it('does not include blocked records into baseline selection', async () => {
    const storage = createMemoryStorage();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
      analytics: {
        costSpike: {
          enabled: true,
          minBaselineSamples: 2,
          absoluteDeltaUsdThreshold: 0.0001,
          multiplierThreshold: 2,
        },
      },
      mode: 'soft',
    });

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: {
          messages: [{ role: 'user', content: 'this should be blocked by request budget' }],
        },
      },
      async () => ({ ok: true }),
    );

    const baselineGuard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      analytics: {
        costSpike: {
          enabled: true,
          minBaselineSamples: 2,
          absoluteDeltaUsdThreshold: 0.0001,
          multiplierThreshold: 2,
        },
      },
    });

    await baselineGuard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'seed 1' }] },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } }),
    );

    const result = await baselineGuard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: { messages: [{ role: 'user', content: 'seed 2' }] },
      },
      async () => ({ result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } }),
    );

    expect(result.costSpikeExplanation).toBeUndefined();
  });
});
