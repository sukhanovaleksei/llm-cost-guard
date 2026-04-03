import { createMemoryStorage } from '../../../src/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const main = async (): Promise<void> => {
  const storage = createMemoryStorage();

  const guard = createDemoGuard({
    storage,
    analytics: {
      costSpike: {
        enabled: true,
        minBaselineSamples: 3,
        multiplierThreshold: 2,
        absoluteDeltaUsdThreshold: 0.0001,
        compareByFeature: true,
        compareByEndpoint: true,
        maxTopDrivers: 3,
      },
    },
  });

  for (let index = 0; index < 3; index += 1) {
    await guard.run(
      {
        project: { id: 'analytics-spike' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        attribution: { feature: 'chat', endpoint: '/api/chat', tags: ['analytics', 'baseline'] },
        request: { messages: [{ role: 'user', content: `Baseline request ${index + 1}` }] },
      },
      async () => {
        return {
          result: { ok: true, baseline: index + 1 },
          usage: { inputTokens: 120, outputTokens: 60 },
        };
      },
    );
  }

  const expensiveResult = await guard.run(
    {
      project: { id: 'analytics-spike' },
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 1200 },
      attribution: { feature: 'chat', endpoint: '/api/chat', tags: ['analytics', 'spike'] },
      request: {
        messages: [
          { role: 'user', content: 'This request is intentionally much bigger than baseline.' },
        ],
      },
      breakdown: {
        parts: [
          {
            key: 'system',
            content: {
              messages: [{ role: 'system', content: 'You are a very detailed assistant.' }],
            },
          },
          {
            key: 'history',
            content: {
              messages: [
                {
                  role: 'user',
                  content:
                    'Large conversational history block repeated to simulate a larger request.',
                },
              ],
            },
          },
        ],
      },
    },
    async () => {
      return {
        result: { ok: true, expensive: true },
        usage: { inputTokens: 900, outputTokens: 700 },
      };
    },
  );

  printGuardResult('analytics/explain-cost-spike', expensiveResult);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('analytics/explain-cost-spike', wrappedError);
});
