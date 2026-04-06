import {
  type OpenAIClientLike,
  type OpenAICreateFunction,
  type OpenAIResponseLike,
  type OpenAIResponsesCreateRequest,
  wrapOpenAI,
} from '../../../src/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

interface MockOpenAIResponse extends OpenAIResponseLike {
  id: string;
  output_text: string;
}

const mockClient = {
  responses: {
    async create(request: OpenAIResponsesCreateRequest): Promise<MockOpenAIResponse> {
      const prompt =
        typeof request.input === 'string'
          ? request.input
          : (request.instructions ?? 'OpenAI array input');

      return {
        id: 'resp_mock_openai_001',
        output_text: `Mock OpenAI response for: ${prompt}`,
        usage: { input_tokens: 210, output_tokens: 95, total_tokens: 305 },
      };
    },
  },
} satisfies OpenAIClientLike<
  OpenAICreateFunction<OpenAIResponsesCreateRequest, MockOpenAIResponse>
>;

const main = async (): Promise<void> => {
  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const openai = wrapOpenAI(mockClient);

  const result = await openai.responses.create(
    guard,
    {
      project: { id: 'adapter-openai' },
      user: { id: 'user-openai-01' },
      attribution: {
        feature: 'examples',
        endpoint: 'adapters/openai-mock',
        tags: ['adapter', 'openai'],
      },
    },
    {
      model: 'gpt-4o-mini',
      input: 'Explain the purpose of a guard layer around LLM calls.',
      max_output_tokens: 250,
    },
  );

  printGuardResult('adapters/openai-mock', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('adapters/openai-mock', wrappedError);
});
