import type { NestMiddleware } from '@nestjs/common';

import { mergeRunContexts } from '../shared/mergeRunContexts.js';
import { extractNestRequestMetadata } from './extractNestRequestMetadata.js';
import type { CreateNestGuardContextMiddlewareOptions, NestRequestLike } from './types.js';

type NestNextFunction = () => void;

export const createNestGuardContextMiddleware = <TRequest extends NestRequestLike>(
  options: CreateNestGuardContextMiddlewareOptions<TRequest> = {},
) => {
  class LlmGuardContextMiddleware implements NestMiddleware {
    public use(request: TRequest, _response: object, next: NestNextFunction): void {
      const metadata = extractNestRequestMetadata(request);
      const factoryContext = options.contextFactory?.({ request, metadata }) ?? {};
      const context = mergeRunContexts(options.defaultContext ?? {}, factoryContext);

      request.llmGuard = { metadata, context };

      next();
    }
  }

  return LlmGuardContextMiddleware;
};
