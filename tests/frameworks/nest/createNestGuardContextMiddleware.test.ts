import { describe, expect, it } from 'vitest';

import { createNestGuardContextMiddleware } from '../../../src/frameworks/nest/createNestGuardContextMiddleware.js';
import { createNestGuardRunner } from '../../../src/frameworks/nest/createNestGuardRunner.js';
import type { NestRequestLike } from '../../../src/frameworks/nest/types.js';
import { createGuard, createMemoryStorage } from '../../../src/index.js';

describe('createNestGuardContextMiddleware', () => {
  it('merges defaultContext with contextFactory result', async () => {
    const guard = createGuard({
      defaultProjectId: 'fallback-project',
      storage: createMemoryStorage(),
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          inputCostPerMillionTokens: 0.15,
          outputCostPerMillionTokens: 0.6,
        },
      ],
    });

    const request: NestRequestLike = {
      method: 'POST',
      path: '/chat',
      originalUrl: '/chat',
      route: { path: '/chat' },
      ip: '127.0.0.1',
      headers: { 'x-user-id': 'nest-user-01', 'x-request-id': 'nest-request-01' },
      query: {},
    };

    const MiddlewareClass = createNestGuardContextMiddleware({
      defaultContext: {
        project: { id: 'nest-demo' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
      },
      contextFactory: ({ request: inputRequest }) => {
        const headerValue = inputRequest.headers['x-user-id'];

        return {
          user: {
            id: Array.isArray(headerValue)
              ? (headerValue[0] ?? 'anonymous')
              : (headerValue ?? 'anonymous'),
          },
        };
      },
    });

    const middleware = new MiddlewareClass();

    middleware.use(request, {}, () => {
      return;
    });

    expect(request.llmGuard?.context.project?.id).toBe('nest-demo');
    expect(request.llmGuard?.context.provider?.id).toBe('openai');
    expect(request.llmGuard?.context.provider?.model).toBe('gpt-4o-mini');
    expect(request.llmGuard?.context.provider?.maxTokens).toBe(300);
    expect(request.llmGuard?.context.user?.id).toBe('nest-user-01');

    const tools = createNestGuardRunner({
      guard,
      request,
    });

    const result = await tools.run(
      {
        request: { messages: [{ role: 'user', content: 'Hello from test' }] },
        attribution: { feature: 'tests', endpoint: '/chat', tags: ['nest'] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 50 } };
      },
    );

    expect(result.context.project.id).toBe('nest-demo');
    expect(result.context.provider.id).toBe('openai');
    expect(result.context.provider.model).toBe('gpt-4o-mini');
    expect(result.context.user?.id).toBe('nest-user-01');
  });
});
