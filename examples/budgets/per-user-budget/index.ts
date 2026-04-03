import { createMemoryStorage } from '../../../src/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const main = async (): Promise<void> => {
  const storage = createMemoryStorage();

  const guard = createDemoGuard({
    mode: 'soft',
    storage,
    policies: { aggregateBudget: { perUserDailyUsd: 0.003 } },
  });

  const firstResult = await guard.run(
    {
      project: { id: 'budget-per-user' },
      provider: { id: 'openai', model: 'gpt-4o', maxTokens: 200 },
      user: { id: 'user-budget-01' },
      attribution: {
        feature: 'examples',
        endpoint: 'budgets/per-user-budget',
        tags: ['budget', 'per-user'],
      },
      request: {
        messages: [{ role: 'user', content: 'First request for per-user budget example.' }],
      },
    },
    async () => {
      return {
        result: { ok: true, requestNumber: 1 },
        usage: { inputTokens: 300, outputTokens: 200 },
      };
    },
  );

  printGuardResult('budgets/per-user-budget / first request', firstResult);

  const secondResult = await guard.run(
    {
      project: { id: 'budget-per-user' },
      provider: { id: 'openai', model: 'gpt-4o', maxTokens: 200 },
      user: { id: 'user-budget-01' },
      attribution: {
        feature: 'examples',
        endpoint: 'budgets/per-user-budget',
        tags: ['budget', 'per-user'],
      },
      request: {
        messages: [
          {
            role: 'user',
            content: 'Second request for per-user budget example.',
          },
        ],
      },
    },
    async () => {
      return {
        result: { ok: true, requestNumber: 2 },
        usage: { inputTokens: 300, outputTokens: 200 },
      };
    },
  );

  printGuardResult('budgets/per-user-budget / second request', secondResult);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('budgets/per-user-budget', wrappedError);
});
