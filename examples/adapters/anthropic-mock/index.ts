import {
  type AnthropicClientLike,
  type AnthropicMessageResponse,
  type AnthropicMessagesCreateRequest,
  wrapAnthropic,
} from '../../../src/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

interface MockAnthropicResponse extends AnthropicMessageResponse {
  id: string;
  model: string;
  content_text: string;
}

const mockClient: AnthropicClientLike<AnthropicMessagesCreateRequest, MockAnthropicResponse> = {
  messages: {
    async create(request: AnthropicMessagesCreateRequest): Promise<MockAnthropicResponse> {
      return {
        id: 'msg_mock_anthropic_001',
        model: request.model ?? 'claude-3-5-haiku-latest',
        content_text: 'Mock Anthropic response',
        usage: { input_tokens: 190, output_tokens: 80 },
      };
    },
  },
};

const main = async (): Promise<void> => {
  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const anthropic = wrapAnthropic(mockClient);

  const result = await anthropic.messages.create(
    guard,
    {
      project: { id: 'adapter-anthropic' },
      user: { id: 'user-anthropic-01' },
      attribution: {
        feature: 'examples',
        endpoint: 'adapters/anthropic-mock',
        tags: ['adapter', 'anthropic'],
      },
    },
    {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: 'Explain why budget policies are useful for LLM APIs.',
        },
      ],
    },
  );

  printGuardResult('adapters/anthropic-mock', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('adapters/anthropic-mock', wrappedError);
});
