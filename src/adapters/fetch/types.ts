import type {
  ExecuteUsage,
  Guard,
  GuardResult,
  JsonValue,
  MaybePromise,
  RunContext,
} from '../../types/index.js';
import type { ResolvedRunContext } from '../../types/run.js';

export type FetchParsedResponse = JsonValue | string;

export interface FetchResponseLike<TJsonBody extends JsonValue = JsonValue> {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<TJsonBody>;
  text(): Promise<string>;
}

export type FetchFunction<TResponse extends FetchResponseLike = FetchResponseLike> = (
  url: string,
  init?: RequestInit,
) => Promise<TResponse>;

export interface FetchRequestDescriptor {
  url: string;
  init?: RequestInit;
}

export interface FetchAdapterOptions<TResponse extends FetchResponseLike = FetchResponseLike> {
  fetch: FetchFunction<TResponse>;
}

export interface FetchAdapterRunOptions<
  TResult,
  TParsedResponse extends FetchParsedResponse = JsonValue,
  TResponse extends FetchResponseLike = FetchResponseLike,
> {
  buildRequest: (context: ResolvedRunContext) => MaybePromise<FetchRequestDescriptor>;
  parseResponse: (response: TResponse) => Promise<TParsedResponse>;
  mapResult: (body: TParsedResponse, response: TResponse) => MaybePromise<TResult>;
  extractUsage?: (body: TParsedResponse, response: TResponse) => ExecuteUsage | undefined;
}

export interface FetchAdapter<TResponse extends FetchResponseLike = FetchResponseLike> {
  run<TResult, TParsedResponse extends FetchParsedResponse = JsonValue>(
    guard: Guard,
    context: RunContext,
    options: FetchAdapterRunOptions<TResult, TParsedResponse, TResponse>,
  ): Promise<GuardResult<TResult>>;
}
