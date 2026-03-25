import { describe, expect, it } from 'vitest';

import { createGuard } from '../src/index.js';

const pricing = [
  {
    providerId: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillionTokens: 0.15,
    outputCostPerMillionTokens: 0.6,
  },
];

const createGuardWithPricing = () => {
  return createGuard({ defaultProjectId: 'app-main', pricing });
};

describe('runtime registry and lazy registration', () => {
  it('registers a project through guard.addProject()', () => {
    const guard = createGuardWithPricing();

    guard.addProject({ projectId: 'app-main', tags: ['prod', 'api'], metadata: { region: 'eu' } });

    expect(guard.hasProject('app-main')).toBe(true);

    const project = guard.config.registry.getProject('app-main');
    expect(project).toBeDefined();
    expect(project?.projectId).toBe('app-main');
    expect(project?.tags).toEqual(['prod', 'api']);
    expect(project?.metadata).toEqual({ region: 'eu' });
  });

  it('throws on duplicate project registration', () => {
    const guard = createGuardWithPricing();

    guard.addProject({ projectId: 'app-main' });

    expect(() => {
      guard.addProject({ projectId: 'app-main' });
    }).toThrow('Duplicate projectId: "app-main"');
  });

  it('registers a provider through guard.addProvider()', () => {
    const guard = createGuardWithPricing();

    guard.addProject({ projectId: 'app-main' });

    guard.addProvider('app-main', {
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai' },
    });

    expect(guard.hasProvider('app-main', 'openai')).toBe(true);

    const provider = guard.config.registry.getProvider('app-main', 'openai');
    expect(provider).toEqual({
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai' },
    });
  });

  it('throws when adding a provider to an unknown project', () => {
    const guard = createGuardWithPricing();

    expect(() => {
      guard.addProvider('app-main', { providerId: 'openai', providerType: 'openai' });
    }).toThrow('Project "app-main" is not registered');
  });

  it('auto-registers project and provider from run() when they are missing', async () => {
    const guard = createGuard({ pricing });

    const result = await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        projectConfig: { projectId: 'app-main', tags: ['prod'], metadata: { region: 'eu' } },
        providerConfig: {
          providerId: 'openai',
          providerType: 'openai',
          metadata: { sdk: 'openai' },
        },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => ({ ok: true }),
    );

    expect(result.decision.allowed).toBe(true);
    expect(guard.hasProject('app-main')).toBe(true);
    expect(guard.hasProvider('app-main', 'openai')).toBe(true);

    const project = guard.config.registry.getProject('app-main');
    const provider = guard.config.registry.getProvider('app-main', 'openai');

    expect(project?.tags).toEqual(['prod']);
    expect(project?.metadata).toEqual({ region: 'eu' });
    expect(provider).toEqual({
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai' },
    });

    expect(result.effectiveConfig.project).toEqual({
      projectId: 'app-main',
      tags: ['prod'],
      metadata: { region: 'eu' },
    });

    expect(result.effectiveConfig.provider).toEqual({
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai' },
    });
  });

  it('does not overwrite existing project and provider during lazy registration', async () => {
    const guard = createGuardWithPricing();

    guard.addProject({ projectId: 'app-main', tags: ['original'], metadata: { region: 'eu' } });

    guard.addProvider('app-main', {
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai-original' },
    });

    await guard.run(
      {
        project: { id: 'app-main' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
        projectConfig: { projectId: 'app-main', tags: ['replacement'], metadata: { region: 'us' } },
        providerConfig: {
          providerId: 'openai',
          providerType: 'custom',
          metadata: { sdk: 'replacement' },
        },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      async () => ({ ok: true }),
    );

    const project = guard.config.registry.getProject('app-main');
    const provider = guard.config.registry.getProvider('app-main', 'openai');

    expect(project?.tags).toEqual(['original']);
    expect(project?.metadata).toEqual({ region: 'eu' });

    expect(provider).toEqual({
      providerId: 'openai',
      providerType: 'openai',
      metadata: { sdk: 'openai-original' },
    });
  });

  it('throws when projectConfig.projectId does not match resolved project id', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          projectConfig: { projectId: 'another-project' },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow(
      'projectConfig.projectId "another-project" must match resolved project id "app-main"',
    );
  });

  it('throws when providerConfig.providerId does not match resolved provider id', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          providerConfig: { providerId: 'anthropic', providerType: 'anthropic' },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow(
      'providerConfig.providerId "anthropic" must match resolved provider id "openai"',
    );
  });

  it('throws when providerConfig is passed but the project is not registered', async () => {
    const guard = createGuard({ pricing });

    await expect(
      guard.run(
        {
          project: { id: 'app-main' },
          provider: { id: 'openai', model: 'gpt-4o-mini' },
          providerConfig: { providerId: 'openai', providerType: 'openai' },
        },
        async () => ({ ok: true }),
      ),
    ).rejects.toThrow(
      'Cannot register provider "openai" because project "app-main" is not registered',
    );
  });

  it('keeps fallback behavior when no registration config is passed', async () => {
    const guard = createGuard({ pricing });

    const result = await guard.run(
      {
        project: { id: 'dynamic-project' },
        provider: { id: 'openai', model: 'gpt-4o-mini' },
      },
      async () => ({ ok: true }),
    );

    expect(result.decision.allowed).toBe(true);
    expect(guard.hasProject('dynamic-project')).toBe(false);
    expect(guard.hasProvider('dynamic-project', 'openai')).toBe(false);

    expect(result.effectiveConfig.project).toEqual({ projectId: 'dynamic-project' });

    expect(result.effectiveConfig.provider).toEqual({
      providerId: 'openai',
      providerType: 'custom',
    });
  });
});
