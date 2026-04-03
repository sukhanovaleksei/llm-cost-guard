import type { HttpRequestMetadata } from '../shared/types.js';
import type { ExpressHeaderValue, ExpressQueryValue, ExpressRequestLike } from './types.js';

const readFirstValue = (value: ExpressHeaderValue | ExpressQueryValue): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

export const extractExpressRequestMetadata = (request: ExpressRequestLike): HttpRequestMetadata => {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};

  for (const [key, value] of Object.entries(request.headers)) {
    const normalizedValue = readFirstValue(value);
    if (normalizedValue !== undefined) headers[key.toLowerCase()] = normalizedValue;
  }

  for (const [key, value] of Object.entries(request.query ?? {})) {
    const normalizedValue = readFirstValue(value);
    if (normalizedValue !== undefined) query[key] = normalizedValue;
  }

  const requestId = headers['x-request-id'] ?? headers['x-correlation-id'];

  return {
    method: request.method,
    path: request.originalUrl ?? request.path ?? '/',
    route: request.route?.path,
    ip: request.ip,
    requestId,
    headers,
    query,
  };
};
