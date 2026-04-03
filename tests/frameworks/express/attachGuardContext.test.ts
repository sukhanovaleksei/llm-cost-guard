import { describe, expect, it, vi } from 'vitest';

import { attachGuardContext } from '../../../src/frameworks/express/attachGuardContext.js';
import { DEFAULT_EXPRESS_GUARD_LOCALS_KEY } from '../../../src/frameworks/express/types.js';
import { createExpressRequest, TestExpressResponse } from '../helpers.js';

describe('attachGuardContext', () => {
  it('stores metadata and context in response.locals', () => {
    const middleware = attachGuardContext({
      contextFactory: ({ metadata, request }) => ({
        user: {
          id:
            typeof request.headers['x-user-id'] === 'string'
              ? request.headers['x-user-id']
              : undefined,
        },
        attribution: { feature: 'chat', endpoint: metadata.path },
      }),
    });

    const request = createExpressRequest({
      headers: { 'x-user-id': 'user-1', 'x-request-id': 'req-1' },
      query: { lang: 'en' },
    });
    const response = new TestExpressResponse();
    const next = vi.fn<(error?: Error) => void>();

    middleware(request, response, next);

    const state = response.locals[DEFAULT_EXPRESS_GUARD_LOCALS_KEY];

    expect(next).toHaveBeenCalledTimes(1);
    expect(state).toBeDefined();

    if (state !== null && typeof state === 'object' && 'metadata' in state && 'context' in state) {
      expect(state.metadata).toEqual({
        method: 'POST',
        path: '/chat',
        route: '/chat',
        ip: '127.0.0.1',
        requestId: 'req-1',
        headers: { 'x-user-id': 'user-1', 'x-request-id': 'req-1' },
        query: { lang: 'en' },
      });

      expect(state.context).toEqual({
        user: { id: 'user-1' },
        attribution: { feature: 'chat', endpoint: '/chat' },
      });
    }
  });
});
