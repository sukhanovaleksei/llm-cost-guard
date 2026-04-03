import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';

import { AggregateBudgetExceededError } from '../../errors/AggregateBudgetExceededError.js';
import { RateLimitedError } from '../../errors/RateLimitedError.js';
import { RequestBudgetExceededError } from '../../errors/RequestBudgetExceededError.js';
import { mapGuardErrorToHttpResponse } from '../shared/mapGuardErrorToHttpResponse.js';
import type { NestResponseLike } from './types.js';

@Catch(RequestBudgetExceededError, AggregateBudgetExceededError, RateLimitedError)
export class LlmGuardExceptionFilter implements ExceptionFilter {
  public catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<NestResponseLike>();
    const mapped = mapGuardErrorToHttpResponse(exception);

    if (mapped === undefined) {
      response
        .status(500)
        .json({ error: { code: 'INTERNAL_SERVER_ERROR', message: exception.message } });
      return;
    }

    for (const [name, value] of Object.entries(mapped.headers)) {
      response.setHeader(name, value);
    }

    response.status(mapped.statusCode).json(mapped.body);
  }
}
