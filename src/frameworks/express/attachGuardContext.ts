import { extractExpressRequestMetadata } from './extractExpressRequestMetadata.js';
import type {
  AttachExpressGuardContextOptions,
  ExpressNextFunction,
  ExpressRequestLike,
  ExpressResponseLike,
} from './types.js';
import { DEFAULT_EXPRESS_GUARD_LOCALS_KEY } from './types.js';

export const attachGuardContext = <
  TRequest extends ExpressRequestLike,
  TResponse extends ExpressResponseLike,
>(
  options: AttachExpressGuardContextOptions<TRequest> = {},
) => {
  const localsKey = options.localsKey ?? DEFAULT_EXPRESS_GUARD_LOCALS_KEY;

  return (request: TRequest, response: TResponse, next: ExpressNextFunction): void => {
    const metadata = extractExpressRequestMetadata(request);
    const context = options.contextFactory?.({ request, metadata }) ?? options.defaultContext ?? {};

    response.locals[localsKey] = { metadata, context };

    next();
  };
};
