import type { Guard, GuardResult, RunContext } from '../../types/index.js';
import type { JsonObject } from '../../types/json.js';

export type OpenAIInputRole = 'system' | 'developer' | 'user' | 'assistant';

export interface OpenAIInputTextContentItem extends JsonObject {
  type: 'input_text';
  text: string;
}

export interface OpenAIInputImageContentItem extends JsonObject {
  type: 'input_image';
  image_url?: string;
  file_id?: string;
  detail?: 'auto' | 'low' | 'high';
}

export type OpenAIInputMessageContentItem =
  | OpenAIInputTextContentItem
  | OpenAIInputImageContentItem;

export interface OpenAIInputMessageItem extends JsonObject {
  type: 'message';
  role: OpenAIInputRole;
  content: string | OpenAIInputMessageContentItem[];
}

export type OpenAIResponseInputItem = OpenAIInputMessageItem | JsonObject;
export type OpenAIResponseInput = string | OpenAIResponseInputItem[];

export type OpenAIResponseMetadata = Record<string, string>;

export interface OpenAIResponsesCreateRequestLike extends JsonObject {
  model?: string;
  input?: string | JsonObject[];
  instructions?: string;
  max_output_tokens?: number;
  stream?: boolean | null;
  metadata?: Record<string, string>;
}

export interface OpenAIResponsesCreateRequest extends OpenAIResponsesCreateRequestLike {
  input?: OpenAIResponseInput;
  metadata?: OpenAIResponseMetadata;
}

export interface OpenAIUsageLike extends JsonObject {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface OpenAIResponseLike extends JsonObject {
  id?: string;
  usage?: OpenAIUsageLike;
}

export interface OpenAIClientLike<TCreate = object> {
  responses: {
    create: TCreate;
  };
}

export type InferOpenAIRequest<TCreate> = TCreate extends (
  request: infer TRequest,
  ...args: object[]
) => Promise<object>
  ? TRequest & OpenAIResponsesCreateRequestLike
  : OpenAIResponsesCreateRequestLike;

export interface OpenAIAdapter<
  TRequest extends OpenAIResponsesCreateRequestLike,
  TResponse extends OpenAIResponseLike,
> {
  responses: {
    create(guard: Guard, context: RunContext, request: TRequest): Promise<GuardResult<TResponse>>;
  };
}

export type OpenAICreateFunction<
  TRequest extends OpenAIResponsesCreateRequestLike,
  TResponse extends OpenAIResponseLike,
> = (request: TRequest) => Promise<TResponse>;
