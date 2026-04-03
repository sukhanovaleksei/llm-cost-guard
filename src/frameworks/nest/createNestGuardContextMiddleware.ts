import type { NestMiddleware } from '@nestjs/common';

import { extractNestRequestMetadata } from './extractNestRequestMetadata.js';
import type { NestRequestLike } from './types.js';
import type { CreateNestGuardContextMiddlewareOptions } from './types.js';

type NestNextFunction = () => void;

export const createNestGuardContextMiddleware = <TRequest extends NestRequestLike>(
  options: CreateNestGuardContextMiddlewareOptions<TRequest> = {},
) => {
  class LlmGuardContextMiddleware implements NestMiddleware {
    public use(request: TRequest, _response: object, next: NestNextFunction): void {
      const metadata = extractNestRequestMetadata(request);
      const context =
        options.contextFactory?.({ request, metadata }) ?? options.defaultContext ?? {};

      request.llmGuard = {
        metadata,
        context,
      };

      next();
    }
  }

  return LlmGuardContextMiddleware;
};
