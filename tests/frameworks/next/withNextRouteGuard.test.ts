import { describe, expect, it } from 'vitest';

import { RateLimitedError } from '../../../src/errors/RateLimitedError.js';
import { withNextRouteGuard } from '../../../src/frameworks/next/withNextRouteGuard.js';
import type { JsonObject, JsonValue } from '../../../src/types/json.js';
import type { ResolvedRunContext } from '../../../src/types/run.js';
import {
  createBaseRunContext,
  createTestGuard,
  createTestNextResponse,
  createThrowingGuard,
  type TestNextResponse,
} from '../helpers.js';

const responseFactory = (input: {
  statusCode: number;
  headers?: Record<string, string>;
  body: JsonObject;
}): TestNextResponse => {
  return createTestNextResponse(input);
};

const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

describe('withNextRouteGuard', () => {
  it('builds context and returns successful response', async () => {
    const guard = createTestGuard();
    let capturedContext: ResolvedRunContext | undefined;

    const handler = withNextRouteGuard<Request, TestNextResponse>(
      {
        guard,
        responseFactory,
        contextFactory: ({ metadata }) => ({
          user: { id: metadata.headers['x-user-id'] },
          attribution: { feature: 'chat', endpoint: metadata.path },
        }),
      },
      async ({ tools }) => {
        const result = await tools.run(createBaseRunContext(), async (resolvedContext) => {
          capturedContext = resolvedContext;
          return { ok: true };
        });

        return responseFactory({
          statusCode: 200,
          body: { ok: true, projectId: result.context.project.id },
        });
      },
    );

    const request = new Request('https://example.com/api/chat?lang=en', {
      method: 'POST',
      headers: { 'x-user-id': 'user-100', 'x-request-id': 'req-100' },
    });

    const response = await handler(request);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true, projectId: 'test-project' });

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.user?.id).toBe('user-100');
    expect(capturedContext?.provider.id).toBe('openai');
    expect(capturedContext?.provider.model).toBe('gpt-4o-mini');
    expect(capturedContext?.attribution.feature).toBe('chat');
    expect(capturedContext?.metadata.requestId).toBe('req-100');
  });

  it('maps guard errors to typed response via responseFactory', async () => {
    const guard = createThrowingGuard(
      new RateLimitedError({
        providerId: 'openai',
        model: 'gpt-4o-mini',
        scope: 'user',
        configuredLimit: 10,
        currentCount: 10,
        retryAfterSeconds: 12,
      }),
    );

    const handler = withNextRouteGuard<Request, TestNextResponse>(
      { guard, responseFactory },
      async ({ tools }) => {
        await tools.run(createBaseRunContext(), async () => {
          return { ok: true };
        });

        return responseFactory({ statusCode: 200, body: { ok: true } });
      },
    );

    const request = new Request('https://example.com/api/chat', { method: 'POST' });

    const response = await handler(request);

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('12');

    const errorValue = response.body.error;
    expect(isJsonObject(errorValue)).toBe(true);
    if (!isJsonObject(errorValue)) throw new Error('Expected response.body.error to be an object');

    expect(errorValue.code).toBe('RATE_LIMITED');
    expect(typeof errorValue.message).toBe('string');

    const detailsValue = errorValue.details;
    expect(isJsonObject(detailsValue)).toBe(true);
    if (!isJsonObject(detailsValue))
      throw new Error('Expected response.body.error.details to be an object');

    expect(detailsValue.providerId).toBe('openai');
    expect(detailsValue.model).toBe('gpt-4o-mini');
    expect(detailsValue.scope).toBe('user');
    expect(detailsValue.configuredLimit).toBe(10);
    expect(detailsValue.currentCount).toBe(10);
    expect(detailsValue.retryAfterSeconds).toBe(12);
  });
});
