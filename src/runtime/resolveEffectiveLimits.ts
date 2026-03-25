import type { ProviderConfig, ResolvedGuardConfig } from '../types/config.js';
import type {
  EffectiveLimitSources,
  ScopedAggregateBudgetLimits,
  ScopedLimits,
  ScopedRateLimitLimits,
  ScopedRequestBudgetLimits,
} from '../types/policies.js';
import type { ProjectRegistryEntry } from '../types/registry.js';
import type { ResolvedRunContext } from '../types/run.js';

interface SectionResolution<TSection> {
  value?: TSection;
  source?: 'project' | 'provider';
}

interface EffectiveLimitsResolution {
  limits: ScopedLimits;
  sources: EffectiveLimitSources;
}

const resolveRequestBudgetLimits = (
  project: ProjectRegistryEntry | undefined,
  provider: ProviderConfig | undefined,
): SectionResolution<ScopedRequestBudgetLimits> => {
  if (provider?.limits?.requestBudget !== undefined)
    return { value: provider.limits.requestBudget, source: 'provider' };

  if (project?.limits?.requestBudget !== undefined)
    return { value: project.limits.requestBudget, source: 'project' };

  return {};
};

const resolveAggregateBudgetLimits = (
  project: ProjectRegistryEntry | undefined,
  provider: ProviderConfig | undefined,
): SectionResolution<ScopedAggregateBudgetLimits> => {
  if (provider?.limits?.aggregateBudget !== undefined)
    return { value: provider.limits.aggregateBudget, source: 'provider' };

  if (project?.limits?.aggregateBudget !== undefined)
    return { value: project.limits.aggregateBudget, source: 'project' };

  return {};
};

const resolveRateLimitLimits = (
  project: ProjectRegistryEntry | undefined,
  provider: ProviderConfig | undefined,
): SectionResolution<ScopedRateLimitLimits> => {
  if (provider?.limits?.rateLimit !== undefined)
    return { value: provider.limits.rateLimit, source: 'provider' };

  if (project?.limits?.rateLimit !== undefined)
    return { value: project.limits.rateLimit, source: 'project' };

  return {};
};

export const resolveEffectiveLimits = (
  config: ResolvedGuardConfig,
  context: ResolvedRunContext,
): EffectiveLimitsResolution => {
  const project = config.registry.getProject(context.project.id);
  const provider = config.registry.getProvider(context.project.id, context.provider.id);

  const requestBudget = resolveRequestBudgetLimits(project, provider);
  const aggregateBudget = resolveAggregateBudgetLimits(project, provider);
  const rateLimit = resolveRateLimitLimits(project, provider);

  return {
    limits: {
      ...(requestBudget.value !== undefined ? { requestBudget: requestBudget.value } : {}),
      ...(aggregateBudget.value !== undefined ? { aggregateBudget: aggregateBudget.value } : {}),
      ...(rateLimit.value !== undefined ? { rateLimit: rateLimit.value } : {}),
    },
    sources: {
      ...(requestBudget.source !== undefined ? { requestBudget: requestBudget.source } : {}),
      ...(aggregateBudget.source !== undefined ? { aggregateBudget: aggregateBudget.source } : {}),
      ...(rateLimit.source !== undefined ? { rateLimit: rateLimit.source } : {}),
    },
  };
};
