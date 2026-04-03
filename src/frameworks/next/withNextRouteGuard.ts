import { createHttpGuardTools } from '../shared/createHttpGuardTools.js';
import { mapGuardErrorToHttpResponse } from '../shared/mapGuardErrorToHttpResponse.js';
import { extractNextRequestMetadata } from './extractNextRequestMetadata.js';
import type {
  NextRequestLike,
  NextRouteGuardHandler,
  NextRouteGuardOptions,
  NextRouteGuardTools,
} from './types.js';

export const withNextRouteGuard = <TRequest extends NextRequestLike, TResponse>(
  options: NextRouteGuardOptions<TRequest, TResponse>,
  handler: NextRouteGuardHandler<TRequest, TResponse>,
) => {
  return (request: TRequest): Promise<TResponse> => {
    const metadata = extractNextRequestMetadata(request);

    const toolsBase = createHttpGuardTools({
      guard: options.guard,
      request,
      metadata,
      ...(options.contextFactory !== undefined ? { contextFactory: options.contextFactory } : {}),
      ...(options.defaultContext !== undefined ? { defaultContext: options.defaultContext } : {}),
    });

    const tools: NextRouteGuardTools = {
      metadata,
      buildContext: toolsBase.buildContext,
      run: toolsBase.run,
      runWithContext: toolsBase.runWithContext,
    };

    return handler({ request, tools }).catch((error: Error) => {
      const mapped = mapGuardErrorToHttpResponse(error);

      if (mapped === undefined) throw error;

      return options.responseFactory({
        statusCode: mapped.statusCode,
        headers: mapped.headers,
        body: mapped.body,
      });
    });
  };
};
