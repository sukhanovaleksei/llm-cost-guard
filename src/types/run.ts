import type { Metadata } from '../utils/types.js';
import type { GuardMode, ProjectConfig, ProviderConfig, ProviderType } from './config.js';
import type { PreflightEstimate } from './preflight.js';
import type { RequestLike } from './requests.js';
import type { ActualUsage, ExecuteUsage } from './usage.js';

export interface ExecuteResultEnvelope<TExecuteResult> {
  result: TExecuteResult;
  usage: ExecuteUsage;
}

export type ExecuteReturnValue<TExecuteResult> =
  | TExecuteResult
  | ExecuteResultEnvelope<TExecuteResult>;

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

export interface RequestBudgetViolation {
  limitType: 'input' | 'worst-case';
  configuredLimitUsd: number;
  actualCostUsd: number;
}

export type GuardAction = 'allow' | 'block';

export type GuardReasonCode = 'REQUEST_BUDGET_EXCEEDED';

export interface GuardDecision {
  allowed: boolean;
  blocked: boolean;
  action: GuardAction;
  reasonCode?: GuardReasonCode;
  reasonMessage?: string;
  checkedPolicies: string[];
}

export interface GuardResult<TExecuteResult> {
  result?: TExecuteResult;
  context: ResolvedRunContext;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  preflight: PreflightEstimate;
  actualUsage?: ActualUsage | undefined;
  violation?: RequestBudgetViolation | undefined;
}
