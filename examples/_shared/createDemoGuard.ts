import {
  createGuard,
  createMemoryStorage,
  type Guard,
  type GuardAnalyticsConfig,
  type GuardConfig,
  type GuardHooks,
  type GuardMode,
  type GuardPolicies,
  type StorageAdapter,
} from '../../src/index.js';

export interface DemoGuardOptions {
  defaultProjectId?: string;
  mode?: GuardMode;
  policies?: GuardPolicies;
  analytics?: GuardAnalyticsConfig;
  hooks?: GuardHooks;
  storage?: StorageAdapter;
}

export const createDemoGuard = (options: DemoGuardOptions = {}): Guard => {
  const config: GuardConfig = {
    defaultProjectId: options.defaultProjectId ?? 'examples-app',
    mode: options.mode ?? 'hard',
    storage: options.storage ?? createMemoryStorage(),
    pricing: [
      {
        providerId: 'openai',
        model: 'gpt-4o',
        inputCostPerMillionTokens: 2.5,
        outputCostPerMillionTokens: 10,
      },
      {
        providerId: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
      },
      {
        providerId: 'anthropic',
        model: 'claude-4-5-haiku-latest',
        inputCostPerMillionTokens: 0.8,
        outputCostPerMillionTokens: 4,
      },
    ],
    ...(options.policies !== undefined ? { policies: options.policies } : {}),
    ...(options.analytics !== undefined ? { analytics: options.analytics } : {}),
    ...(options.hooks !== undefined ? { hooks: options.hooks } : {}),
  };

  return createGuard(config);
};
