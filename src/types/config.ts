import type { Metadata } from '../utils/types.js';
import type { PricingEntry, ResolvedPricingEntry } from './pricing.js';
import type { GuardRegistry } from './registry.js';
import type { ExecuteFn, GuardResult, RunContext } from './run.js';

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
  providers?: ProviderConfig[];
}

export type ProviderType = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface ProviderConfig {
  providerId: string;
  providerType?: ProviderType;
  metadata?: Metadata;
  pricingRef?: string;
}

export interface GuardConfig {
  defaultProjectId?: string;
  mode?: GuardMode;
  defaults?: GuardDefaults;
  projects?: ProjectConfig[];
  pricing?: PricingEntry[];
}

export interface ResolvedGuardConfig {
  defaultProjectId?: string | undefined;
  mode: GuardMode;
  defaults: GuardDefaults;
  registry: GuardRegistry;
  pricing: ResolvedPricingEntry[];
}

export interface Guard {
  config: ResolvedGuardConfig;
  run<TResult = undefined>(
    context: RunContext,
    execute: ExecuteFn<TResult>,
  ): Promise<GuardResult<TResult>>;
}
