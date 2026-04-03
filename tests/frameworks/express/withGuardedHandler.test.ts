import { describe, expect, it, vi } from 'vitest';

import { RequestBudgetExceededError } from '../../../src/errors/RequestBudgetExceededError.js';
import { withGuardedHandler } from '../../../src/frameworks/express/withGuardedHandler.js';
import type { ResolvedRunContext } from '../../../src/types/run.js';
import {
  createBaseRunContext,
  createExpressRequest,
  createTestGuard,
  createThrowingGuard,
  flushAsync,
  TestExpressResponse,
} from '../helpers.js';

describe('withGuardedHandler', () => {
  it('builds context and runs guard successfully', async () => {
    const guard = createTestGuard();
    const response = new TestExpressResponse();
    const request = createExpressRequest({
      headers: { 'x-user-id': 'user-42', 'x-request-id': 'req-42' },
    });
    const next = vi.fn<(error?: Error) => void>();

    let capturedContext: ResolvedRunContext | undefined;

    const wrapped = withGuardedHandler(
      {
        guard,
        contextFactory: ({ request: currentRequest, metadata }) => ({
          user: {
            id:
              typeof currentRequest.headers['x-user-id'] === 'string'
                ? currentRequest.headers['x-user-id']
                : undefined,
          },
          attribution: { feature: 'chat', endpoint: metadata.path },
        }),
      },
      async ({ response: currentResponse, tools }) => {
        const result = await tools.run(createBaseRunContext(), async (resolvedContext) => {
          capturedContext = resolvedContext;
          return { ok: true, providerId: resolvedContext.provider.id };
        });

        currentResponse.status(200).json({ ok: true, projectId: result.context.project.id });
      },
    );

    wrapped(request, response, next);
    await flushAsync();

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true, projectId: 'test-project' });

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.project.id).toBe('test-project');
    expect(capturedContext?.provider.id).toBe('openai');
    expect(capturedContext?.provider.model).toBe('gpt-4o-mini');
    expect(capturedContext?.user?.id).toBe('user-42');
    expect(capturedContext?.attribution.feature).toBe('chat');
    expect(capturedContext?.metadata.requestId).toBe('req-42');
  });

  it('forwards guard errors to next', async () => {
    const guard = createThrowingGuard(
      new RequestBudgetExceededError({
        providerId: 'openai',
        model: 'gpt-4o-mini',
        limitType: 'worst-case',
        configuredLimitUsd: 0.01,
        actualCostUsd: 0.02,
        estimatedInputCostUsd: 0.005,
        estimatedWorstCaseCostUsd: 0.02,
      }),
    );

    const response = new TestExpressResponse();
    const request = createExpressRequest();
    const next = vi.fn<(error?: Error) => void>();

    const wrapped = withGuardedHandler({ guard }, async ({ tools }) => {
      await tools.run(createBaseRunContext(), async () => {
        return { ok: true };
      });
    });

    wrapped(request, response, next);
    await flushAsync();

    expect(next).toHaveBeenCalledTimes(1);

    const firstCallArgument = next.mock.calls[0]?.[0];
    expect(firstCallArgument).toBeInstanceOf(RequestBudgetExceededError);
  });
});
