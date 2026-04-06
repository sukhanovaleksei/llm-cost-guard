import OpenAI from 'openai';

import { wrapOpenAI } from '../../../src/adapters/openai/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { getRequiredEnv } from '../../_shared/getRequiredEnv.js';
import { loadExampleEnv } from '../../_shared/loadExampleEnv.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

loadExampleEnv(import.meta.url);

const main = async (): Promise<void> => {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

  const client = new OpenAI({ apiKey });
  const openai = wrapOpenAI(client);

  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const result = await openai.responses.create(
    guard,
    {
      project: { id: 'openai-real-example' },
      user: { id: 'real-user-001' },
      attribution: {
        feature: 'examples',
        endpoint: 'adapters/openai-real',
        tags: ['adapter', 'openai', 'real'],
      },
    },
    {
      model,
      input: 'Explain why a guard layer is useful for LLM API requests.',
      max_output_tokens: 250,
    },
  );

  printGuardResult('adapters/openai-real', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('adapters/openai-real', wrappedError);
  process.exitCode = 1;
});
