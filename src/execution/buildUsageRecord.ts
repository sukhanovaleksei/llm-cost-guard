import type { PreflightEstimate } from '../types/preflight.js';
import type {
  AppliedDowngrade,
  EffectiveRunConfig,
  GuardDecision,
  GuardViolation,
  ResolvedRunContext,
} from '../types/run.js';
import type { UsageRecord } from '../types/storage.js';
import type { ActualUsage } from '../types/usage.js';

export interface BuildUsageRecordParams {
  context: ResolvedRunContext;
  effectiveConfig: EffectiveRunConfig;
  decision: GuardDecision;
  preflight: PreflightEstimate;
  actualUsage?: ActualUsage | undefined;
  violation?: GuardViolation | undefined;
  appliedDowngrade?: AppliedDowngrade | undefined;
  executed: boolean;
  timestamp?: string;
}

export const buildUsageRecord = (params: BuildUsageRecordParams): UsageRecord => {
  const {
    context,
    effectiveConfig,
    decision,
    preflight,
    actualUsage,
    violation,
    executed,
    timestamp,
    appliedDowngrade,
  } = params;

  return {
    id: crypto.randomUUID(),
    timestamp: timestamp ?? new Date().toISOString(),

    projectId: context.project.id,
    providerId: context.provider.id,
    model: context.provider.model,

    ...(context.user?.id ? { userId: context.user.id } : {}),
    ...(context.attribution.feature ? { feature: context.attribution.feature } : {}),
    ...(context.attribution.endpoint ? { endpoint: context.attribution.endpoint } : {}),

    tags: [...effectiveConfig.request.tags],
    metadata: { ...effectiveConfig.request.metadata },

    decision: { ...decision, checkedPolicies: [...decision.checkedPolicies] },

    preflight: { ...preflight, pricing: { ...preflight.pricing } },

    ...(actualUsage !== undefined ? { actualUsage: { ...actualUsage } } : {}),
    ...(violation !== undefined ? { violation: { ...violation } } : {}),
    ...(appliedDowngrade !== undefined
      ? {
          appliedDowngrade: {
            ...appliedDowngrade,
          },
        }
      : {}),

    executed,
    blocked: decision.blocked,
  };
};
