import { describe, expect, it, vi } from 'vitest';

import type {
  OpenAIResponseLike,
  OpenAIResponsesCreateRequest,
} from '../src/adapters/openai/types.js';
import {
  createGuard,
  InvalidOpenAIAdapterRequestError,
  RequestBudgetExceededError,
  wrapOpenAI,
} from '../src/index.js';

interface TestOpenAIRequest extends OpenAIResponsesCreateRequest {
  temperature?: number;
}

interface TestOpenAIResponse extends OpenAIResponseLike {
  id: string;
  object: 'response';
  output_text?: string;
}

const pricing = [
  {
    providerId: 'openai',
    model: 'gpt-4o',
    inputCostPerMillionTokens: 2.5,
    outputCostPerMillionTokens: 10,
  },
  {
    providerId: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillionTokens: 0.15,
    outputCostPerMillionTokens: 0.6,
  },
];

const createTestClient = (
  implementation?: (request: TestOpenAIRequest) => Promise<TestOpenAIResponse>,
) => {
  const create = vi.fn(
    implementation ??
      (async (request: TestOpenAIRequest): Promise<TestOpenAIResponse> => {
        return {
          id: 'resp_1',
          object: 'response',
          output_text: typeof request.input === 'string' ? request.input : 'ok',
          usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 },
        };
      }),
  );

  return { client: { responses: { create } }, create };
};

describe('wrapOpenAI', () => {
  it('normalizes context from request.model and request.max_output_tokens', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    const { client, create } = createTestClient();
    const openai = wrapOpenAI(client);

    const result = await openai.responses.create(
      guard,
      {},
      { model: 'gpt-4o-mini', input: 'Hello world', max_output_tokens: 500 },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].model).toBe('gpt-4o-mini');
    expect(create.mock.calls[0]?.[0].max_output_tokens).toBe(500);

    expect(result.context.project.id).toBe('app-main');
    expect(result.context.provider.id).toBe('openai');
    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.context.provider.maxTokens).toBe(500);

    expect(result.actualUsage?.inputTokens).toBe(100);
    expect(result.actualUsage?.outputTokens).toBe(20);
    expect(result.actualUsage?.totalTokens).toBe(120);
  });

  it('does not call OpenAI client when request is blocked by guard policy', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing,
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const { client, create } = createTestClient();
    const openai = wrapOpenAI(client);

    await expect(
      openai.responses.create(
        guard,
        {},
        {
          model: 'gpt-4o-mini',
          input: 'Explain distributed systems in depth',
          max_output_tokens: 1000,
        },
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    expect(create).not.toHaveBeenCalled();
  });

  it('uses downgraded model and max_output_tokens from resolved context', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing,
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: {
          onRequestBudgetExceeded: { fallbackModel: 'gpt-4o-mini', fallbackMaxTokens: 400 },
        },
      },
    });

    const { client, create } = createTestClient();
    const openai = wrapOpenAI(client);

    const result = await openai.responses.create(
      guard,
      { provider: { id: 'openai', model: 'gpt-4o', maxTokens: 1000 } },
      { model: 'gpt-4o', input: 'Hello world', max_output_tokens: 1000 },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].model).toBe('gpt-4o-mini');
    expect(create.mock.calls[0]?.[0].max_output_tokens).toBe(400);

    expect(result.decision.action).toBe('downgrade');
    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.context.provider.maxTokens).toBe(400);
  });

  it('returns plain response when OpenAI response has no usage', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    const { client } = createTestClient(async (): Promise<TestOpenAIResponse> => {
      return { id: 'resp_2', object: 'response', output_text: 'ok' };
    });

    const openai = wrapOpenAI(client);

    const result = await openai.responses.create(
      guard,
      {},
      { model: 'gpt-4o-mini', input: 'Hello world' },
    );

    expect(result.result).toEqual({ id: 'resp_2', object: 'response', output_text: 'ok' });
    expect(result.actualUsage).toBeUndefined();
  });

  it('throws typed error for streaming requests', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    const { client } = createTestClient();
    const openai = wrapOpenAI(client);

    await expect(
      openai.responses.create(guard, {}, {
        model: 'gpt-4o-mini',
        input: 'Hello world',
        stream: true,
      } as TestOpenAIRequest & { stream: true }),
    ).rejects.toBeInstanceOf(InvalidOpenAIAdapterRequestError);
  });

  it('throws typed error when context.provider.id is not openai', async () => {
    const guard = createGuard({ defaultProjectId: 'app-main', pricing });

    const { client } = createTestClient();
    const openai = wrapOpenAI(client);

    await expect(
      openai.responses.create(
        guard,
        { provider: { id: 'anthropic', model: 'gpt-4o-mini' } },
        { model: 'gpt-4o-mini', input: 'Hello world' },
      ),
    ).rejects.toBeInstanceOf(InvalidOpenAIAdapterRequestError);
  });
});
