import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const main = async (): Promise<void> => {
  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const result = await guard.run(
    {
      project: { id: 'core-basic' },
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 400 },
      user: { id: 'user-001' },
      attribution: { feature: 'examples', endpoint: 'core/basic-run', tags: ['core', 'basic'] },
      request: {
        messages: [
          {
            role: 'user',
            content: 'Explain how request budget estimation works in plain English.',
          },
        ],
      },
    },
    async (context) => {
      return {
        result: {
          ok: true,
          model: context.provider.model,
          answer:
            'The guard estimates token cost before the model call and can block expensive requests.',
        },
        usage: { inputTokens: 220, outputTokens: 120 },
      };
    },
  );

  printGuardResult('core/basic-run', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('core/basic-run', wrappedError);
});
