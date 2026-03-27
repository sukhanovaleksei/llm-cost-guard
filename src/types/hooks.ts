import type { CostSpikeExplanation } from './analytics.js';
import type { PreflightEstimate } from './preflight.js';
import type {
  AppliedDowngrade,
  EffectiveRunConfig,
  GuardDecision,
  GuardViolation,
  ResolvedRunContext,
  RunContext,
} from './run.js';
import type { MaybePromise, UsageRecord } from './storage.js';
import type { ActualUsage } from './usage.js';

export interface HookEventBase {
  runId: string;
  timestamp: string;
  context: ResolvedRunContext;
}

export interface RunStartEvent extends HookEventBase {
  rawContext: RunContext;
}

export interface PreflightBuiltEvent extends HookEventBase {
  preflight: PreflightEstimate;
}

export interface PolicyEvaluatedEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  violation?: GuardViolation | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
}

export interface RequestBlockedEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  violation?: GuardViolation | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
}

export interface RequestDowngradedEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  appliedDowngrade: AppliedDowngrade;
}

export interface ExecuteSuccessEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  actualUsage?: ActualUsage | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
  costSpikeExplanation?: CostSpikeExplanation | undefined;
}

export interface ExecuteErrorEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  appliedDowngrade?: AppliedDowngrade | undefined;
  error: Error;
}

export interface UsageRecordedEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  usageRecord: UsageRecord;
  actualUsage?: ActualUsage | undefined;
  violation?: GuardViolation | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
}

export interface CostSpikeDetectedEvent extends HookEventBase {
  preflight: PreflightEstimate;
  decision: GuardDecision;
  effectiveConfig: EffectiveRunConfig;
  actualUsage: ActualUsage;
  costSpikeExplanation: CostSpikeExplanation;
}

export interface GuardHooks {
  onRunStart?: (event: RunStartEvent) => MaybePromise<void>;
  onPreflightBuilt?: (event: PreflightBuiltEvent) => MaybePromise<void>;
  onPolicyEvaluated?: (event: PolicyEvaluatedEvent) => MaybePromise<void>;
  onRequestBlocked?: (event: RequestBlockedEvent) => MaybePromise<void>;
  onRequestDowngraded?: (event: RequestDowngradedEvent) => MaybePromise<void>;
  onExecuteSuccess?: (event: ExecuteSuccessEvent) => MaybePromise<void>;
  onExecuteError?: (event: ExecuteErrorEvent) => MaybePromise<void>;
  onUsageRecorded?: (event: UsageRecordedEvent) => MaybePromise<void>;
  onCostSpikeDetected?: (event: CostSpikeDetectedEvent) => MaybePromise<void>;
}
