import { normalizeScopedLimits } from '../policies/normalizeScopedLimits.js';
import type { ProjectConfig, ProviderConfig } from '../types/config.js';
import type { GuardRegistry, ProjectRegistryEntry } from '../types/registry.js';
import {
  normalizeMetadata,
  normalizeNonEmptyString,
  normalizeStringArray,
} from '../utils/normalize.js';
import { hasMetadata } from '../utils/validation.js';

const normalizeProviderConfig = (provider: ProviderConfig): ProviderConfig => {
  const providerId = normalizeNonEmptyString(provider.providerId);
  if (providerId === undefined) throw new Error('provider.providerId must be a non-empty string');

  const pricingRef = normalizeNonEmptyString(provider.pricingRef);
  const metadata = normalizeMetadata(provider.metadata);

  const limits = normalizeScopedLimits(provider.limits);

  return {
    providerId,
    ...(provider.providerType !== undefined ? { providerType: provider.providerType } : {}),
    ...(pricingRef !== undefined ? { pricingRef } : {}),
    ...(hasMetadata(metadata) ? { metadata } : {}),
    ...(limits !== undefined ? { limits } : {}),
  };
};

const normalizeProjectConfig = (project: ProjectConfig): ProjectConfig => {
  const projectId = normalizeNonEmptyString(project.projectId);
  if (projectId === undefined) throw new Error('project.projectId must be a non-empty string');

  const metadata = normalizeMetadata(project.metadata);
  const tags = normalizeStringArray(project.tags);
  const defaultProviderId = normalizeNonEmptyString(project.defaultProviderId);
  const providers = Array.isArray(project.providers)
    ? project.providers.map((provider) => normalizeProviderConfig(provider))
    : [];
  const limits = normalizeScopedLimits(project.limits);

  return {
    projectId,
    ...(hasMetadata(metadata) ? { metadata } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(defaultProviderId !== undefined ? { defaultProviderId } : {}),
    ...(limits !== undefined ? { limits } : {}),
    ...(providers.length > 0 ? { providers } : {}),
  };
};

const assertNoDuplicateProviderIds = (projectId: string, providers: ProviderConfig[]): void => {
  const seen = new Set<string>();

  for (const provider of providers) {
    if (seen.has(provider.providerId))
      throw new Error(`Duplicate providerId "${provider.providerId}" in project "${projectId}"`);

    seen.add(provider.providerId);
  }
};

const createProjectRegistryEntry = (project: ProjectConfig): ProjectRegistryEntry => {
  const normalizedProject = normalizeProjectConfig(project);
  const providers = normalizedProject.providers ?? [];

  assertNoDuplicateProviderIds(normalizedProject.projectId, providers);

  return {
    projectId: normalizedProject.projectId,
    ...(normalizedProject.metadata !== undefined ? { metadata: normalizedProject.metadata } : {}),
    ...(normalizedProject.tags !== undefined ? { tags: normalizedProject.tags } : {}),
    ...(normalizedProject.defaultProviderId !== undefined
      ? { defaultProviderId: normalizedProject.defaultProviderId }
      : {}),
    ...(normalizedProject.limits !== undefined ? { limits: normalizedProject.limits } : {}),
    providers: new Map(providers.map((provider) => [provider.providerId, provider])),
  };
};

export const createRegistry = (projects: ProjectConfig[] = []): GuardRegistry => {
  const projectMap = new Map<string, ProjectRegistryEntry>();

  const registry: GuardRegistry = {
    projects: projectMap,

    hasProject(projectId: string): boolean {
      return projectMap.has(projectId);
    },

    getProject(projectId: string): ProjectRegistryEntry | undefined {
      return projectMap.get(projectId);
    },

    addProject(project: ProjectConfig): ProjectRegistryEntry {
      const entry = createProjectRegistryEntry(project);

      if (projectMap.has(entry.projectId)) {
        throw new Error(`Duplicate projectId: "${entry.projectId}"`);
      }

      projectMap.set(entry.projectId, entry);
      return entry;
    },

    hasProvider(projectId: string, providerId: string): boolean {
      return projectMap.get(projectId)?.providers.has(providerId) ?? false;
    },

    getProvider(projectId: string, providerId: string): ProviderConfig | undefined {
      return projectMap.get(projectId)?.providers.get(providerId);
    },

    addProvider(projectId: string, provider: ProviderConfig): ProviderConfig {
      const normalizedProjectId = normalizeNonEmptyString(projectId);
      if (normalizedProjectId === undefined)
        throw new Error('projectId must be a non-empty string');

      const projectEntry = projectMap.get(normalizedProjectId);
      if (projectEntry === undefined)
        throw new Error(`Project "${normalizedProjectId}" is not registered`);

      const normalizedProvider = normalizeProviderConfig(provider);

      if (projectEntry.providers.has(normalizedProvider.providerId))
        throw new Error(
          `Duplicate providerId "${normalizedProvider.providerId}" in project "${normalizedProjectId}"`,
        );

      projectEntry.providers.set(normalizedProvider.providerId, normalizedProvider);
      return normalizedProvider;
    },
  };

  for (const project of projects) registry.addProject(project);

  return registry;
};
