import { createHttpGuardTools } from '../shared/createHttpGuardTools.js';
import { extractExpressRequestMetadata } from './extractExpressRequestMetadata.js';
import type {
  ExpressGuardHandlerInput,
  ExpressNextFunction,
  ExpressRequestLike,
  ExpressResponseLike,
  WithGuardedExpressHandlerOptions,
} from './types.js';

export const withGuardedHandler = <
  TRequest extends ExpressRequestLike,
  TResponse extends ExpressResponseLike,
>(
  options: WithGuardedExpressHandlerOptions<TRequest>,
  handler: (input: ExpressGuardHandlerInput<TRequest, TResponse>) => Promise<void>,
) => {
  return (request: TRequest, response: TResponse, next: ExpressNextFunction): void => {
    const metadata = extractExpressRequestMetadata(request);

    const tools = createHttpGuardTools({
      guard: options.guard,
      request,
      metadata,
      ...(options.contextFactory !== undefined ? { contextFactory: options.contextFactory } : {}),
      ...(options.defaultContext !== undefined ? { defaultContext: options.defaultContext } : {}),
    });

    handler({ request, response, tools }).catch((error: Error) => {
      next(error);
    });
  };
};
