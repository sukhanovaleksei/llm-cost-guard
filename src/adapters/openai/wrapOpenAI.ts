import { InvalidOpenAIAdapterRequestError } from '../../errors/InvalidOpenAIAdapterRequestError.js';
import type { JsonObject } from '../../types/json.js';
import type { RequestLike } from '../../types/requests.js';
import type { ResolvedRunContext, RunContext } from '../../types/run.js';
import { parseOpenAIUsage } from './parseOpenAIUsage.js';
import type {
  InferOpenAIRequest,
  OpenAIAdapter,
  OpenAIClientLike,
  OpenAIInputMessageContentItem,
  OpenAIInputMessageItem,
  OpenAIResponseLike,
  OpenAIResponsesCreateRequestLike,
} from './types.js';

const isNonEmptyTrimmedString = (value: string | undefined): value is string => {
  return value !== undefined && value.trim().length > 0;
};

const isOpenAIInputMessageItem = (value: JsonObject): value is OpenAIInputMessageItem => {
  return (
    value.type === 'message' &&
    typeof value.role === 'string' &&
    (typeof value.content === 'string' || Array.isArray(value.content))
  );
};

const isOpenAIInputTextContentItem = (
  value: JsonObject,
): value is OpenAIInputMessageContentItem & { type: 'input_text'; text: string } => {
  return value.type === 'input_text' && typeof value.text === 'string';
};

const extractTextFromMessageItem = (item: OpenAIInputMessageItem): string => {
  if (typeof item.content === 'string') return item.content;

  const parts: string[] = [];

  for (const contentItem of item.content) {
    if (isOpenAIInputTextContentItem(contentItem)) parts.push(contentItem.text);
  }

  return parts.join(' ');
};

const buildRequestLikeFromOpenAIRequest = <TRequest extends OpenAIResponsesCreateRequestLike>(
  request: TRequest,
): RequestLike | undefined => {
  const messages: Array<{ role?: string; content?: string }> = [];

  if (isNonEmptyTrimmedString(request.instructions))
    messages.push({ role: 'system', content: request.instructions });

  if (typeof request.input === 'string') {
    messages.push({ role: 'user', content: request.input });
  } else if (Array.isArray(request.input)) {
    for (const item of request.input) {
      if (!isOpenAIInputMessageItem(item)) continue;

      const content = extractTextFromMessageItem(item).trim();
      if (content.length === 0) continue;

      messages.push({ role: item.role, content });
    }
  }

  if (messages.length === 0) return undefined;

  return { messages };
};

const normalizeOpenAIContext = <TRequest extends OpenAIResponsesCreateRequestLike>(
  context: RunContext,
  request: TRequest,
): RunContext => {
  const derivedRequest = context.request ?? buildRequestLikeFromOpenAIRequest(request);
  const existingProvider = context.provider;

  const provider =
    existingProvider === undefined
      ? {
          id: 'openai',
          ...(request.model !== undefined ? { model: request.model } : {}),
          ...(request.max_output_tokens !== undefined
            ? { maxTokens: request.max_output_tokens }
            : {}),
        }
      : {
          ...existingProvider,
          id: existingProvider.id ?? 'openai',
          model: existingProvider.model ?? request.model,
          maxTokens: existingProvider.maxTokens ?? request.max_output_tokens,
        };

  return {
    ...context,
    provider,
    ...(derivedRequest !== undefined ? { request: derivedRequest } : {}),
  };
};

const assertSupportedOpenAIRequest = <TRequest extends OpenAIResponsesCreateRequestLike>(
  context: RunContext,
  request: TRequest,
): void => {
  const providerId = context.provider?.id;

  if (isNonEmptyTrimmedString(providerId) && providerId !== 'openai')
    throw new InvalidOpenAIAdapterRequestError(
      `wrapOpenAI requires context.provider.id to be "openai", received "${providerId}"`,
    );

  if (request.stream === true)
    throw new InvalidOpenAIAdapterRequestError(
      'wrapOpenAI currently supports only non-streaming responses.create requests',
    );
};

const assertResolvedProviderIsOpenAI = (context: ResolvedRunContext): void => {
  if (context.provider.id !== 'openai')
    throw new InvalidOpenAIAdapterRequestError(
      `wrapOpenAI resolved provider "${context.provider.id}" instead of "openai"`,
    );
};

const applyResolvedProviderToRequest = <TRequest extends OpenAIResponsesCreateRequestLike>(
  request: TRequest,
  context: ResolvedRunContext,
): TRequest & { model: string; max_output_tokens?: number } => {
  const effectiveMaxOutputTokens = context.provider.maxTokens ?? request.max_output_tokens;

  return {
    ...request,
    model: context.provider.model,
    ...(effectiveMaxOutputTokens !== undefined
      ? { max_output_tokens: effectiveMaxOutputTokens }
      : {}),
  };
};

export const wrapOpenAI = <
  TCreate,
  TRequest extends OpenAIResponsesCreateRequestLike = InferOpenAIRequest<TCreate>,
>(
  client: OpenAIClientLike<TCreate>,
): OpenAIAdapter<TRequest, OpenAIResponseLike> => {
  const create = (
    client.responses.create as (request: TRequest, ...args: object[]) => Promise<OpenAIResponseLike>
  ).bind(client.responses);

  return {
    responses: {
      async create(guard, context, request) {
        assertSupportedOpenAIRequest(context, request);

        const normalizedContext = normalizeOpenAIContext(context, request);

        return guard.run(normalizedContext, async (resolvedContext) => {
          assertResolvedProviderIsOpenAI(resolvedContext);

          const effectiveRequest = applyResolvedProviderToRequest(request, resolvedContext);

          const response = await create(effectiveRequest);
          const usage = parseOpenAIUsage(response);

          if (usage === undefined) return response;

          return { result: response, usage };
        });
      },
    },
  };
};
