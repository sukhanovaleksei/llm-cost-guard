import { InvalidAnthropicAdapterRequestError } from '../../errors/InvalidAnthropicAdapterRequestError.js';
import type { JsonObject } from '../../types/json.js';
import type { RequestLike } from '../../types/requests.js';
import type { ResolvedRunContext, RunContext } from '../../types/run.js';
import { parseAnthropicUsage } from './parseAnthropicUsage.js';
import type {
  AnthropicAdapter,
  AnthropicClientLike,
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicMessageResponse,
  AnthropicMessagesCreateRequestLike,
  InferAnthropicRequest,
} from './types.js';

const isNonEmptyTrimmedString = (value: string | undefined): value is string => {
  return value !== undefined && value.trim().length > 0;
};

const isAnthropicTextBlock = (
  value: JsonObject,
): value is AnthropicContentBlock & { type: 'text'; text: string } => {
  return value.type === 'text' && typeof value.text === 'string';
};

const isAnthropicMessage = (value: JsonObject): value is AnthropicMessage => {
  return (
    (value.role === 'user' || value.role === 'assistant') &&
    (typeof value.content === 'string' || Array.isArray(value.content))
  );
};

const extractTextFromContentBlocks = (blocks: JsonObject[]): string => {
  const parts: string[] = [];

  for (const block of blocks) {
    if (isAnthropicTextBlock(block)) parts.push(block.text);
  }

  return parts.join(' ');
};

const extractTextFromMessage = (message: AnthropicMessage): string => {
  if (typeof message.content === 'string') return message.content;

  return extractTextFromContentBlocks(message.content);
};

const extractSystemText = (system: string | JsonObject[] | undefined): string => {
  if (system === undefined) return '';
  if (typeof system === 'string') return system;

  const parts: string[] = [];

  for (const block of system) {
    if (isAnthropicTextBlock(block)) parts.push(block.text);
  }

  return parts.join(' ');
};

const buildRequestLikeFromAnthropicRequest = <TRequest extends AnthropicMessagesCreateRequestLike>(
  request: TRequest,
): RequestLike | undefined => {
  const messages: Array<{ role?: string; content?: string }> = [];

  const systemText = extractSystemText(request.system).trim();
  if (systemText.length > 0) messages.push({ role: 'system', content: systemText });

  const requestMessages = request.messages ?? [];

  for (const candidate of requestMessages) {
    if (!isAnthropicMessage(candidate)) continue;

    const content = extractTextFromMessage(candidate).trim();
    if (content.length === 0) continue;

    messages.push({ role: candidate.role, content });
  }

  if (messages.length === 0) return undefined;

  return { messages };
};

const normalizeAnthropicContext = <TRequest extends AnthropicMessagesCreateRequestLike>(
  context: RunContext,
  request: TRequest,
): RunContext => {
  const derivedRequest = context.request ?? buildRequestLikeFromAnthropicRequest(request);

  const existingProvider = context.provider;

  const provider =
    existingProvider === undefined
      ? {
          id: 'anthropic',
          ...(request.model !== undefined ? { model: request.model } : {}),
          ...(request.max_tokens !== undefined ? { maxTokens: request.max_tokens } : {}),
        }
      : {
          ...existingProvider,
          id: existingProvider.id ?? 'anthropic',
          model: existingProvider.model ?? request.model,
          maxTokens: existingProvider.maxTokens ?? request.max_tokens,
        };

  return {
    ...context,
    provider,
    ...(derivedRequest !== undefined ? { request: derivedRequest } : {}),
  };
};

const assertSupportedAnthropicRequest = <TRequest extends AnthropicMessagesCreateRequestLike>(
  context: RunContext,
  request: TRequest,
): void => {
  const providerId = context.provider?.id;

  if (isNonEmptyTrimmedString(providerId) && providerId !== 'anthropic')
    throw new InvalidAnthropicAdapterRequestError(
      `wrapAnthropic requires context.provider.id to be "anthropic", received "${providerId}"`,
    );

  if (request.stream === true)
    throw new InvalidAnthropicAdapterRequestError(
      'wrapAnthropic currently supports only non-streaming messages.create requests',
    );
};

const assertResolvedProviderIsAnthropic = (context: ResolvedRunContext): void => {
  if (context.provider.id !== 'anthropic')
    throw new InvalidAnthropicAdapterRequestError(
      `wrapAnthropic resolved provider "${context.provider.id}" instead of "anthropic"`,
    );
};

const applyResolvedProviderToRequest = <TRequest extends AnthropicMessagesCreateRequestLike>(
  request: TRequest,
  context: ResolvedRunContext,
): TRequest & { model: string; max_tokens?: number } => {
  const effectiveMaxTokens = context.provider.maxTokens ?? request.max_tokens;

  return {
    ...request,
    model: context.provider.model,
    ...(effectiveMaxTokens !== undefined ? { max_tokens: effectiveMaxTokens } : {}),
  };
};

export const wrapAnthropic = <
  TCreate,
  TRequest extends AnthropicMessagesCreateRequestLike = InferAnthropicRequest<TCreate>,
>(
  client: AnthropicClientLike<TCreate>,
): AnthropicAdapter<TRequest, AnthropicMessageResponse> => {
  const create = (
    client.messages.create as (
      request: TRequest,
      ...args: object[]
    ) => Promise<AnthropicMessageResponse>
  ).bind(client.messages);

  return {
    messages: {
      async create(guard, context, request) {
        assertSupportedAnthropicRequest(context, request);

        const normalizedContext = normalizeAnthropicContext(context, request);

        return guard.run(normalizedContext, async (resolvedContext) => {
          assertResolvedProviderIsAnthropic(resolvedContext);

          const effectiveRequest = applyResolvedProviderToRequest(request, resolvedContext);

          const response = await create(effectiveRequest);
          const usage = parseAnthropicUsage(response);

          if (usage === undefined) return response;

          return { result: response, usage };
        });
      },
    },
  };
};
