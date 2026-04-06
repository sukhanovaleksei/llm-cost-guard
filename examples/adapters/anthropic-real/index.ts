import Anthropic from '@anthropic-ai/sdk';

import { wrapAnthropic } from '../../../src/adapters/anthropic/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { getRequiredEnv } from '../../_shared/getRequiredEnv.js';
import { loadExampleEnv } from '../../_shared/loadExampleEnv.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

loadExampleEnv(import.meta.url);

const main = async (): Promise<void> => {
  const apiKey = getRequiredEnv('ANTHROPIC_API_KEY');
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4';

  const client = new Anthropic({ apiKey });
  const anthropic = wrapAnthropic(client);

  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const result = await anthropic.messages.create(
    guard,
    {
      project: { id: 'anthropic-real-example' },
      user: { id: 'real-user-001' },
      attribution: {
        feature: 'examples',
        endpoint: 'adapters/anthropic-real',
        tags: ['adapter', 'anthropic', 'real'],
      },
    },
    {
      model,
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: 'Explain why LLM cost limits are useful in production systems.',
        },
      ],
    },
  );

  printGuardResult('adapters/anthropic-real', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('adapters/anthropic-real', wrappedError);
  process.exitCode = 1;
});
