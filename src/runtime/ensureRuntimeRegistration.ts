import type { ProjectConfig, ProviderConfig, ResolvedGuardConfig } from '../types/config.js';
import type {
  ResolvedRunContext,
  RunContext,
  RunProjectConfig,
  RunProviderConfig,
} from '../types/run.js';
import {
  normalizeMetadata,
  normalizeNonEmptyString,
  normalizeStringArray,
} from '../utils/normalize.js';
import { hasMetadata } from '../utils/validation.js';

const normalizeRunProjectConfig = (project: RunProjectConfig): ProjectConfig => {
  const projectId = normalizeNonEmptyString(project.projectId);
  if (projectId === undefined) {
    throw new Error('projectConfig.projectId must be a non-empty string');
  }

  const metadata = normalizeMetadata(project.metadata);
  const tags = normalizeStringArray(project.tags);
  const defaultProviderId = normalizeNonEmptyString(project.defaultProviderId);

  return {
    projectId,
    ...(hasMetadata(metadata) ? { metadata } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(defaultProviderId !== undefined ? { defaultProviderId } : {}),
  };
};

const normalizeRunProviderConfig = (provider: RunProviderConfig): ProviderConfig => {
  const providerId = normalizeNonEmptyString(provider.providerId);
  if (providerId === undefined)
    throw new Error('providerConfig.providerId must be a non-empty string');

  const metadata = normalizeMetadata(provider.metadata);
  const pricingRef = normalizeNonEmptyString(provider.pricingRef);

  return {
    providerId,
    ...(provider.providerType !== undefined ? { providerType: provider.providerType } : {}),
    ...(pricingRef !== undefined ? { pricingRef } : {}),
    ...(hasMetadata(metadata) ? { metadata } : {}),
  };
};

const assertProjectConfigMatchesContext = (
  resolvedProjectId: string,
  projectConfig: RunProjectConfig,
): void => {
  const configProjectId = normalizeNonEmptyString(projectConfig.projectId);
  if (configProjectId === undefined)
    throw new Error('projectConfig.projectId must be a non-empty string');

  if (configProjectId !== resolvedProjectId)
    throw new Error(
      `projectConfig.projectId "${configProjectId}" must match resolved project id "${resolvedProjectId}"`,
    );
};

const assertProviderConfigMatchesContext = (
  resolvedProviderId: string,
  providerConfig: RunProviderConfig,
): void => {
  const configProviderId = normalizeNonEmptyString(providerConfig.providerId);
  if (configProviderId === undefined)
    throw new Error('providerConfig.providerId must be a non-empty string');

  if (configProviderId !== resolvedProviderId)
    throw new Error(
      `providerConfig.providerId "${configProviderId}" must match resolved provider id "${resolvedProviderId}"`,
    );
};

export const ensureRuntimeRegistration = (
  config: ResolvedGuardConfig,
  resolvedContext: ResolvedRunContext,
  rawContext: RunContext,
): void => {
  const rawProjectConfig = rawContext.projectConfig;
  const rawProviderConfig = rawContext.providerConfig;

  if (rawProjectConfig !== undefined)
    assertProjectConfigMatchesContext(resolvedContext.project.id, rawProjectConfig);

  if (rawProviderConfig !== undefined)
    assertProviderConfigMatchesContext(resolvedContext.provider.id, rawProviderConfig);

  if (!config.registry.hasProject(resolvedContext.project.id) && rawProjectConfig !== undefined) {
    const normalizedProjectConfig = normalizeRunProjectConfig(rawProjectConfig);
    config.registry.addProject(normalizedProjectConfig);
  }

  const projectExists = config.registry.hasProject(resolvedContext.project.id);

  if (!projectExists && rawProviderConfig !== undefined)
    throw new Error(
      `Cannot register provider "${resolvedContext.provider.id}" because project "${resolvedContext.project.id}" is not registered`,
    );

  if (
    projectExists &&
    !config.registry.hasProvider(resolvedContext.project.id, resolvedContext.provider.id) &&
    rawProviderConfig !== undefined
  ) {
    const normalizedProviderConfig = normalizeRunProviderConfig(rawProviderConfig);
    config.registry.addProvider(resolvedContext.project.id, normalizedProviderConfig);
  }
};
