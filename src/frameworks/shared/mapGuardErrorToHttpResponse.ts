import { AggregateBudgetExceededError } from '../../errors/AggregateBudgetExceededError.js';
import { RateLimitedError } from '../../errors/RateLimitedError.js';
import { RequestBudgetExceededError } from '../../errors/RequestBudgetExceededError.js';
import type { HttpGuardErrorResponse } from './types.js';

export const mapGuardErrorToHttpResponse = (error: Error): HttpGuardErrorResponse | undefined => {
  if (error instanceof RequestBudgetExceededError) {
    return {
      statusCode: 403,
      headers: {},
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: {
            providerId: error.providerId,
            model: error.model,
            limitType: error.limitType,
            configuredLimitUsd: error.configuredLimitUsd,
            actualCostUsd: error.actualCostUsd,
            estimatedInputCostUsd: error.estimatedInputCostUsd,
            estimatedWorstCaseCostUsd: error.estimatedWorstCaseCostUsd,
          },
        },
      },
    };
  }

  if (error instanceof AggregateBudgetExceededError) {
    return {
      statusCode: 403,
      headers: {},
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: {
            providerId: error.providerId,
            model: error.model,
            scope: error.scope,
            window: error.window,
            configuredLimitUsd: error.configuredLimitUsd,
            currentSpendUsd: error.currentSpendUsd,
            estimatedRequestCostUsd: error.estimatedRequestCostUsd,
            projectedSpendUsd: error.projectedSpendUsd,
          },
        },
      },
    };
  }

  if (error instanceof RateLimitedError) {
    return {
      statusCode: 429,
      headers: { 'retry-after': String(error.retryAfterSeconds) },
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: {
            providerId: error.providerId,
            model: error.model,
            scope: error.scope,
            configuredLimit: error.configuredLimit,
            currentCount: error.currentCount,
            retryAfterSeconds: error.retryAfterSeconds,
          },
        },
      },
    };
  }

  return undefined;
};
