import type { Guard } from '../../types/config.js';
import type { JsonObject } from '../../types/json.js';
import type { RunContext } from '../../types/run.js';
import type { HttpGuardContextFactory, HttpRequestMetadata } from '../shared/types.js';

export type NestHeaderValue = string | string[] | undefined;
export type NestQueryValue = string | string[] | undefined;

export interface NestRouteLike {
  path?: string;
}

export interface NestRequestLike {
  method: string;
  path?: string;
  originalUrl?: string;
  route?: NestRouteLike;
  ip?: string;
  headers: Record<string, NestHeaderValue>;
  query?: Record<string, NestQueryValue>;
  llmGuard?: NestGuardRequestState;
}

export interface NestResponseLike {
  status(code: number): this;
  json(body: JsonObject): this;
  setHeader(name: string, value: string): void;
}

export interface NestGuardRequestState {
  metadata: HttpRequestMetadata;
  context: RunContext;
}

export interface CreateNestGuardContextMiddlewareOptions<TRequest extends NestRequestLike> {
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
}

export interface CreateNestGuardRunnerOptions<TRequest extends NestRequestLike> {
  guard: Guard;
  request: TRequest;
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
}
