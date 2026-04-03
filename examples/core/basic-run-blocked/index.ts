import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';

const main = async (): Promise<void> => {
  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 } },
  });

  await guard.run(
    {
      project: { id: 'core-blocked' },
      provider: { id: 'openai', model: 'gpt-4o', maxTokens: 4000 },
      request: {
        messages: [
          {
            role: 'user',
            content: 'Write a very long and detailed report about distributed systems.',
          },
        ],
      },
      attribution: {
        feature: 'examples',
        endpoint: 'core/basic-run-blocked',
        tags: ['core', 'blocked'],
      },
    },
    async () => {
      return { ok: true };
    },
  );
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('core/basic-run-blocked', wrappedError);
});
