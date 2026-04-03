import type { Metadata } from '../utils/types.js';
import type { CostSpikeExplanation } from './analytics.js';
import type { GuardMode, ProjectConfig, ProviderConfig, ProviderType } from './config.js';
import type { EffectiveLimitSources, ScopedLimits } from './policies.js';
import type { PreflightEstimate } from './preflight.js';
import type { RequestLike } from './requests.js';
import type { ActualUsage, ExecuteUsage } from './usage.js';

export interface BreakdownPartInput {
  key: string;
  content: RequestLike | undefined;
}

export interface RunBreakdownInput {
  parts: BreakdownPartInput[];
}

export interface ExecuteResultEnvelope<TExecuteResult> {
  result: TExecuteResult;
  usage: ExecuteUsage;
}

export type ExecuteReturnValue<TExecuteResult> =
  | TExecuteResult
  | ExecuteResultEnvelope<TExecuteResult>;

export interface RunOverrides {
  tags?: string[] | undefined;
  metadata?: Metadata;
}

export interface RunContext {
  project?: {
    id?: string;
  };
  provider?: {
    id?: string;
    model?: string | undefined;
    maxTokens?: number | undefined;
  };
  user?: {
    id?: string | undefined;
  };
  request?: RequestLike | undefined;
  breakdown?: RunBreakdownInput | undefined;
  attribution?:
    | {
        feature?: string | undefined;
        endpoint?: string | undefined;
        tags?: string[] | undefined;
      }
    | undefined;
  metadata?: Metadata;
  overrides?: RunOverrides | undefined;

  projectConfig?: RunProjectConfig | undefined;
  providerConfig?: RunProviderConfig | undefined;
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
    id: string;
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
  limits: ScopedLimits;
  limitSources: EffectiveLimitSources;
}

export interface RequestBudgetViolation {
  type: 'request-budget';
  limitType: 'input' | 'worst-case';
  configuredLimitUsd: number;
  actualCostUsd: number;
}

export type AggregateBudgetWindow = 'daily' | 'monthly';
export type AggregateBudgetScope = 'global' | 'user' | 'project' | 'provider';

export type RateLimitWindow = 'minute';
export type RateLimitScope = 'global' | 'user' | 'project' | 'provider';

export interface AggregateBudgetViolation {
  type: 'aggregate-budget';
  scope: AggregateBudgetScope;
  window: AggregateBudgetWindow;
  configuredLimitUsd: number;
  currentSpendUsd: number;
  estimatedRequestCostUsd: number;
  projectedSpendUsd: number;
}

export interface RateLimitViolation {
  type: 'rate-limit';
  scope: RateLimitScope;
  window: RateLimitWindow;
  configuredLimit: number;
  currentCount: number;
  retryAfterSeconds: number;
}

export type GuardViolation = RequestBudgetViolation | AggregateBudgetViolation | RateLimitViolation;

export type GuardAction = 'allow' | 'block' | 'downgrade';

export type GuardReasonCode =
  | 'REQUEST_BUDGET_EXCEEDED'
  | 'AGGREGATE_BUDGET_EXCEEDED'
  | 'RATE_LIMITED';

export interface GuardDecision {
  allowed: boolean;
  blocked: boolean;
  action: GuardAction;
  reasonCode?: GuardReasonCode;
  reasonMessage?: string;
  checkedPolicies: string[];
}

export interface GuardResult<TExecuteResult> {
  runId: string;
  result?: TExecuteResult;
  context: ResolvedRunContext;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  preflight: PreflightEstimate;
  actualUsage?: ActualUsage | undefined;
  violation?: GuardViolation | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
  costSpikeExplanation?: CostSpikeExplanation | undefined;
}

export interface AppliedDowngrade {
  reason: 'request-budget';
  originalProviderId: string;
  effectiveProviderId: string;
  originalModel: string;
  effectiveModel: string;
  originalMaxTokens?: number | undefined;
  effectiveMaxTokens?: number | undefined;
}

export interface RunProjectConfig {
  projectId: string;
  metadata?: Metadata;
  tags?: string[];
  defaultProviderId?: string;
  limits?: ScopedLimits;
}

export interface RunProviderConfig {
  providerId: string;
  providerType?: ProviderType;
  metadata?: Metadata;
  pricingRef?: string;
  limits?: ScopedLimits;
}
