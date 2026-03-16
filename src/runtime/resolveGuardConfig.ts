import { resolvePricingTable } from '../pricing/resolvePricingTable.js';
import type { GuardConfig, GuardDefaults, ResolvedGuardConfig } from '../types/config.js';
import { createRegistry } from './registry.js';

const defaultGuardDefaults: GuardDefaults = {
  project: {
    metadata: {},
  },
  provider: {
    metadata: {},
  },
  request: {
    metadata: {},
  },
};

export const resolveGuardConfig = (config: GuardConfig = {}): ResolvedGuardConfig => {
  return {
    defaultProjectId: config.defaultProjectId,
    mode: config.mode ?? 'hard',
    defaults: {
      project: {
        ...defaultGuardDefaults.project,
        ...config.defaults?.project,
      },
      provider: {
        ...defaultGuardDefaults.provider,
        ...config.defaults?.provider,
      },
      request: {
        ...defaultGuardDefaults.request,
        ...config.defaults?.request,
      },
    },
    registry: createRegistry(config.projects ?? []),
    pricing: resolvePricingTable(config.pricing),
  };
};
