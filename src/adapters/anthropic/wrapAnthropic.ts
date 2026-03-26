import { InvalidAnthropicAdapterRequestError } from '../../errors/InvalidAnthropicAdapterRequestError.js';
import type { RequestLike } from '../../types/requests.js';
import type { ResolvedRunContext, RunContext } from '../../types/run.js';
import { parseAnthropicUsage } from './parseAnthropicUsage.js';
import type {
  AnthropicAdapter,
  AnthropicClientLike,
  AnthropicContentBlock,
  AnthropicMessage,
  AnthropicMessageResponse,
  AnthropicMessagesCreateRequest,
  AnthropicSystemPrompt,
} from './types.js';

const isNonEmptyTrimmedString = (value: string | undefined): value is string => {
  return value !== undefined && value.trim().length > 0;
};

const isAnthropicTextBlock = (
  value: AnthropicContentBlock,
): value is AnthropicContentBlock & { type: 'text'; text: string } => {
  return value.type === 'text' && typeof value.text === 'string';
};

const extractTextFromContentBlocks = (blocks: AnthropicContentBlock[]): string => {
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

const extractSystemText = (system: AnthropicSystemPrompt | undefined): string => {
  if (system === undefined) return '';
  if (typeof system === 'string') return system;

  const parts: string[] = [];

  for (const block of system) {
    if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
  }

  return parts.join(' ');
};

const buildRequestLikeFromAnthropicRequest = <TRequest extends AnthropicMessagesCreateRequest>(
  request: TRequest,
): RequestLike | undefined => {
  const messages: Array<{ role?: string; content?: string }> = [];

  const systemText = extractSystemText(request.system).trim();
  if (systemText.length > 0) messages.push({ role: 'system', content: systemText });

  const requestMessages = request.messages ?? [];

  for (const message of requestMessages) {
    const content = extractTextFromMessage(message).trim();
    if (content.length === 0) continue;

    messages.push({ role: message.role, content });
  }

  if (messages.length === 0) return undefined;

  return { messages };
};

const normalizeAnthropicContext = <TRequest extends AnthropicMessagesCreateRequest>(
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

const assertSupportedAnthropicRequest = <TRequest extends AnthropicMessagesCreateRequest>(
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

const applyResolvedProviderToRequest = <TRequest extends AnthropicMessagesCreateRequest>(
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
  TRequest extends AnthropicMessagesCreateRequest,
  TResponse extends AnthropicMessageResponse,
>(
  client: AnthropicClientLike<TRequest, TResponse>,
): AnthropicAdapter<TRequest, TResponse> => {
  return {
    messages: {
      async create(guard, context, request) {
        assertSupportedAnthropicRequest(context, request);

        const normalizedContext = normalizeAnthropicContext(context, request);

        return guard.run(normalizedContext, async (resolvedContext) => {
          assertResolvedProviderIsAnthropic(resolvedContext);

          const effectiveRequest = applyResolvedProviderToRequest(request, resolvedContext);
          const response = await client.messages.create(effectiveRequest);
          const usage = parseAnthropicUsage(response);

          if (usage === undefined) return response;

          return { result: response, usage };
        });
      },
    },
  };
};
