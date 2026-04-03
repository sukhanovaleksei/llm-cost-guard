import { describe, expect, it, vi } from 'vitest';

import { RateLimitedError } from '../../../src/errors/RateLimitedError.js';
import { createExpressGuardErrorHandler } from '../../../src/frameworks/express/createExpressGuardErrorHandler.js';
import { TestExpressResponse } from '../helpers.js';

describe('createExpressGuardErrorHandler', () => {
  it('maps rate limit error to 429 response', () => {
    const errorHandler = createExpressGuardErrorHandler();
    const response = new TestExpressResponse();
    const next = vi.fn<(error?: Error) => void>();

    const error = new RateLimitedError({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      scope: 'user',
      configuredLimit: 5,
      currentCount: 5,
      retryAfterSeconds: 30,
    });

    errorHandler(error, { method: 'POST', headers: {} }, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('30');
    expect(response.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: error.message,
        details: {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          scope: 'user',
          configuredLimit: 5,
          currentCount: 5,
          retryAfterSeconds: 30,
        },
      },
    });
  });

  it('passes unrelated errors to next', () => {
    const errorHandler = createExpressGuardErrorHandler();
    const response = new TestExpressResponse();
    const next = vi.fn<(error?: Error) => void>();
    const error = new Error('unexpected');

    errorHandler(error, { method: 'POST', headers: {} }, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });
});
