import type { ProjectConfig, ProviderConfig } from '../types/config.js';
import type { GuardRegistry, ProjectRegistryEntry } from '../types/registry.js';

const assertNoDuplicateProjectIds = (projects: ProjectConfig[]): void => {
  const seen = new Set<string>();

  for (const project of projects) {
    if (seen.has(project.projectId)) throw new Error(`Duplicate projectId: "${project.projectId}"`);

    seen.add(project.projectId);
  }
};

const assertNoDuplicateProviderIds = (projectId: string, providers: ProviderConfig[]): void => {
  const seen = new Set<string>();

  for (const provider of providers) {
    if (seen.has(provider.providerId))
      throw new Error(`Duplicate providerId "${provider.providerId}" in project "${projectId}"`);

    seen.add(provider.providerId);
  }
};

export const createRegistry = (projects: ProjectConfig[] = []): GuardRegistry => {
  assertNoDuplicateProjectIds(projects);

  const projectMap = new Map<string, ProjectRegistryEntry>();

  for (const project of projects) {
    const providers = project.providers ?? [];
    assertNoDuplicateProviderIds(project.projectId, providers);

    const providerMap = new Map<string, ProviderConfig>(
      providers.map((provider) => [provider.providerId, provider]),
    );

    projectMap.set(project.projectId, { ...project, providers: providerMap });
  }

  return {
    projects: projectMap,
    hasProject(projectId: string) {
      return projectMap.has(projectId);
    },
    getProject(projectId: string) {
      return projectMap.get(projectId);
    },
    hasProvider(projectId: string, providerId: string) {
      return projectMap.get(projectId)?.providers.has(providerId) ?? false;
    },
    getProvider(projectId: string, providerId: string) {
      return projectMap.get(projectId)?.providers.get(providerId);
    },
  };
};
