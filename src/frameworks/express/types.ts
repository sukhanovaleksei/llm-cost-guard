import type { JsonObject } from '../../types/json.js';
import type { RunContext } from '../../types/run.js';
import type {
  HttpGuardContextFactory,
  HttpGuardTools,
  HttpRequestMetadata,
} from '../shared/types.js';

export type ExpressHeaderValue = string | string[] | undefined;
export type ExpressQueryValue =
  | string
  | undefined
  | ExpressQueryValue[]
  | { [key: string]: ExpressQueryValue };

export interface ExpressRouteLike {
  path?: string | undefined;
}

export interface ExpressRequestLike {
  method: string;
  path?: string | undefined;
  originalUrl?: string | undefined;
  baseUrl?: string | undefined;
  route?: ExpressRouteLike | undefined;
  ip?: string | undefined;
  headers: Record<string, ExpressHeaderValue>;
  query?: Record<string, ExpressQueryValue> | undefined;
}

export interface ExpressResponseLike {
  locals: Record<string, ExpressGuardLocalsValue>;
  headersSent?: boolean;
  status(code: number): this;
  json(body: JsonObject): this;
  setHeader(name: string, value: string): void;
}

export type ExpressNextFunction = (error?: Error) => void;

export interface ExpressGuardRequestState {
  metadata: HttpRequestMetadata;
  context: RunContext;
}

export type ExpressGuardLocalsValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | HttpRequestMetadata
  | RunContext
  | ExpressGuardRequestState;

export interface AttachExpressGuardContextOptions<TRequest extends ExpressRequestLike> {
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
  localsKey?: string | undefined;
}

export interface ExpressGuardHandlerInput<
  TRequest extends ExpressRequestLike,
  TResponse extends ExpressResponseLike,
> {
  request: TRequest;
  response: TResponse;
  tools: HttpGuardTools;
}

export interface WithGuardedExpressHandlerOptions<TRequest extends ExpressRequestLike> {
  guard: import('../../types/config.js').Guard;
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
}

export const DEFAULT_EXPRESS_GUARD_LOCALS_KEY = '__llmCostGuard';
