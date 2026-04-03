import { URL } from 'node:url';

import type { HttpRequestMetadata } from '../shared/types.js';
import type { NextRequestLike } from './types.js';

export const extractNextRequestMetadata = (request: NextRequestLike): HttpRequestMetadata => {
  const url = new URL(request.url);
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};

  request.headers.forEach((value: string, key: string) => {
    headers[key.toLowerCase()] = value;
  });

  url.searchParams.forEach((value: string, key: string) => {
    query[key] = value;
  });

  return {
    method: request.method,
    path: url.pathname,
    route: url.pathname,
    ip: headers['x-forwarded-for'],
    requestId: headers['x-request-id'] ?? headers['x-correlation-id'],
    headers,
    query,
  };
};
