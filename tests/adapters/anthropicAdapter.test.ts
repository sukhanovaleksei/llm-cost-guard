import { describe, expect, it, vi } from 'vitest';

import { parseAnthropicUsage } from '../../src/adapters/anthropic/parseAnthropicUsage.js';
import type {
  AnthropicClientLike,
  AnthropicMessageResponse,
  AnthropicMessagesCreateRequest,
} from '../../src/adapters/anthropic/types.js';
import {
  createGuard,
  InvalidAnthropicAdapterRequestError,
  RequestBudgetExceededError,
  wrapAnthropic,
} from '../../src/index.js';

const createGuardWithPricing = (config: Parameters<typeof createGuard>[0] = {}) => {
  return createGuard({
    defaultProjectId: 'app-main',
    pricing: [
      {
        providerId: 'anthropic',
        model: 'claude-4-5-haiku-latest',
        inputCostPerMillionTokens: 0.8,
        outputCostPerMillionTokens: 4,
      },
      {
        providerId: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        inputCostPerMillionTokens: 3,
        outputCostPerMillionTokens: 15,
      },
    ],
    ...config,
  });
};

const createClient = () => {
  const create =
    vi.fn<(request: AnthropicMessagesCreateRequest) => Promise<AnthropicMessageResponse>>();

  const client = {
    messages: {
      async create(request: AnthropicMessagesCreateRequest): Promise<AnthropicMessageResponse> {
        return {
          id: 'msg_test_001',
          model: request.model,
          usage: { input_tokens: 120, output_tokens: 45 },
        };
      },
    },
  } satisfies AnthropicClientLike<
    (request: AnthropicMessagesCreateRequest) => Promise<AnthropicMessageResponse>
  >;

  return { client, create };
};

describe('wrapAnthropic', () => {
  it('returns undefined when usage is missing', () => {
    expect(parseAnthropicUsage({ id: 'msg_1' })).toBeUndefined();
  });

  it('returns undefined when usage has no token fields', () => {
    expect(parseAnthropicUsage({ id: 'msg_1', usage: {} })).toBeUndefined();
  });

  it('maps input_tokens and output_tokens', () => {
    expect(
      parseAnthropicUsage({ id: 'msg_1', usage: { input_tokens: 120, output_tokens: 45 } }),
    ).toEqual({ inputTokens: 120, outputTokens: 45 });
  });

  it('maps partial usage when only input_tokens exists', () => {
    expect(parseAnthropicUsage({ id: 'msg_1', usage: { input_tokens: 120 } })).toEqual({
      inputTokens: 120,
    });
  });

  it('derives provider, model and maxTokens from request', async () => {
    const guard = createGuardWithPricing();
    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1', usage: { input_tokens: 100, output_tokens: 20 } });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-4-5-haiku-latest',
        max_tokens: 300,
        messages: [{ role: 'user', content: 'Hello' }],
      },
    );

    expect(result.context.provider.id).toBe('anthropic');
    expect(result.context.provider.model).toBe('claude-4-5-haiku-latest');
    expect(result.context.provider.maxTokens).toBe(300);
  });

  it('builds request-like from system and messages for preflight', async () => {
    const guard = createGuardWithPricing();
    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1', usage: { input_tokens: 100, output_tokens: 20 } });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-4-5-haiku-latest',
        system: 'You are a helpful assistant',
        messages: [{ role: 'user', content: 'Explain queues in Node.js' }],
        max_tokens: 300,
      },
    );

    expect(result.preflight.estimatedInputTokens).toBeGreaterThan(0);
  });

  it('does not call client when blocked by guard policy', async () => {
    const guard = createGuardWithPricing({
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const { client, create } = createClient();
    const anthropic = wrapAnthropic(client);

    await expect(
      anthropic.messages.create(
        guard,
        {},
        {
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 4000,
          messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
        },
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    expect(create).not.toHaveBeenCalled();
  });

  it('applies downgraded model to outgoing request', async () => {
    const guard = createGuardWithPricing({
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 },
        downgrade: { onRequestBudgetExceeded: { fallbackModel: 'claude-4-5-haiku-latest' } },
      },
    });

    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1', usage: { input_tokens: 100, output_tokens: 20 } });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello world' }],
      },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0].model).toBe('claude-4-5-haiku-latest');
    expect(result.context.provider.model).toBe('claude-4-5-haiku-latest');
    expect(result.decision.action).toBe('downgrade');
  });

  it('applies downgraded max_tokens to outgoing request', async () => {
    const guard = createGuardWithPricing({
      pricing: [
        {
          providerId: 'anthropic',
          model: 'claude-4-5-haiku-latest',
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 1,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: { onRequestBudgetExceeded: { fallbackMaxTokens: 200 } },
      },
    });

    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1', usage: { input_tokens: 100, output_tokens: 20 } });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-4-5-haiku-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'Hello world' }],
      },
    );

    expect(create.mock.calls[0]?.[0].max_tokens).toBe(200);
    expect(result.context.provider.maxTokens).toBe(200);
  });

  it('maps anthropic usage into actualUsage', async () => {
    const guard = createGuardWithPricing();
    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1', usage: { input_tokens: 1000, output_tokens: 200 } });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-4-5-haiku-latest',
        max_tokens: 500,
        messages: [{ role: 'user', content: 'Hello' }],
      },
    );

    expect(result.actualUsage?.inputTokens).toBe(1000);
    expect(result.actualUsage?.outputTokens).toBe(200);
    expect(result.actualUsage?.totalTokens).toBe(1200);
  });

  it('returns response without actualUsage when provider usage is missing', async () => {
    const guard = createGuardWithPricing();
    const { client, create } = createClient();

    create.mockResolvedValue({ id: 'msg_1' });

    const anthropic = wrapAnthropic(client);

    const result = await anthropic.messages.create(
      guard,
      {},
      {
        model: 'claude-4-5-haiku-latest',
        max_tokens: 500,
        messages: [{ role: 'user', content: 'Hello' }],
      },
    );

    expect(result.result).toEqual({ id: 'msg_1' });
    expect(result.actualUsage).toBeUndefined();
  });

  it('throws for streaming requests', async () => {
    const guard = createGuardWithPricing();
    const { client } = createClient();
    const anthropic = wrapAnthropic(client);

    await expect(
      anthropic.messages.create(
        guard,
        {},
        {
          model: 'claude-4-5-haiku-latest',
          stream: true,
          max_tokens: 500,
          messages: [{ role: 'user', content: 'Hello' }],
        },
      ),
    ).rejects.toBeInstanceOf(InvalidAnthropicAdapterRequestError);
  });

  it('throws when context.provider.id is not anthropic', async () => {
    const guard = createGuardWithPricing();
    const { client } = createClient();
    const anthropic = wrapAnthropic(client);

    await expect(
      anthropic.messages.create(
        guard,
        { provider: { id: 'openai' } },
        {
          model: 'claude-4-5-haiku-latest',
          max_tokens: 500,
          messages: [{ role: 'user', content: 'Hello' }],
        },
      ),
    ).rejects.toBeInstanceOf(InvalidAnthropicAdapterRequestError);
  });
});
