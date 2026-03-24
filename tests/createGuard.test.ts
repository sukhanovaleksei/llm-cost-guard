import { describe, expect, it, vi } from 'vitest';

import {
  createGuard,
  createMemoryStorage,
  MissingModelError,
  MissingProjectIdError,
  MissingProviderIdError,
  RateLimitedError,
  RequestBudgetExceededError,
  type UsageRecord,
} from '../src/index.js';
import type { ResolvedRunContext } from '../src/types/run.js';
import { assertRequestBudgetViolation } from './helpers/assertions.js';

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

const createStoredUsageRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    projectId: 'app-main',
    providerId: 'openai',
    model: 'gpt-4o-mini',
    tags: [],
    metadata: {},
    decision: { allowed: true, blocked: false, action: 'allow', checkedPolicies: [] },
    preflight: {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      estimatedInputTokens: 0,
      estimatedInputCostUsd: 0,
      estimatedWorstCaseCostUsd: 0,
      pricing: {
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
        currency: 'USD',
      },
    },
    actualUsage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      actualInputCostUsd: 0,
      actualOutputCostUsd: 0,
      actualTotalCostUsd: 0.005,
      deltaFromEstimatedInputCostUsd: 0,
      deltaFromEstimatedWorstCaseCostUsd: 0,
    },
    executed: true,
    blocked: false,
    ...overrides,
  };
};

const baseContext = {
  project: { id: 'app-main' },
  provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 500 },
  request: { messages: [{ role: 'user', content: 'Hello world' }] },
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

    const violation = assertRequestBudgetViolation(result.violation);

    expect(violation.limitType).toBe('worst-case');
    expect(violation.configuredLimitUsd).toBe(0.000001);
    expect(typeof violation.actualCostUsd).toBe('number');
    expect(violation.actualCostUsd).toBeGreaterThan(0);
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

  it('returns undefined actualUsage when execute returns plain result', async () => {
    const guard = createGuardWithPricing();

    const response = { id: 'resp_1', content: 'Hello back' };
    const result = await guard.run(baseContext, async () => {
      return response;
    });

    expect(result.result).toEqual(response);
    expect(result.actualUsage).toBeUndefined();
    expect(result.preflight).toBeDefined();
  });

  it('reconciles actual usage when execute returns usage envelope', async () => {
    const guard = createGuardWithPricing();

    const result = await guard.run(baseContext, async () => {
      return {
        result: { id: 'resp_2', content: 'Hello back' },
        usage: { inputTokens: 1000, outputTokens: 250 },
      };
    });

    expect(result.result).toEqual({ id: 'resp_2', content: 'Hello back' });

    expect(result.actualUsage).toBeDefined();
    expect(result.actualUsage?.inputTokens).toBe(1000);
    expect(result.actualUsage?.outputTokens).toBe(250);
    expect(result.actualUsage?.totalTokens).toBe(1250);

    expect(result.actualUsage?.actualInputCostUsd).toBeCloseTo(0.00015, 12);
    expect(result.actualUsage?.actualOutputCostUsd).toBeCloseTo(0.00015, 12);
    expect(result.actualUsage?.actualTotalCostUsd).toBeCloseTo(0.0003, 12);

    expect(typeof result.actualUsage?.deltaFromEstimatedInputCostUsd).toBe('number');
    expect(typeof result.actualUsage?.deltaFromEstimatedWorstCaseCostUsd).toBe('number');
  });

  it('accepts usage with matching totalTokens', async () => {
    const guard = createGuardWithPricing();

    const result = await guard.run(baseContext, async () => {
      return {
        result: { ok: true },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
    });

    expect(result.actualUsage).toBeDefined();
    expect(result.actualUsage?.inputTokens).toBe(100);
    expect(result.actualUsage?.outputTokens).toBe(50);
    expect(result.actualUsage?.totalTokens).toBe(150);

    expect(result.actualUsage?.actualInputCostUsd).toBeCloseTo(0.000015, 12);
    expect(result.actualUsage?.actualOutputCostUsd).toBeCloseTo(0.00003, 12);
    expect(result.actualUsage?.actualTotalCostUsd).toBeCloseTo(0.000045, 12);
  });

  it('throws when usage.totalTokens does not match inputTokens plus outputTokens', async () => {
    const guard = createGuardWithPricing();

    await expect(
      guard.run(baseContext, async () => {
        return {
          result: { ok: true },
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 999 },
        };
      }),
    ).rejects.toMatchObject({ code: 'INVALID_USAGE_PAYLOAD' });
  });

  it.each([-1, 1.5, Number.NaN])(
    'throws when usage.inputTokens is invalid: %s',
    async (inputTokens) => {
      const guard = createGuardWithPricing();

      await expect(
        guard.run(baseContext, async () => {
          return { result: { ok: true }, usage: { inputTokens, outputTokens: 50 } };
        }),
      ).rejects.toMatchObject({ code: 'INVALID_USAGE_PAYLOAD' });
    },
  );

  it.each([-1, 1.25, Number.NaN])(
    'throws when usage.outputTokens is invalid: %s',
    async (outputTokens) => {
      const guard = createGuardWithPricing();

      await expect(
        guard.run(baseContext, async () => {
          return { result: { ok: true }, usage: { inputTokens: 100, outputTokens } };
        }),
      ).rejects.toMatchObject({ code: 'INVALID_USAGE_PAYLOAD' });
    },
  );

  it('throws when usage object is empty', async () => {
    const guard = createGuardWithPricing();

    await expect(
      guard.run(baseContext, async () => {
        return { result: { ok: true }, usage: {} };
      }),
    ).rejects.toMatchObject({ code: 'INVALID_USAGE_PAYLOAD' });
  });

  it('does not call execute when request is blocked by policy', async () => {
    const execute = vi.fn(async () => {
      return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } };
    });

    const guard = createGuardWithPricing({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    await expect(guard.run(baseContext, execute)).rejects.toBeInstanceOf(
      RequestBudgetExceededError,
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('throws when only usage.totalTokens is provided without inputTokens and outputTokens', async () => {
    const guard = createGuardWithPricing();

    await expect(
      guard.run(baseContext, async () => {
        return { result: { ok: true }, usage: { totalTokens: 500 } };
      }),
    ).rejects.toMatchObject({ code: 'INVALID_USAGE_PAYLOAD' });
  });

  it('keeps preflight data when actual usage is returned', async () => {
    const guard = createGuardWithPricing();

    const result = await guard.run(baseContext, async () => {
      return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
    });

    expect(result.preflight).toBeDefined();
    expect(typeof result.preflight.estimatedInputTokens).toBe('number');
    expect(typeof result.preflight.estimatedInputCostUsd).toBe('number');
    expect(typeof result.preflight.estimatedWorstCaseCostUsd).toBe('number');

    expect(result.actualUsage).toBeDefined();
  });

  it('records successful run into storage with effective tags and metadata', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      storage,
      defaults: { request: { metadata: { source: 'default' } } },
      projects: [
        {
          projectId: 'app-main',
          tags: ['project-tag'],
          providers: [
            { providerId: 'openai', providerType: 'openai', metadata: { sdk: 'openai' } },
          ],
        },
      ],
    });

    await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 500 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
        user: { id: 'user-1' },
        attribution: { feature: 'chat', endpoint: '/api/chat' },
        metadata: { requestId: 'req-1' },
        overrides: { tags: ['override-tag'], metadata: { env: 'prod' } },
      },
      async () => ({ ok: true }),
    );

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      projectId: 'app-main',
      providerId: 'openai',
      model: 'gpt-4o-mini',
      userId: 'user-1',
      feature: 'chat',
      endpoint: '/api/chat',
      tags: ['override-tag'],
      metadata: { source: 'default', sdk: 'openai', requestId: 'req-1', env: 'prod' },
      executed: true,
      blocked: false,
    });
  });

  it('records actual usage into storage when execute returns usage envelope', async () => {
    const storage = createMemoryStorage();
    const guard = createGuardWithPricing({ storage });

    await guard.run(baseContext, async () => {
      return {
        result: { ok: true },
        usage: { inputTokens: 1000, outputTokens: 250 },
      };
    });

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.actualUsage).toBeDefined();
    expect(records[0]?.actualUsage?.inputTokens).toBe(1000);
    expect(records[0]?.actualUsage?.outputTokens).toBe(250);
    expect(records[0]?.actualUsage?.totalTokens).toBe(1250);
  });

  it('records blocked request into storage in soft mode', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricingAndPolicies({
      storage,
      mode: 'soft',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      execute,
    );

    const records = await storage.listUsage();

    expect(execute).not.toHaveBeenCalled();
    expect(records).toHaveLength(1);
    expect(records[0]?.executed).toBe(false);
    expect(records[0]?.blocked).toBe(true);
    expect(records[0]?.violation).toBeDefined();
    expect(records[0]?.decision.reasonCode).toBe('REQUEST_BUDGET_EXCEEDED');
  });

  it('records blocked request into storage before throwing in hard mode', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricingAndPolicies({
      storage,
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
          request: {
            messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
          },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.executed).toBe(false);
    expect(records[0]?.blocked).toBe(true);
    expect(records[0]?.violation).toBeDefined();
  });

  it('blocks request when global daily budget would be exceeded', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(
      createStoredUsageRecord({
        actualUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          actualInputCostUsd: 0,
          actualOutputCostUsd: 0,
          actualTotalCostUsd: 0.005,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: 0,
        },
      }),
    );

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      storage,
      policies: { aggregateBudget: { dailyUsd: 0.01 } },
    });

    await expect(
      guard.run(
        { provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 10000 } },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow('Aggregate budget exceeded');
  });

  it('blocks request when per-user daily budget would be exceeded', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(
      createStoredUsageRecord({
        userId: 'user-1',
        actualUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          actualInputCostUsd: 0,
          actualOutputCostUsd: 0,
          actualTotalCostUsd: 0.005,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: 0,
        },
      }),
    );

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      storage,
      policies: { aggregateBudget: { perUserDailyUsd: 0.01 } },
    });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 10000 },
          user: { id: 'user-1' },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow();
  });

  it('returns blocked decision in soft mode without calling execute for aggregate budget', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(createStoredUsageRecord());

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'soft',
      storage,
      policies: { aggregateBudget: { dailyUsd: 0.001 } },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 10000 } },
      execute,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.decision.blocked).toBe(true);
    expect(result.violation?.type).toBe('aggregate-budget');
  });

  it('does not count blocked records into actual spend summary', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(
      createStoredUsageRecord({ blocked: true, executed: false, actualUsage: undefined }),
    );

    const summary = await storage.getSpendSummary();

    expect(summary.actualTotalCostUsd).toBe(0);
    expect(summary.blockedCount).toBe(1);
  });

  it('checks provider monthly budget within project scope', async () => {
    const storage = createMemoryStorage();

    await storage.recordUsage(
      createStoredUsageRecord({
        projectId: 'app-main',
        providerId: 'openai',
        actualUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          actualInputCostUsd: 0,
          actualOutputCostUsd: 0,
          actualTotalCostUsd: 0.005,
          deltaFromEstimatedInputCostUsd: 0,
          deltaFromEstimatedWorstCaseCostUsd: 0,
        },
      }),
    );

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      storage,
      policies: { aggregateBudget: { perProviderMonthlyUsd: 0.01 } },
    });

    await expect(
      guard.run(
        {
          project: { id: 'app-main' },
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 10000 },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow();
  });

  it('throws RateLimitedError in hard mode when global requests per minute limit is exceeded', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'hard',
      storage,
      policies: { rateLimit: { requestsPerMinute: 1 } },
    });

    await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({
      ok: true,
    }));

    await expect(
      guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({ ok: true })),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('returns blocked decision in soft mode without calling execute when rate limited', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'soft',
      storage,
      policies: { rateLimit: { requestsPerMinute: 1 } },
    });

    await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({
      ok: true,
    }));

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, execute);

    expect(execute).not.toHaveBeenCalled();
    expect(result.result).toBeUndefined();
    expect(result.decision.allowed).toBe(false);
    expect(result.decision.blocked).toBe(true);
    expect(result.decision.reasonCode).toBe('RATE_LIMITED');
    expect(result.violation?.type).toBe('rate-limit');
  });

  it('applies per-user requests per minute independently for each user', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'soft',
      storage,
      policies: { rateLimit: { perUserRequestsPerMinute: 1 } },
    });

    const firstUserFirstCall = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' }, user: { id: 'user-1' } },
      async () => ({ ok: true }),
    );

    const firstUserSecondCall = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' }, user: { id: 'user-1' } },
      async () => ({ ok: true }),
    );

    const secondUserFirstCall = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' }, user: { id: 'user-2' } },
      async () => ({ ok: true }),
    );

    expect(firstUserFirstCall.decision.allowed).toBe(true);
    expect(firstUserSecondCall.decision.blocked).toBe(true);
    expect(secondUserFirstCall.decision.allowed).toBe(true);
  });

  it('records blocked rate-limited request into storage', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'soft',
      storage,
      policies: { rateLimit: { requestsPerMinute: 1 } },
    });

    await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({
      ok: true,
    }));

    await guard.run({ provider: { id: 'openai', model: 'gpt-4o-mini' } }, async () => ({
      ok: true,
    }));

    const records = await storage.listUsage();

    expect(records).toHaveLength(2);
    expect(records[1]?.executed).toBe(false);
    expect(records[1]?.blocked).toBe(true);
    expect(records[1]?.decision.reasonCode).toBe('RATE_LIMITED');
    expect(records[1]?.violation?.type).toBe('rate-limit');
  });

  it('does not consume rate limit slot when request is blocked by budget policy first', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricing({
      defaultProjectId: 'app-main',
      mode: 'soft',
      storage,
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 },
        rateLimit: { requestsPerMinute: 1 },
      },
    });

    const blockedByBudget = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Explain distributed systems in depth' }] },
      },
      async () => ({ ok: true }),
    );

    const nextAllowed = await guard.run(
      { provider: { id: 'openai', model: 'gpt-4o-mini' } },
      async () => ({ ok: true }),
    );

    expect(blockedByBudget.decision.reasonCode).toBe('REQUEST_BUDGET_EXCEEDED');
    expect(nextAllowed.decision.allowed).toBe(true);
  });

  it('persists preflight breakdown into storage', async () => {
    const storage = createMemoryStorage();
    const guard = createGuardWithPricing({ storage });

    await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 500 },
        request: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Explain queues in Node.js' },
          ],
        },
        breakdown: {
          parts: [
            { key: 'system', content: 'You are a helpful assistant' },
            { key: 'user', content: 'Explain queues in Node.js' },
          ],
        },
      },
      async () => ({ ok: true }),
    );

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.preflight.breakdown).toBeDefined();
    expect(records[0]?.preflight.breakdown?.parts).toHaveLength(2);
    expect(records[0]?.preflight.breakdown?.parts[0]?.key).toBe('system');
    expect(records[0]?.preflight.breakdown?.parts[1]?.key).toBe('user');
  });

  it('persists preflight breakdown for blocked request in soft mode', async () => {
    const storage = createMemoryStorage();

    const guard = createGuardWithPricingAndPolicies({
      storage,
      mode: 'soft',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1000 },
        request: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Explain distributed systems in depth' },
          ],
        },
        breakdown: {
          parts: [
            { key: 'system', content: 'You are a helpful assistant' },
            { key: 'user', content: 'Explain distributed systems in depth' },
          ],
        },
      },
      async () => ({ ok: true }),
    );

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.executed).toBe(false);
    expect(records[0]?.blocked).toBe(true);
    expect(records[0]?.preflight.breakdown).toBeDefined();
    expect(records[0]?.preflight.breakdown?.parts).toHaveLength(2);
  });

  it('throws when breakdown part key is empty after trim', async () => {
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

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          request: 'Hello world',
          breakdown: { parts: [{ key: '   ', content: 'Hello world' }] },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_BREAKDOWN_PART' });
  });

  it('downgrades model when request budget is exceeded and fallbackModel fits the budget', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: { onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini' } },
      },
    });

    const execute = vi.fn(async (context: ResolvedRunContext) => {
      return { ok: true, model: context.provider.model };
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      execute,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].provider.model).toBe('gpt-4o-mini');

    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.decision.allowed).toBe(true);
    expect(result.decision.blocked).toBe(false);
    expect(result.decision.action).toBe('downgrade');

    expect(result.appliedDowngrade).toEqual({
      reason: 'request-budget',
      originalProviderId: 'openai',
      effectiveProviderId: 'openai',
      originalModel: 'gpt-4o',
      effectiveModel: 'gpt-4o-mini',
      originalMaxTokens: 1000,
      effectiveMaxTokens: 1000,
    });
  });

  it('reduces maxTokens when request budget is exceeded and fallbackMaxTokens fits the budget', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'custom-provider',
          model: 'x1',
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 1,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: { onRequestBudgetExceeded: { fallbackMaxTokens: 500 } },
      },
    });

    const execute = vi.fn(async (context: ResolvedRunContext) => {
      return { ok: true, maxTokens: context.provider.maxTokens };
    });

    const result = await guard.run(
      {
        provider: { id: 'custom-provider', model: 'x1', maxTokens: 2000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      execute,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].provider.maxTokens).toBe(500);

    expect(result.context.provider.maxTokens).toBe(500);
    expect(result.decision.action).toBe('downgrade');
    expect(result.appliedDowngrade).toEqual({
      reason: 'request-budget',
      originalProviderId: 'custom-provider',
      effectiveProviderId: 'custom-provider',
      originalModel: 'x1',
      effectiveModel: 'x1',
      originalMaxTokens: 2000,
      effectiveMaxTokens: 500,
    });
  });

  it('blocks request when downgrade policy exists but downgraded request is still over budget', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      mode: 'soft',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: {
        requestBudget: {
          maxEstimatedWorstCaseCostUsd: 0.00001,
        },
        downgrade: {
          onRequestBudgetExceeded: {
            fallbackModel: 'gpt-4o-mini',
            fallbackMaxTokens: 800,
          },
        },
      },
    });

    const execute = vi.fn(async () => ({ ok: true }));

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o', maxTokens: 2000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      execute,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(result.decision.blocked).toBe(true);
    expect(result.decision.reasonCode).toBe('REQUEST_BUDGET_EXCEEDED');
    expect(result.appliedDowngrade).toBeUndefined();
  });

  it('persists appliedDowngrade into storage for successful downgraded request', async () => {
    const storage = createMemoryStorage();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      storage,
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: { onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini' } },
      },
    });

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => ({ ok: true }),
    );

    const records = await storage.listUsage();

    expect(records).toHaveLength(1);
    expect(records[0]?.appliedDowngrade).toEqual({
      reason: 'request-budget',
      originalProviderId: 'openai',
      effectiveProviderId: 'openai',
      originalModel: 'gpt-4o',
      effectiveModel: 'gpt-4o-mini',
      originalMaxTokens: 1000,
      effectiveMaxTokens: 1000,
    });
  });

  it('calculates actual usage cost using downgraded model pricing', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: { onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini' } },
      },
    });

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o', maxTokens: 1000 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 1000, outputTokens: 100 } };
      },
    );

    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.actualUsage?.actualInputCostUsd).toBeCloseTo(0.00015, 12);
    expect(result.actualUsage?.actualOutputCostUsd).toBeCloseTo(0.00006, 12);
    expect(result.actualUsage?.actualTotalCostUsd).toBeCloseTo(0.00021, 12);
  });
});
