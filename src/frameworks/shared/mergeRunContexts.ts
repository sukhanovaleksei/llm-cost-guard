import type { RunContext, RunProjectConfig, RunProviderConfig } from '../../types/run.js';

const mergeStringArrays = (
  left: string[] | undefined,
  right: string[] | undefined,
): string[] | undefined => {
  if (left === undefined && right === undefined) return undefined;
  if (left === undefined) return [...right!];
  if (right === undefined) return [...left];

  return [...left, ...right];
};

const mergeProjectConfig = (
  left: RunProjectConfig | undefined,
  right: RunProjectConfig | undefined,
): RunProjectConfig | undefined => {
  if (left === undefined) return right;
  if (right === undefined) return left;

  return {
    projectId: right.projectId,
    ...(left.metadata !== undefined || right.metadata !== undefined
      ? { metadata: { ...left.metadata, ...right.metadata } }
      : {}),
    ...(left.tags !== undefined || right.tags !== undefined
      ? { tags: mergeStringArrays(left.tags, right.tags) ?? [] }
      : {}),
    ...(right.defaultProviderId !== undefined
      ? { defaultProviderId: right.defaultProviderId }
      : left.defaultProviderId !== undefined
        ? { defaultProviderId: left.defaultProviderId }
        : {}),
    ...(left.limits !== undefined || right.limits !== undefined
      ? { limits: { ...left.limits, ...right.limits } }
      : {}),
  };
};

const mergeProviderConfig = (
  left: RunProviderConfig | undefined,
  right: RunProviderConfig | undefined,
): RunProviderConfig | undefined => {
  if (left === undefined) return right;
  if (right === undefined) return left;

  return {
    providerId: right.providerId,
    ...(right.providerType !== undefined
      ? { providerType: right.providerType }
      : left.providerType !== undefined
        ? { providerType: left.providerType }
        : {}),
    ...(left.metadata !== undefined || right.metadata !== undefined
      ? { metadata: { ...left.metadata, ...right.metadata } }
      : {}),
    ...(right.pricingRef !== undefined
      ? { pricingRef: right.pricingRef }
      : left.pricingRef !== undefined
        ? { pricingRef: left.pricingRef }
        : {}),
    ...(left.limits !== undefined || right.limits !== undefined
      ? { limits: { ...left.limits, ...right.limits } }
      : {}),
  };
};

const mergeAttribution = (
  left: RunContext['attribution'],
  right: RunContext['attribution'],
): RunContext['attribution'] => {
  const tags = mergeStringArrays(left?.tags, right?.tags);
  if (left === undefined && right === undefined && tags === undefined) return undefined;

  return { ...left, ...right, ...(tags !== undefined ? { tags } : {}) };
};

const mergeOverrides = (
  left: RunContext['overrides'],
  right: RunContext['overrides'],
): RunContext['overrides'] => {
  const tags = mergeStringArrays(left?.tags, right?.tags);
  if (left === undefined && right === undefined && tags === undefined) return undefined;

  return { ...left, ...right, ...(tags !== undefined ? { tags } : {}) };
};

export const mergeRunContexts = (left: RunContext, right: RunContext): RunContext => {
  return {
    ...left,
    ...right,
    ...(left.project !== undefined || right.project !== undefined
      ? { project: { ...left.project, ...right.project } }
      : {}),
    ...(left.provider !== undefined || right.provider !== undefined
      ? { provider: { ...left.provider, ...right.provider } }
      : {}),
    ...(left.user !== undefined || right.user !== undefined
      ? { user: { ...left.user, ...right.user } }
      : {}),
    ...(mergeAttribution(left.attribution, right.attribution) !== undefined
      ? { attribution: mergeAttribution(left.attribution, right.attribution) }
      : {}),
    ...(left.metadata !== undefined || right.metadata !== undefined
      ? { metadata: { ...left.metadata, ...right.metadata } }
      : {}),
    ...(mergeOverrides(left.overrides, right.overrides) !== undefined
      ? { overrides: mergeOverrides(left.overrides, right.overrides) }
      : {}),
    ...(mergeProjectConfig(left.projectConfig, right.projectConfig) !== undefined
      ? { projectConfig: mergeProjectConfig(left.projectConfig, right.projectConfig) }
      : {}),
    ...(mergeProviderConfig(left.providerConfig, right.providerConfig) !== undefined
      ? { providerConfig: mergeProviderConfig(left.providerConfig, right.providerConfig) }
      : {}),
    ...(right.request !== undefined
      ? { request: right.request }
      : left.request !== undefined
        ? { request: left.request }
        : {}),
    ...(right.breakdown !== undefined
      ? { breakdown: right.breakdown }
      : left.breakdown !== undefined
        ? { breakdown: left.breakdown }
        : {}),
  };
};
