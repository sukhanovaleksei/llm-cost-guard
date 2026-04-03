import { mapGuardErrorToHttpResponse } from '../shared/mapGuardErrorToHttpResponse.js';
import type { ExpressNextFunction, ExpressRequestLike, ExpressResponseLike } from './types.js';

export const createExpressGuardErrorHandler = <
  TRequest extends ExpressRequestLike,
  TResponse extends ExpressResponseLike,
>() => {
  return (
    error: Error,
    _request: TRequest,
    response: TResponse,
    next: ExpressNextFunction,
  ): void => {
    const mapped = mapGuardErrorToHttpResponse(error);

    if (mapped === undefined) {
      next(error);
      return;
    }

    if (response.headersSent === true) {
      next(error);
      return;
    }

    for (const [name, value] of Object.entries(mapped.headers)) response.setHeader(name, value);

    response.status(mapped.statusCode).json(mapped.body);
  };
};
