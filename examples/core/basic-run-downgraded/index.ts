import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const main = async (): Promise<void> => {
  const guard = createDemoGuard({
    policies: {
      requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
      downgrade: {
        onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini', fallbackMaxTokens: 300 },
      },
    },
  });

  const result = await guard.run(
    {
      project: { id: 'core-downgraded' },
      provider: { id: 'openai', model: 'gpt-4o', maxTokens: 3000 },
      request: {
        messages: [
          { role: 'user', content: 'Summarize the history of event-driven architecture.' },
        ],
      },
      attribution: {
        feature: 'examples',
        endpoint: 'core/basic-run-downgraded',
        tags: ['core', 'downgrade'],
      },
    },
    async (context) => {
      return {
        result: {
          ok: true,
          effectiveModel: context.provider.model,
          effectiveMaxTokens: context.provider.maxTokens ?? null,
        },
        usage: { inputTokens: 180, outputTokens: 90 },
      };
    },
  );

  printGuardResult('core/basic-run-downgraded', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('core/basic-run-downgraded', wrappedError);
});
