import type { Metadata } from '../utils/types.js';
import type { GuardMode, ProjectConfig, ProviderConfig, ProviderType } from './config.js';

export interface RunOverrides {
  tags?: string[];
  metadata?: Metadata;
}

export interface RunContext<TRequest = undefined> {
  project?: {
    id?: string;
  };
  provider?: {
    id?: string;
    model?: string;
    maxTokens?: number;
  };
  user?: {
    id?: string;
  };
  request?: TRequest | undefined;
  attribution?: {
    feature?: string;
    endpoint?: string;
    tags?: string[];
  };
  metadata?: Metadata;
  overrides?: RunOverrides;
}

export interface ResolvedRunContext<TRequest = undefined> {
  project: {
    id: string;
  };
  provider: {
    id: string;
    model: string;
    maxTokens?: number;
  };
  user?: {
    id?: string;
  };
  request?: TRequest | undefined;
  attribution: {
    feature?: string;
    endpoint?: string;
    tags: string[];
  };
  metadata: Metadata;
}

export interface EffectiveProviderConfig extends ProviderConfig {
  providerType: ProviderType;
}

export interface EffectiveRunConfig {
  mode: GuardMode;
  project: ProjectConfig;
  provider: EffectiveProviderConfig;
  request: {
    tags: string[];
    metadata: Metadata;
  };
}

export interface GuardDecision {
  allowed: boolean;
}

export interface GuardResult<TResult, TRequest = undefined> {
  result: TResult;
  context: ResolvedRunContext<TRequest>;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
}

export type ExecuteFn<TResult, TRequest = undefined> = (
  context: ResolvedRunContext<TRequest>,
) => Promise<TResult> | TResult;
