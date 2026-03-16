import type { Metadata } from '../utils/types.js';
import type { GuardMode, ProjectConfig, ProviderConfig, ProviderType } from './config.js';
import type { PreflightEstimate } from './preflight.js';
import type { RequestLike } from './requests.js';

export interface RunOverrides {
  tags?: string[];
  metadata?: Metadata;
}

export interface RunContext {
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
  request?: RequestLike | undefined;
  attribution?: {
    feature?: string;
    endpoint?: string;
    tags?: string[];
  };
  metadata?: Metadata;
  overrides?: RunOverrides;
}

export interface ResolvedRunContext {
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
  request?: RequestLike | undefined;
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

export interface GuardResult<TResult> {
  result: TResult;
  context: ResolvedRunContext;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  preflight: PreflightEstimate;
}

export type ExecuteFn<TResult> = (context: ResolvedRunContext) => Promise<TResult> | TResult;
