import { describe, expect, it } from 'vitest';

import { createNestGuardRunner } from '../../../src/frameworks/nest/createNestGuardRunner.js';
import type { ResolvedRunContext } from '../../../src/types/run.js';
import { createBaseRunContext, createNestRequest, createTestGuard } from '../helpers.js';

describe('createNestGuardRunner', () => {
  it('uses llmGuard context from request when present', async () => {
    const guard = createTestGuard();
    let capturedContext: ResolvedRunContext | undefined;

    const request = createNestRequest({
      headers: { 'x-request-id': 'nest-req-1' },
      llmGuard: {
        metadata: {
          method: 'POST',
          path: '/chat',
          route: '/chat',
          ip: '127.0.0.1',
          requestId: 'nest-req-1',
          headers: { 'x-request-id': 'nest-req-1' },
          query: {},
        },
        context: {
          user: { id: 'nest-user-1' },
          attribution: { feature: 'chat', endpoint: '/chat' },
        },
      },
    });

    const tools = createNestGuardRunner({ guard, request });

    const result = await tools.run(createBaseRunContext(), async (resolvedContext) => {
      capturedContext = resolvedContext;
      return { ok: true };
    });

    expect(result.context.project.id).toBe('test-project');
    expect(capturedContext).toBeDefined();
    expect(capturedContext?.user?.id).toBe('nest-user-1');
    expect(capturedContext?.provider.id).toBe('openai');
    expect(capturedContext?.attribution.feature).toBe('chat');
    expect(capturedContext?.metadata.requestId).toBe('nest-req-1');
  });

  it('falls back to contextFactory when llmGuard context is absent', async () => {
    const guard = createTestGuard();
    let capturedContext: ResolvedRunContext | undefined;

    const request = createNestRequest({
      headers: { 'x-user-id': 'nest-user-2', 'x-request-id': 'nest-req-2' },
    });

    const tools = createNestGuardRunner({
      guard,
      request,
      contextFactory: ({ request: currentRequest, metadata }) => ({
        user: {
          id:
            typeof currentRequest.headers['x-user-id'] === 'string'
              ? currentRequest.headers['x-user-id']
              : undefined,
        },
        attribution: { feature: 'support-chat', endpoint: metadata.path },
      }),
    });

    await tools.run(createBaseRunContext(), async (resolvedContext) => {
      capturedContext = resolvedContext;
      return { ok: true };
    });

    expect(capturedContext).toBeDefined();
    expect(capturedContext?.user?.id).toBe('nest-user-2');
    expect(capturedContext?.attribution.feature).toBe('support-chat');
    expect(capturedContext?.metadata.requestId).toBe('nest-req-2');
  });
});
