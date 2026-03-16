import { describe, expect, it, vi } from 'vitest';

import {
  createGuard,
  MissingModelError,
  MissingProjectIdError,
  MissingProviderIdError,
  RequestBudgetExceededError,
} from '../src/index.js';

const createGuardWithPricing = (config: Parameters<typeof createGuard>[0] = {}) => {
  return createGuard({
    pricing: [
      {
        providerId: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
      },
      {
        providerId: 'custom-provider',
        model: 'x1',
        inputCostPerMillionTokens: 1,
        outputCostPerMillionTokens: 2,
      },
      {
        providerId: 'unknown-provider',
        model: 'x1',
        inputCostPerMillionTokens: 1,
        outputCostPerMillionTokens: 2,
      },
    ],
    ...config,
  });
};

const createGuardWithPricingAndPolicies = (config: Parameters<typeof createGuard>[0] = {}) => {
  return createGuardWithPricing({ defaultProjectId: 'app-main', ...config });
};

describe('createGuard', () => {
  it('creates guard with default hard mode', () => {
    const guard = createGuard();
    expect(guard.config.mode).toBe('hard');
  });

  it('uses provided mode', () => {
    const guard = createGuard({ mode: 'soft' });
    expect(guard.config.mode).toBe('soft');
  });

  it('uses context.project.id when provided', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'default-project' });
    const result = await guard.run(
      {
        project: { id: 'request-project' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async () => ({ ok: true }),
    );

    expect(result.context).toEqual({
      project: { id: 'request-project' },
      provider: { id: 'openai', model: 'gpt-4o-mini' },
      attribution: { tags: [] },
      metadata: {},
      request: undefined,
    });
  });

  it('uses config.defaultProjectId when context.project.id is missing', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'app-main' });

    const result = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' } },
      async () => ({ ok: true }),
    );

    expect(result.result).toEqual({ ok: true });
    expect(result.context).toEqual({
      project: { id: 'app-main' },
      provider: { id: 'openai', model: 'gpt-4o-mini' },
      attribution: { tags: [] },
      metadata: {},
      request: undefined,
    });
    expect(result.decision.allowed).toBe(true);
  });

  it('throws MissingProjectIdError when neither context.project.id nor config.defaultProjectId is provided', async () => {
    const guard = createGuard();

    await expect(
      guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(MissingProjectIdError);
  });

  it('throws MissingProviderIdError when providerId is missing', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main' });

    await expect(
      guard.run({ provider: { model: 'gpt-4o-mini' } }, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it('throws MissingProviderIdError when providerId is empty string', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main' });

    await expect(
      guard.run({ provider: { id: '   ', model: 'gpt-4o-mini' } }, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(MissingProviderIdError);
  });

  it('throws MissingModelError when model is empty string', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main' });

    await expect(
      guard.run({ provider: { id: 'openai', model: '   ' } }, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(MissingModelError);
  });

  it('does not call execute when run context validation fails', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main' });
    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run({ provider: { id: '', model: 'gpt-4o-mini' } }, execute),
    ).rejects.toBeInstanceOf(MissingProviderIdError);

    expect(execute).not.toHaveBeenCalled();
  });

  it('calls execute exactly once for valid context', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'app-main' });
    const execute = vi.fn(async () => ({ ok: true }));

    await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, execute);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('returns allowed decision and resolved context for successful execution', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'app-main' });

    const result = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' } },
      async () => ({ text: 'hello' }),
    );

    expect(result.result).toEqual({ text: 'hello' });

    expect(result.context).toEqual({
      project: { id: 'app-main' },
      provider: { id: 'openai', model: 'gpt-4o-mini' },
      attribution: { tags: [] },
      metadata: {},
      request: undefined,
    });

    expect(result.decision).toEqual({
      allowed: true,
      blocked: false,
      action: 'allow',
      checkedPolicies: [],
    });

    expect(result.effectiveConfig).toEqual({
      mode: 'hard',
      project: { projectId: 'app-main' },
      provider: { providerId: 'openai', providerType: 'custom' },
      request: {
        tags: [],
        metadata: {},
      },
    });

    expect(result.preflight.providerId).toBe('openai');
    expect(result.preflight.model).toBe('gpt-4o-mini');
    expect(result.preflight.estimatedInputTokens).toBe(0);
    expect(result.preflight.estimatedInputCostUsd).toBe(0);
    expect(result.preflight.estimatedWorstCaseCostUsd).toBeUndefined();
  });

  it('resolves nested context and calls execute', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'default-project' });
    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async (context) => {
        expect(context).toEqual({
          project: { id: 'default-project' },
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          attribution: { tags: [] },
          metadata: {},
        });

        return 'ok';
      },
    );

    expect(result.result).toBe('ok');
    expect(result.decision.allowed).toBe(true);
  });

  it('prefers context project.id over defaultProjectId', async () => {
    const guard = createGuardWithPricing({ defaultProjectId: 'default-project' });
    const result = await guard.run(
      {
        project: { id: 'project-1' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async (context) => context.project.id,
    );

    expect(result.result).toBe('project-1');
  });

  it('trims nested string fields', async () => {
    const guard = createGuardWithPricing();
    const result = await guard.run(
      {
        project: { id: '  app-1  ' },
        provider: { id: '  openai  ', model: '  gpt-4o-mini  ' },
        user: { id: '  user-1  ' },
        attribution: { feature: '  chat  ', endpoint: '  /api/chat  ' },
      },
      async (context) => context,
    );

    expect(result.context).toEqual({
      project: { id: 'app-1' },
      provider: { id: 'openai', model: 'gpt-4o-mini' },
      user: { id: 'user-1' },
      attribution: { feature: 'chat', endpoint: '/api/chat', tags: [] },
      metadata: {},
    });
  });

  it('normalizes and deduplicates tags', async () => {
    const guard = createGuardWithPricing();
    const result = await guard.run(
      {
        project: { id: 'p1' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        attribution: {
          tags: [' chat ', '', 'prod', 'chat', 'prod', '  '],
        },
      },
      async (context) => context,
    );

    expect(result.context.attribution.tags).toEqual(['chat', 'prod']);
  });

  it('keeps only primitive metadata values', async () => {
    const guard = createGuardWithPricing();
    const result = await guard.run(
      {
        project: { id: 'p1' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        metadata: {
          env: 'prod',
          retries: 2,
          cached: true,
          nested: { bad: true } as unknown as boolean,
        },
      },
      async (context) => context,
    );

    expect(result.context.metadata).toEqual({
      env: 'prod',
      retries: 2,
      cached: true,
    });
  });

  it('accepts valid provider.maxTokens', async () => {
    const guard = createGuardWithPricing();
    const result = await guard.run(
      {
        project: { id: 'p1' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 512 },
      },
      async (context) => context,
    );

    expect(result.context.provider.maxTokens).toBe(512);
  });

  it('throws on invalid provider.maxTokens', async () => {
    const guard = createGuard();

    await expect(
      guard.run(
        {
          project: { id: 'p1' },
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 0 },
        },
        async () => 'ok',
      ),
    ).rejects.toThrow('provider.maxTokens must be a positive integer');
  });

  it('does not call execute when provider.maxTokens is invalid', async () => {
    const guard = createGuard();
    const execute = vi.fn();

    await expect(
      guard.run(
        {
          project: { id: 'p1' },
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: -1 },
        },
        execute,
      ),
    ).rejects.toThrow();

    expect(execute).not.toHaveBeenCalled();
  });

  it('creates registry from projects and providers', () => {
    const guard = createGuard({
      projects: [
        {
          projectId: 'app-main',
          tags: ['prod'],
          providers: [{ providerId: 'openai', providerType: 'openai' }],
        },
      ],
    });

    expect(guard.config.registry.hasProject('app-main')).toBe(true);
    expect(guard.config.registry.hasProvider('app-main', 'openai')).toBe(true);
  });

  it('returns effectiveConfig from run() using provider from project scope', async () => {
    const guard = createGuardWithPricing({
      projects: [
        {
          projectId: 'app-main',
          tags: ['prod'],
          providers: [{ providerId: 'openai', providerType: 'openai' }],
        },
      ],
    });

    const result = await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async () => ({ ok: true }),
    );

    expect(result.effectiveConfig).toEqual({
      mode: 'hard',
      project: {
        projectId: 'app-main',
        tags: ['prod'],
      },
      provider: {
        providerId: 'openai',
        providerType: 'openai',
      },
      request: {
        tags: ['prod'],
        metadata: {},
      },
    });
  });

  it('falls back to inferred project/provider config when registry entries are missing', async () => {
    const guard = createGuardWithPricing();

    const result = await guard.run(
      {
        project: { id: 'p1' },
        provider: { id: 'custom-provider', model: 'x1' },
      },
      async () => 'ok',
    );

    expect(result.effectiveConfig.project).toEqual({
      projectId: 'p1',
    });

    expect(result.effectiveConfig.provider).toEqual({
      providerId: 'custom-provider',
      providerType: 'custom',
    });
  });

  it('prefers request overrides.tags over project tags and defaults', async () => {
    const guard = createGuardWithPricing({
      defaults: {
        request: {},
      },
      projects: [{ projectId: 'app-main', tags: ['project-tag'] }],
    });

    const result = await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        overrides: {
          tags: ['override-tag', 'prod'],
        },
      },
      async () => 'ok',
    );

    expect(result.effectiveConfig.request.tags).toEqual(['override-tag', 'prod']);
  });

  it('merges request metadata from defaults, registry entries, resolved context metadata and overrides', async () => {
    const guard = createGuardWithPricing({
      defaults: {
        request: {
          metadata: { source: 'default', env: 'dev' },
        },
      },
      projects: [
        {
          projectId: 'app-main',
          metadata: { env: 'project', region: 'eu' },
          providers: [
            {
              providerId: 'openai',
              providerType: 'openai',
              metadata: { sdk: 'openai', env: 'provider' },
            },
          ],
        },
      ],
    });

    const result = await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        metadata: { requestId: 'req-1', env: 'context' },
        overrides: {
          metadata: { env: 'override', tenant: 'acme' },
        },
      },
      async () => 'ok',
    );

    expect(result.effectiveConfig.request.metadata).toEqual({
      source: 'default',
      env: 'override',
      region: 'eu',
      sdk: 'openai',
      requestId: 'req-1',
      tenant: 'acme',
    });
  });

  it('resolves providers by project scope, even with the same providerId', async () => {
    const guard = createGuardWithPricing({
      projects: [
        {
          projectId: 'project-a',
          providers: [
            {
              providerId: 'openai',
              providerType: 'openai',
              metadata: { tier: 'cheap' },
            },
          ],
        },
        {
          projectId: 'project-b',
          providers: [
            {
              providerId: 'openai',
              providerType: 'openai',
              metadata: { tier: 'premium' },
            },
          ],
        },
      ],
    });

    const resultA = await guard.run(
      {
        project: { id: 'project-a' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async () => 'a',
    );

    const resultB = await guard.run(
      {
        project: { id: 'project-b' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async () => 'b',
    );

    expect(resultA.effectiveConfig.provider.metadata).toEqual({ tier: 'cheap' });
    expect(resultB.effectiveConfig.provider.metadata).toEqual({ tier: 'premium' });
  });

  it('falls back to custom provider config when provider is not registered inside the project', async () => {
    const guard = createGuardWithPricing({
      projects: [{ projectId: 'app-main' }],
    });

    const result = await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'unknown-provider', model: 'x1' },
      },
      async () => 'ok',
    );

    expect(result.effectiveConfig.provider).toEqual({
      providerId: 'unknown-provider',
      providerType: 'custom',
    });
  });

  it('throws when the same providerId is defined twice inside one project', () => {
    expect(() =>
      createGuard({
        projects: [
          {
            projectId: 'app-main',
            providers: [
              { providerId: 'openai', providerType: 'openai' },
              { providerId: 'openai', providerType: 'custom' },
            ],
          },
        ],
      }),
    ).toThrow('Duplicate providerId "openai" in project "app-main"');
  });

  it('allows execution when estimated worst-case cost is within request budget', async () => {
    let executeCalled = false;

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
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 1 } },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 100 },
        request: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      async () => {
        executeCalled = true;
        return { ok: true };
      },
    );

    expect(executeCalled).toBe(true);
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
    expect(result.decision.action).toBe('allow');
  });

  it('blocks in hard mode when estimated worst-case cost exceeds request budget limit', async () => {
    const guard = createGuardWithPricingAndPolicies({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
          request: {
            messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
          },
        },
        execute,
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    expect(execute).not.toHaveBeenCalled();
  });

  it('blocks in hard mode when estimated input cost exceeds request input budget limit', async () => {
    const guard = createGuardWithPricingAndPolicies({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedInputCostUsd: 0.0000001 } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          request: {
            messages: [
              {
                role: 'user',
                content:
                  'This is a deliberately long prompt intended to create enough input tokens to exceed a very tiny configured input budget limit.',
              },
            ],
          },
        },
        execute,
      ),
    ).rejects.toMatchObject({
      name: 'RequestBudgetExceededError',
      limitType: 'input',
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it('returns blocked decision in soft mode without throwing and does not call execute', async () => {
    const guard = createGuardWithPricingAndPolicies({
      mode: 'soft',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      execute,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.blocked).toBe(true);
    expect(result.decision.action).toBe('block');
    expect(result.decision.reasonCode).toBe('REQUEST_BUDGET_EXCEEDED');
    expect(typeof result.decision.reasonMessage).toBe('string');
    expect(result.decision.reasonMessage?.length).toBeGreaterThan(0);
    expect(result.decision.checkedPolicies).toEqual(['requestBudget']);

    expect(result.violation).toBeDefined();
    expect(result.violation?.limitType).toBe('worst-case');
    expect(result.violation?.configuredLimitUsd).toBe(0.000001);
    expect(typeof result.violation?.actualCostUsd).toBe('number');
    expect(result.violation?.actualCostUsd).toBeGreaterThan(0);
  });

  it('keeps previous behavior when no policies are configured', async () => {
    const guard = createGuardWithPricingAndPolicies({ policies: undefined });

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      execute,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual({ ok: true });
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
    expect(result.decision.action).toBe('allow');
  });

  it('allows request when estimated cost is exactly equal to the configured limit', async () => {
    const baselineGuard = createGuardWithPricingAndPolicies();

    const baselineResult = await baselineGuard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      async () => ({ ok: true }),
    );

    const exactLimit = baselineResult.preflight.estimatedWorstCaseCostUsd;

    const guard = createGuardWithPricingAndPolicies({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: exactLimit } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      execute,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
  });

  it('ignores invalid request budget policy values during config resolution', () => {
    const guard = createGuardWithPricing({
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: -1, maxEstimatedInputCostUsd: 0 },
      },
    });

    expect(guard.config.policies.requestBudget).toBeUndefined();
  });
});
