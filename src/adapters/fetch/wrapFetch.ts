import type { Guard, JsonValue, RunContext } from '../../types/index.js';
import type { GuardResult } from '../../types/run.js';
import type {
  FetchAdapter,
  FetchAdapterOptions,
  FetchAdapterRunOptions,
  FetchParsedResponse,
  FetchResponseLike,
} from './types.js';

export const parseJsonResponse = async <
  TJsonBody extends JsonValue,
  TResponse extends FetchResponseLike<TJsonBody>,
>(
  response: TResponse,
): Promise<TJsonBody> => {
  return response.json();
};

export const parseTextResponse = async <TResponse extends FetchResponseLike>(
  response: TResponse,
): Promise<string> => {
  return response.text();
};

export const mapParsedResponse = <TParsedResponse extends FetchParsedResponse>(
  body: TParsedResponse,
): TParsedResponse => {
  return body;
};

export const wrapFetch = <TResponse extends FetchResponseLike = FetchResponseLike>(
  options: FetchAdapterOptions<TResponse>,
): FetchAdapter<TResponse> => {
  return {
    async run<TResult, TParsedResponse extends FetchParsedResponse = JsonValue>(
      guard: Guard,
      context: RunContext,
      runOptions: FetchAdapterRunOptions<TResult, TParsedResponse, TResponse>,
    ): Promise<GuardResult<TResult>> {
      return guard.run(context, async (resolvedContext) => {
        const request = await runOptions.buildRequest(resolvedContext);
        const response = await options.fetch(request.url, request.init);
        const parsedBody = await runOptions.parseResponse(response);
        const result = await runOptions.mapResult(parsedBody, response);
        const usage = runOptions.extractUsage?.(parsedBody, response);

        if (usage === undefined) return result;

        return { result, usage };
      });
    },
  };
};
