import type { ResolvedGuardConfig } from '../types/config.js';
import type { ResolvedRateLimitPolicyConfig } from '../types/policies.js';
import type {
  GuardDecision,
  RateLimitScope,
  RateLimitViolation,
  ResolvedRunContext,
} from '../types/run.js';

export interface RateLimitEvaluation {
  decision: GuardDecision;
  violation?: RateLimitViolation | undefined;
}

interface RateLimitCheck {
  policyName: string;
  scope: RateLimitScope;
  configuredLimit: number;
  key: string;
}

const WINDOW_MS = 60_000;

const createAllowDecision = (checkedPolicies: string[]): GuardDecision => {
  return { allowed: true, blocked: false, action: 'allow', checkedPolicies };
};

const createBlockedDecision = (checkedPolicies: string[], reasonMessage: string): GuardDecision => {
  return {
    allowed: false,
    blocked: true,
    action: 'block',
    reasonCode: 'RATE_LIMITED',
    reasonMessage,
    checkedPolicies,
  };
};

const buildRateLimitChecks = (
  policy: ResolvedRateLimitPolicyConfig,
  context: ResolvedRunContext,
): RateLimitCheck[] => {
  const checks: RateLimitCheck[] = [];

  if (policy.requestsPerMinute !== undefined) {
    checks.push({
      policyName: 'rateLimit.requestsPerMinute',
      scope: 'global',
      configuredLimit: policy.requestsPerMinute,
      key: 'rl:global:rpm',
    });
  }

  if (policy.perUserRequestsPerMinute !== undefined && context.user?.id !== undefined) {
    checks.push({
      policyName: 'rateLimit.perUserRequestsPerMinute',
      scope: 'user',
      configuredLimit: policy.perUserRequestsPerMinute,
      key: `rl:user:${context.user.id}:rpm`,
    });
  }

  if (policy.perProjectRequestsPerMinute !== undefined) {
    checks.push({
      policyName: 'rateLimit.perProjectRequestsPerMinute',
      scope: 'project',
      configuredLimit: policy.perProjectRequestsPerMinute,
      key: `rl:project:${context.project.id}:rpm`,
    });
  }

  if (policy.perProviderRequestsPerMinute !== undefined) {
    checks.push({
      policyName: 'rateLimit.perProviderRequestsPerMinute',
      scope: 'provider',
      configuredLimit: policy.perProviderRequestsPerMinute,
      key: `rl:project:${context.project.id}:provider:${context.provider.id}:rpm`,
    });
  }

  return checks;
};

const calculateRetryAfterSeconds = (resetAt: string, now: Date): number => {
  const resetAtMs = new Date(resetAt).getTime();
  const deltaMs = Math.max(resetAtMs - now.getTime(), 0);

  return Math.ceil(deltaMs / 1000);
};

export const evaluateRateLimit = async (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
  now: Date = new Date(),
): Promise<RateLimitEvaluation> => {
  const policy = config.policies.rateLimit;
  if (policy === undefined) return { decision: createAllowDecision([]) };

  const checks = buildRateLimitChecks(policy, context);
  const checkedPolicies: string[] = [];

  for (const check of checks) {
    checkedPolicies.push(check.policyName);

    const state = await config.storage.checkAndIncrementRateLimit({
      key: check.key,
      limit: check.configuredLimit,
      windowMs: WINDOW_MS,
      now: now.toISOString(),
    });

    if (!state.allowed) {
      const retryAfterSeconds = calculateRetryAfterSeconds(state.resetAt, now);

      const violation: RateLimitViolation = {
        type: 'rate-limit',
        scope: check.scope,
        window: 'minute',
        configuredLimit: check.configuredLimit,
        currentCount: state.count,
        retryAfterSeconds,
      };

      return {
        decision: createBlockedDecision(
          [...checkedPolicies],
          `Rate limit exceeded for ${check.scope} minute window: ${state.count}/${check.configuredLimit} requests. Retry after ${retryAfterSeconds} seconds.`,
        ),
        violation,
      };
    }
  }

  return { decision: createAllowDecision(checkedPolicies) };
};
