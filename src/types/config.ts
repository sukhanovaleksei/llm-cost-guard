import type { Metadata } from '../utils/types.js';
import type { GuardAnalyticsConfig, ResolvedGuardAnalyticsConfig } from './analytics.js';
import type { GuardPolicies, ResolvedGuardPolicies, ScopedLimits } from './policies.js';
import type { PricingEntry, ResolvedPricingEntry } from './pricing.js';
import type { GuardRegistry } from './registry.js';
import type { ExecuteReturnValue, GuardResult, ResolvedRunContext, RunContext } from './run.js';
import type { StorageAdapter } from './storage.js';

export type GuardMode = 'soft' | 'hard';

export interface ProjectDefaults {
  metadata?: Metadata;
}

export interface ProviderDefaults {
  metadata?: Metadata;
}

export interface RequestDefaults {
  metadata?: Metadata;
}

export interface GuardDefaults {
  project?: ProjectDefaults;
  provider?: ProviderDefaults;
  request?: RequestDefaults;
}

export interface ProjectConfig {
  projectId: string;
  metadata?: Metadata;
  tags?: string[];
  defaultProviderId?: string;
  limits?: ScopedLimits;
  providers?: ProviderConfig[];
}

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface ProviderConfig {
  providerId: string;
  providerType?: ProviderType;
  metadata?: Metadata;
  pricingRef?: string;
  limits?: ScopedLimits;
}

export interface GuardConfig {
  defaultProjectId?: string;
  mode?: GuardMode;
  defaults?: GuardDefaults;
  projects?: ProjectConfig[];
  pricing?: PricingEntry[];
  policies?: GuardPolicies | undefined;
  analytics?: GuardAnalyticsConfig;
  storage?: StorageAdapter;
}

export interface ResolvedGuardConfig {
  defaultProjectId?: string | undefined;
  mode: GuardMode;
  defaults: GuardDefaults;
  registry: GuardRegistry;
  pricing: ResolvedPricingEntry[];
  policies: ResolvedGuardPolicies;
  analytics: ResolvedGuardAnalyticsConfig;
  storage: StorageAdapter;
}

export interface Guard {
  config: ResolvedGuardConfig;

  addProject(project: ProjectConfig): void;
  addProvider(projectId: string, provider: ProviderConfig): void;

  hasProject(projectId: string): boolean;
  hasProvider(projectId: string, providerId: string): boolean;

  run<TExecuteResult>(
    context: RunContext,
    execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
  ): Promise<GuardResult<TExecuteResult>>;
}
