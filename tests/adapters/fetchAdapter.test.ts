import { describe, expect, it, vi } from 'vitest';

import type { FetchResponseLike } from '../../src/adapters/fetch/types.js';
import {
  createGuard,
  type JsonObject,
  mapParsedResponse,
  parseJsonResponse,
  RequestBudgetExceededError,
  wrapFetch,
} from '../../src/index.js';

interface ProviderUsage extends JsonObject {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface CompletionBody extends JsonObject {
  id: string;
  output_text: string;
  usage?: ProviderUsage;
}

const createJsonResponse = (
  body: CompletionBody,
  status = 200,
): FetchResponseLike<CompletionBody> => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',

    async json(): Promise<CompletionBody> {
      return body;
    },

    async text(): Promise<string> {
      return JSON.stringify(body);
    },
  };
};

const extractCompatibleUsage = (body: CompletionBody) => {
  const usage = body.usage;
  if (usage === undefined) return undefined;

  const hasInputTokens = usage.prompt_tokens !== undefined;
  const hasOutputTokens = usage.completion_tokens !== undefined;
  const hasTotalTokens = usage.total_tokens !== undefined;

  if (!hasInputTokens && !hasOutputTokens && !hasTotalTokens) return undefined;

  return {
    ...(hasInputTokens ? { inputTokens: usage.prompt_tokens } : {}),
    ...(hasOutputTokens ? { outputTokens: usage.completion_tokens } : {}),
    ...(hasTotalTokens ? { totalTokens: usage.total_tokens } : {}),
  };
};

describe('wrapFetch', () => {
  it('does not call fetch when request is blocked by guard policy', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'custom-http',
          model: 'x1',
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
        },
      ],
      mode: 'hard',
      policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.000001 } },
    });

    const fetch = vi.fn(
      async (): Promise<FetchResponseLike<CompletionBody>> =>
        createJsonResponse({ id: 'resp_1', output_text: 'Hello back' }),
    );

    const http = wrapFetch({ fetch });

    await expect(
      http.run(
        guard,
        {
          provider: { id: 'custom-http', model: 'x1', maxTokens: 1000 },
          request: {
            messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
          },
        },
        {
          buildRequest: () => ({
            url: 'https://api.example.com/v1/chat/completions',
            init: { method: 'POST' },
          }),
          parseResponse: parseJsonResponse,
          mapResult: mapParsedResponse,
          extractUsage: extractCompatibleUsage,
        },
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps parsed response and reconciles actual usage', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'custom-http',
          model: 'x1',
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
        },
      ],
    });

    const fetch = vi.fn(
      async (): Promise<FetchResponseLike<CompletionBody>> =>
        createJsonResponse({
          id: 'resp_2',
          output_text: 'Hello from provider',
          usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
        }),
    );

    const http = wrapFetch({ fetch });

    const result = await http.run(
      guard,
      {
        provider: { id: 'custom-http', model: 'x1', maxTokens: 300 },
        request: { messages: [{ role: 'user', content: 'Hello world' }] },
      },
      {
        buildRequest: () => ({
          url: 'https://api.example.com/v1/chat/completions',
          init: { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        }),
        parseResponse: parseJsonResponse,
        mapResult: (body) => ({ id: body.id, text: body.output_text }),
        extractUsage: extractCompatibleUsage,
      },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual({ id: 'resp_2', text: 'Hello from provider' });
    expect(result.actualUsage).toBeDefined();
    expect(result.actualUsage?.inputTokens).toBe(100);
    expect(result.actualUsage?.outputTokens).toBe(40);
    expect(result.actualUsage?.totalTokens).toBe(140);
  });

  it('passes downgraded model and maxTokens into buildRequest', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'custom-http',
          model: 'x-large',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
        {
          providerId: 'custom-http',
          model: 'x-small',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
      policies: {
        requestBudget: { maxEstimatedWorstCaseCostUsd: 0.001 },
        downgrade: {
          onRequestBudgetExceeded: { fallbackModel: 'x-small', fallbackMaxTokens: 400 },
        },
      },
    });

    let seenModel = '';
    let seenMaxTokens: number | undefined;

    const fetch = vi.fn(
      async (): Promise<FetchResponseLike<CompletionBody>> =>
        createJsonResponse({
          id: 'resp_3',
          output_text: 'downgraded response',
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
    );

    const http = wrapFetch({ fetch });

    const result = await http.run(
      guard,
      {
        provider: { id: 'custom-http', model: 'x-large', maxTokens: 1200 },
        request: {
          messages: [{ role: 'user', content: 'Hello world' }],
        },
      },
      {
        buildRequest: (resolvedContext) => {
          seenModel = resolvedContext.provider.model;
          seenMaxTokens = resolvedContext.provider.maxTokens;

          return {
            url: 'https://api.example.com/v1/chat/completions',
            init: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: resolvedContext.provider.model,
                max_tokens: resolvedContext.provider.maxTokens,
              }),
            },
          };
        },
        parseResponse: parseJsonResponse,
        mapResult: mapParsedResponse,
        extractUsage: extractCompatibleUsage,
      },
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(seenModel).toBe('x-small');
    expect(seenMaxTokens).toBe(400);
    expect(result.decision.action).toBe('downgrade');
    expect(result.context.provider.model).toBe('x-small');
    expect(result.context.provider.maxTokens).toBe(400);
  });

  it('returns plain result when usage is absent', async () => {
    const guard = createGuard({
      defaultProjectId: 'app-main',
      pricing: [
        {
          providerId: 'custom-http',
          model: 'x1',
          inputCostPerMillionTokens: 1,
          outputCostPerMillionTokens: 2,
        },
      ],
    });

    const fetch = vi.fn(
      async (): Promise<FetchResponseLike<CompletionBody>> =>
        createJsonResponse({ id: 'resp_4', output_text: 'no usage payload' }),
    );

    const http = wrapFetch({ fetch });

    const result = await http.run(
      guard,
      {
        provider: { id: 'custom-http', model: 'x1' },
      },
      {
        buildRequest: () => ({
          url: 'https://api.example.com/v1/chat/completions',
          init: { method: 'POST' },
        }),
        parseResponse: parseJsonResponse,
        mapResult: mapParsedResponse,
        extractUsage: extractCompatibleUsage,
      },
    );

    expect(result.result).toEqual({ id: 'resp_4', output_text: 'no usage payload' });
    expect(result.actualUsage).toBeUndefined();
  });
});
