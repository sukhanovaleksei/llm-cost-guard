import type { ProjectConfig, ProviderConfig } from './config.js';

export interface ProjectRegistryEntry extends Omit<ProjectConfig, 'providers'> {
  providers: Map<string, ProviderConfig>;
}

export interface GuardRegistry {
  projects: Map<string, ProjectRegistryEntry>;

  hasProject(projectId: string): boolean;
  getProject(projectId: string): ProjectRegistryEntry | undefined;
  addProject(project: ProjectConfig): ProjectRegistryEntry;

  hasProvider(projectId: string, providerId: string): boolean;
  getProvider(projectId: string, providerId: string): ProviderConfig | undefined;
  addProvider(projectId: string, provider: ProviderConfig): ProviderConfig;
}
