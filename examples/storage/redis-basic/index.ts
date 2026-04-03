import { createRedisStorage } from '../../../src/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { createFakeRedisClient } from '../../_shared/createFakeRedisClient.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const main = async (): Promise<void> => {
  const redisClient = createFakeRedisClient();
  const storage = createRedisStorage({ client: redisClient, namespace: 'llm-cost-guard-examples' });

  const guard = createDemoGuard({
    storage,
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const firstResult = await guard.run(
    {
      project: { id: 'redis-demo' },
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
      user: { id: 'redis-user-01' },
      request: { messages: [{ role: 'user', content: 'First Redis-backed usage record.' }] },
      attribution: {
        feature: 'examples',
        endpoint: 'storage/redis-basic',
        tags: ['storage', 'redis'],
      },
    },
    async () => {
      return {
        result: { ok: true, requestNumber: 1 },
        usage: { inputTokens: 120, outputTokens: 60 },
      };
    },
  );

  const secondResult = await guard.run(
    {
      project: { id: 'redis-demo' },
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
      user: { id: 'redis-user-01' },
      request: { messages: [{ role: 'user', content: 'Second Redis-backed usage record.' }] },
      attribution: {
        feature: 'examples',
        endpoint: 'storage/redis-basic',
        tags: ['storage', 'redis'],
      },
    },
    async () => {
      return {
        result: { ok: true, requestNumber: 2 },
        usage: { inputTokens: 140, outputTokens: 80 },
      };
    },
  );

  printGuardResult('storage/redis-basic / first request', firstResult);
  printGuardResult('storage/redis-basic / second request', secondResult);

  const summary = await storage.getSpendSummary({ projectId: 'redis-demo' });

  console.log('\nredis spend summary:');
  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('storage/redis-basic', wrappedError);
});
