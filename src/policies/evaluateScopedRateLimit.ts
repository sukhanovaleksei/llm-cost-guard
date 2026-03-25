import type { ResolvedGuardConfig } from '../types/config.js';
import type { GuardDecision, RateLimitViolation, ResolvedRunContext } from '../types/run.js';

const WINDOW_MS = 60_000;

export interface ScopedRateLimitEvaluation {
  decision: GuardDecision;
  violation?: RateLimitViolation;
}

export interface ScopedRateLimitParams {
  config: ResolvedGuardConfig;
  context: ResolvedRunContext;
  scope: 'project' | 'provider';
  requestsPerMinute: number;
  policyName: string;
  now?: Date;
}

const createAllowDecision = (policyName: string): GuardDecision => {
  return { allowed: true, blocked: false, action: 'allow', checkedPolicies: [policyName] };
};

const createBlockedDecision = (policyName: string, reasonMessage: string): GuardDecision => {
  return {
    allowed: false,
    blocked: true,
    action: 'block',
    reasonCode: 'RATE_LIMITED',
    reasonMessage,
    checkedPolicies: [policyName],
  };
};

const calculateRetryAfterSeconds = (resetAt: string, now: Date): number => {
  const resetAtMs = new Date(resetAt).getTime();
  const deltaMs = Math.max(resetAtMs - now.getTime(), 0);

  return Math.ceil(deltaMs / 1000);
};

const buildScopedRateLimitKey = (
  context: ResolvedRunContext,
  scope: 'project' | 'provider',
): string => {
  if (scope === 'provider')
    return `rl:local:project:${context.project.id}:provider:${context.provider.id}:rpm`;

  return `rl:local:project:${context.project.id}:rpm`;
};

export const evaluateScopedRateLimit = async (
  params: ScopedRateLimitParams,
): Promise<ScopedRateLimitEvaluation> => {
  const { config, context, scope, requestsPerMinute, policyName, now = new Date() } = params;

  const state = await config.storage.checkAndIncrementRateLimit({
    key: buildScopedRateLimitKey(context, scope),
    limit: requestsPerMinute,
    windowMs: WINDOW_MS,
    now: now.toISOString(),
  });

  if (!state.allowed) {
    const retryAfterSeconds = calculateRetryAfterSeconds(state.resetAt, now);

    const violation: RateLimitViolation = {
      type: 'rate-limit',
      scope,
      window: 'minute',
      configuredLimit: requestsPerMinute,
      currentCount: state.count,
      retryAfterSeconds,
    };

    return {
      decision: createBlockedDecision(
        policyName,
        `Rate limit exceeded for ${scope} minute window: ${state.count}/${requestsPerMinute} requests. Retry after ${retryAfterSeconds} seconds.`,
      ),
      violation,
    };
  }

  return { decision: createAllowDecision(policyName) };
};
