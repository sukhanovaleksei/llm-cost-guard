import { describe, expect, it } from 'vitest';

import { AggregateBudgetExceededError } from '../../../src/errors/AggregateBudgetExceededError.js';
import { RateLimitedError } from '../../../src/errors/RateLimitedError.js';
import { RequestBudgetExceededError } from '../../../src/errors/RequestBudgetExceededError.js';
import { mapGuardErrorToHttpResponse } from '../../../src/frameworks/shared/mapGuardErrorToHttpResponse.js';

describe('mapGuardErrorToHttpResponse', () => {
  it('maps RequestBudgetExceededError to 403 response', () => {
    const error = new RequestBudgetExceededError({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      limitType: 'worst-case',
      configuredLimitUsd: 0.01,
      actualCostUsd: 0.02,
      estimatedInputCostUsd: 0.005,
      estimatedWorstCaseCostUsd: 0.02,
    });

    const response = mapGuardErrorToHttpResponse(error);

    expect(response).toBeDefined();
    expect(response?.statusCode).toBe(403);
    expect(response?.body.error.code).toBe('REQUEST_BUDGET_EXCEEDED');
    expect(response?.body.error.details).toEqual({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      limitType: 'worst-case',
      configuredLimitUsd: 0.01,
      actualCostUsd: 0.02,
      estimatedInputCostUsd: 0.005,
      estimatedWorstCaseCostUsd: 0.02,
    });
  });

  it('maps AggregateBudgetExceededError to 403 response', () => {
    const error = new AggregateBudgetExceededError({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      scope: 'project',
      window: 'daily',
      configuredLimitUsd: 1,
      currentSpendUsd: 0.8,
      estimatedRequestCostUsd: 0.4,
      projectedSpendUsd: 1.2,
    });

    const response = mapGuardErrorToHttpResponse(error);

    expect(response).toBeDefined();
    expect(response?.statusCode).toBe(403);
    expect(response?.body.error.code).toBe('AGGREGATE_BUDGET_EXCEEDED');
    expect(response?.body.error.details).toEqual({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      scope: 'project',
      window: 'daily',
      configuredLimitUsd: 1,
      currentSpendUsd: 0.8,
      estimatedRequestCostUsd: 0.4,
      projectedSpendUsd: 1.2,
    });
  });

  it('maps RateLimitedError to 429 response and retry-after header', () => {
    const error = new RateLimitedError({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      scope: 'user',
      configuredLimit: 10,
      currentCount: 10,
      retryAfterSeconds: 17,
    });

    const response = mapGuardErrorToHttpResponse(error);

    expect(response).toBeDefined();
    expect(response?.statusCode).toBe(429);
    expect(response?.headers).toEqual({ 'retry-after': '17' });
    expect(response?.body.error.code).toBe('RATE_LIMITED');
  });

  it('returns undefined for unrelated errors', () => {
    const response = mapGuardErrorToHttpResponse(new Error('boom'));

    expect(response).toBeUndefined();
  });
});
