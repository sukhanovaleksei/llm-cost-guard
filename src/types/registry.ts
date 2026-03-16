import type { ProjectConfig, ProviderConfig } from './config.js';

export interface ProjectRegistryEntry extends Omit<ProjectConfig, 'providers'> {
  providers: Map<string, ProviderConfig>;
}

export interface GuardRegistry {
  projects: Map<string, ProjectRegistryEntry>;
  hasProject(projectId: string): boolean;
  getProject(projectId: string): ProjectRegistryEntry | undefined;
  hasProvider(projectId: string, providerId: string): boolean;
  getProvider(projectId: string, providerId: string): ProviderConfig | undefined;
}
