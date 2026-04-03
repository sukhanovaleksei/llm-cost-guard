import type { Guard } from '../../types/config.js';
import type { JsonObject } from '../../types/json.js';
import type {
  ExecuteReturnValue,
  GuardResult,
  ResolvedRunContext,
  RunContext,
} from '../../types/run.js';
import type { HttpGuardContextFactory, HttpRequestMetadata } from '../shared/types.js';

export interface NextHeadersLike {
  forEach(callback: (value: string, key: string) => void): void;
  get(name: string): string | null;
}

export interface NextRequestLike {
  method: string;
  url: string;
  headers: NextHeadersLike;
}

export interface NextResponseFactoryInput {
  statusCode: number;
  headers: Record<string, string>;
  body: JsonObject;
}

export type NextResponseFactory<TResponse> = (input: NextResponseFactoryInput) => TResponse;

export interface NextRouteGuardOptions<TRequest extends NextRequestLike, TResponse> {
  guard: Guard;
  responseFactory: NextResponseFactory<TResponse>;
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
}

export interface NextRouteGuardTools {
  metadata: HttpRequestMetadata;

  buildContext(overrides?: RunContext): RunContext;

  run<TExecuteResult>(
    overrides: RunContext,
    execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
  ): Promise<GuardResult<TExecuteResult>>;

  runWithContext<TExecuteResult>(
    context: RunContext,
    execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
  ): Promise<GuardResult<TExecuteResult>>;
}

export interface NextRouteGuardHandlerInput<TRequest extends NextRequestLike> {
  request: TRequest;
  tools: NextRouteGuardTools;
}

export type NextRouteGuardHandler<TRequest extends NextRequestLike, TResponse> = (
  input: NextRouteGuardHandlerInput<TRequest>,
) => Promise<TResponse>;
