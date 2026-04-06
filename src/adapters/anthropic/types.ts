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

export interface AnthropicMessagesCreateRequestLike extends JsonObject {
  model: string;
  messages?: JsonObject[];
  system?: string | JsonObject[];
  max_tokens?: number;
  stream?: boolean;
  metadata?: Record<string, string>;
}

export interface AnthropicMessagesCreateRequest extends AnthropicMessagesCreateRequestLike {
  messages?: AnthropicMessage[];
  system?: AnthropicSystemPrompt;
  metadata?: AnthropicMetadata;
}

export interface AnthropicUsageLike extends JsonObject {
  input_tokens?: number;
  output_tokens?: number;
}

export interface AnthropicMessageResponse extends JsonObject {
  id?: string;
  model?: string;
  usage?: AnthropicUsageLike;
}

export interface AnthropicClientLike<TCreate = object> {
  messages: {
    create: TCreate;
  };
}

export type InferAnthropicRequest<TCreate> = TCreate extends (
  request: infer TRequest,
  ...args: object[]
) => Promise<object>
  ? TRequest & AnthropicMessagesCreateRequestLike
  : AnthropicMessagesCreateRequestLike;

export interface AnthropicAdapter<
  TRequest extends AnthropicMessagesCreateRequestLike,
  TResponse extends AnthropicMessageResponse,
> {
  messages: {
    create(guard: Guard, context: RunContext, request: TRequest): Promise<GuardResult<TResponse>>;
  };
}

export type AnthropicCreateFunction<
  TRequest extends AnthropicMessagesCreateRequestLike,
  TResponse extends AnthropicMessageResponse,
> = (request: TRequest) => Promise<TResponse>;
