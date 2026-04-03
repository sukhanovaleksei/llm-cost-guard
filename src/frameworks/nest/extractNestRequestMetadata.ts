import type { HttpRequestMetadata } from '../shared/types.js';
import type { NestHeaderValue, NestQueryValue, NestRequestLike } from './types.js';

const readFirstValue = (value: NestHeaderValue | NestQueryValue): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
};

export const extractNestRequestMetadata = (request: NestRequestLike): HttpRequestMetadata => {
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

  return {
    method: request.method,
    path: request.originalUrl ?? request.path ?? '/',
    route: request.route?.path,
    ip: request.ip,
    requestId: headers['x-request-id'] ?? headers['x-correlation-id'],
    headers,
    query,
  };
};
