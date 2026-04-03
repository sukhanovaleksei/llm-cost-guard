import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { RequestBudgetExceededError } from '../../../src/errors/RequestBudgetExceededError.js';
import { LlmGuardExceptionFilter } from '../../../src/frameworks/nest/llmGuardExceptionFilter.js';
import { TestNestResponse } from '../helpers.js';

describe('LlmGuardExceptionFilter', () => {
  it('maps guard error to HTTP response', () => {
    const filter = new LlmGuardExceptionFilter();
    const response = new TestNestResponse();

    const host = {
      switchToHttp() {
        return {
          getResponse: () => response,
          getRequest: () => ({ url: '/chat' }),
          getNext: () => undefined,
        };
      },
    } as ArgumentsHost;

    const error = new RequestBudgetExceededError({
      providerId: 'openai',
      model: 'gpt-4o-mini',
      limitType: 'worst-case',
      configuredLimitUsd: 0.01,
      actualCostUsd: 0.02,
      estimatedInputCostUsd: 0.005,
      estimatedWorstCaseCostUsd: 0.02,
    });

    filter.catch(error, host);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'REQUEST_BUDGET_EXCEEDED',
        message: error.message,
        details: {
          providerId: 'openai',
          model: 'gpt-4o-mini',
          limitType: 'worst-case',
          configuredLimitUsd: 0.01,
          actualCostUsd: 0.02,
          estimatedInputCostUsd: 0.005,
          estimatedWorstCaseCostUsd: 0.02,
        },
      },
    });
  });
});
