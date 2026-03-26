import { describe, expect, it, vi } from 'vitest';

import { createGuard, MissingPricingEntryError } from '../../src/index.js';

describe('preflight estimation', () => {
  it('returns preflight estimate from guard.run()', async () => {
    const guard = createGuard({
      defaultProjectId: 'app',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => ({ ok: true }),
    );

    expect(result.preflight.providerId).toBe('openai');
    expect(result.preflight.model).toBe('gpt-4o-mini');
    expect(result.preflight.estimatedInputTokens).toBeGreaterThan(0);
    expect(result.preflight.estimatedInputCostUsd).toBeGreaterThan(0);
    expect(result.preflight.estimatedWorstCaseCostUsd).toBeGreaterThan(
      result.preflight.estimatedInputCostUsd,
    );
  });

  it('returns undefined worst-case when maxTokens is missing', async () => {
    const guard = createGuard({
      defaultProjectId: 'app',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        request: 'Hello world',
      },
      async () => ({ ok: true }),
    );

    expect(result.preflight.estimatedWorstCaseCostUsd).toBeUndefined();
  });

  it('throws MissingPricingEntryError when pricing is missing', async () => {
    const guard = createGuard({
      defaultProjectId: 'app',
      pricing: [],
    });

    await expect(
      guard.run(
        { provider: { id: 'openai', model: 'gpt-4o-mini' }, request: 'Hello world' },
        async () => ({ ok: true }),
      ),
    ).rejects.toBeInstanceOf(MissingPricingEntryError);
  });

  it('does not call execute when pricing is missing', async () => {
    const guard = createGuard({
      defaultProjectId: 'app',
      pricing: [],
    });

    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run(
        { provider: { id: 'openai', model: 'gpt-4o-mini' }, request: 'Hello world' },
        execute,
      ),
    ).rejects.toBeInstanceOf(MissingPricingEntryError);

    expect(execute).not.toHaveBeenCalled();
  });

  it('returns preflight breakdown when breakdown parts are provided', async () => {
    const guard = createGuard({
      defaultProjectId: 'app',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
        request: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello world' },
          ],
        },
        breakdown: {
          parts: [
            { key: 'system', content: 'You are a helpful assistant' },
            { key: 'user', content: 'Hello world' },
          ],
        },
      },
      async () => ({ ok: true }),
    );

    expect(result.preflight.breakdown).toBeDefined();
    expect(result.preflight.breakdown?.parts).toHaveLength(2);

    expect(result.preflight.breakdown?.parts[0]?.key).toBe('system');
    expect(result.preflight.breakdown?.parts[0]?.estimatedTokens).toBeGreaterThan(0);
    expect(result.preflight.breakdown?.parts[0]?.estimatedInputCostUsd).toBeGreaterThan(0);

    expect(result.preflight.breakdown?.parts[1]?.key).toBe('user');
    expect(result.preflight.breakdown?.parts[1]?.estimatedTokens).toBeGreaterThan(0);
    expect(result.preflight.breakdown?.parts[1]?.estimatedInputCostUsd).toBeGreaterThan(0);

    expect(result.preflight.breakdown?.attributedEstimatedTokens).toBeGreaterThan(0);
    expect(result.preflight.breakdown?.attributedEstimatedInputCostUsd).toBeGreaterThan(0);
    expect(result.preflight.breakdown?.totalEstimatedInputTokens).toBe(
      result.preflight.estimatedInputTokens,
    );
    expect(result.preflight.breakdown?.unattributedEstimatedTokens).toBeGreaterThanOrEqual(0);
    expect(result.preflight.breakdown?.unattributedEstimatedInputCostUsd).toBeGreaterThanOrEqual(0);
  });
});
