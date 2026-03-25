import type { ProjectConfig, ProviderConfig, ResolvedGuardConfig } from '../types/config.js';
import type { EffectiveRunConfig, ResolvedRunContext, RunContext } from '../types/run.js';
import { normalizeMetadata, normalizeStringArray } from '../utils/normalize.js';
import { resolveEffectiveLimits } from './resolveEffectiveLimits.js';

const resolveProjectConfig = (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
): ProjectConfig => {
  const registeredProject = config.registry.getProject(context.project.id);

  if (registeredProject)
    return {
      projectId: registeredProject.projectId,
      metadata: registeredProject.metadata,
      tags: registeredProject.tags,
      defaultProviderId: registeredProject.defaultProviderId,
      limits: registeredProject.limits,
    } as ProjectConfig;

  return { projectId: context.project.id };
};

const resolveProviderConfig = (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
): ProviderConfig => {
  const registeredProvider = config.registry.getProvider(context.project.id, context.provider.id);
  if (registeredProvider) return registeredProvider;

  return { providerId: context.provider.id, providerType: 'custom' };
};

export const resolveEffectiveConfig = (
  config: ResolvedGuardConfig,
  rawContext: RunContext,
  resolvedContext: ResolvedRunContext,
): EffectiveRunConfig => {
  const project = resolveProjectConfig(config, resolvedContext);
  const provider = resolveProviderConfig(config, resolvedContext);

  const overrideTags = normalizeStringArray(rawContext.overrides?.tags);
  const overrideMetadata = normalizeMetadata(rawContext.overrides?.metadata);

  const requestMetadata = {
    ...(config.defaults.request?.metadata ?? {}),
    ...(project.metadata ?? {}),
    ...(provider.metadata ?? {}),
    ...(resolvedContext.metadata ?? {}),
    ...overrideMetadata,
  };

  const effectiveLimits = resolveEffectiveLimits(config, resolvedContext);

  return {
    mode: config.mode,
    project,
    provider: {
      ...provider,
      providerType: provider.providerType ?? 'custom',
    },
    request: {
      tags: overrideTags.length > 0 ? overrideTags : (project.tags ?? []),
      metadata: requestMetadata,
    },
    limits: effectiveLimits.limits,
    limitSources: effectiveLimits.sources,
  };
};
