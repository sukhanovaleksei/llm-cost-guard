import type { Guard, GuardResult, RunContext } from '../../types/index.js';
import type { JsonObject } from '../../types/json.js';

export type AnthropicRole = 'user' | 'assistant';

export interface AnthropicTextBlock extends JsonObject {
  type: 'text';
  text: string;
}

export interface AnthropicImageSource extends JsonObject {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface AnthropicImageBlock extends JsonObject {
  type: 'image';
  source: AnthropicImageSource;
}

export interface AnthropicToolUseBlock extends JsonObject {
  type: 'tool_use';
  id: string;
  name: string;
  input?: JsonObject;
}

export interface AnthropicToolResultBlock extends JsonObject {
  type: 'tool_result';
  tool_use_id: string;
  content?: string | AnthropicContentBlock[];
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export type AnthropicMessageContent = string | AnthropicContentBlock[];

export interface AnthropicMessage extends JsonObject {
  role: AnthropicRole;
  content: AnthropicMessageContent;
}

export type AnthropicSystemBlock = AnthropicTextBlock;

export type AnthropicSystemPrompt = string | AnthropicSystemBlock[];

export type AnthropicMetadata = Record<string, string>;

export type AnthropicMessagesCreateRequest = JsonObject & {
  model?: string;
  messages?: AnthropicMessage[];
  system?: AnthropicSystemPrompt;
  max_tokens?: number;
  stream?: boolean;
  metadata?: AnthropicMetadata;
};

export interface AnthropicUsageLike extends JsonObject {
  input_tokens?: number;
  output_tokens?: number;
}

export interface AnthropicMessageResponse extends JsonObject {
  id?: string;
  model?: string;
  usage?: AnthropicUsageLike;
}

export interface AnthropicMessagesClient<
  TRequest extends AnthropicMessagesCreateRequest,
  TResponse extends AnthropicMessageResponse,
> {
  create(request: TRequest): Promise<TResponse>;
}

export interface AnthropicClientLike<
  TRequest extends AnthropicMessagesCreateRequest,
  TResponse extends AnthropicMessageResponse,
> {
  messages: AnthropicMessagesClient<TRequest, TResponse>;
}

export interface AnthropicAdapter<
  TRequest extends AnthropicMessagesCreateRequest,
  TResponse extends AnthropicMessageResponse,
> {
  messages: {
    create(guard: Guard, context: RunContext, request: TRequest): Promise<GuardResult<TResponse>>;
  };
}
