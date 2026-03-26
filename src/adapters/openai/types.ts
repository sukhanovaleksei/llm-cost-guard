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

export type OpenAIResponsesCreateRequest = JsonObject & {
  model?: string;
  input?: OpenAIResponseInput;
  instructions?: string;
  max_output_tokens?: number;
  stream?: boolean;
  metadata?: OpenAIResponseMetadata;
};

export interface OpenAIUsageLike extends JsonObject {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface OpenAIResponseLike extends JsonObject {
  id?: string;
  usage?: OpenAIUsageLike;
}

export interface OpenAIResponsesClient<
  TRequest extends OpenAIResponsesCreateRequest,
  TResponse extends OpenAIResponseLike,
> {
  create(request: TRequest): Promise<TResponse>;
}

export interface OpenAIClientLike<
  TRequest extends OpenAIResponsesCreateRequest,
  TResponse extends OpenAIResponseLike,
> {
  responses: OpenAIResponsesClient<TRequest, TResponse>;
}

export interface OpenAIAdapter<
  TRequest extends OpenAIResponsesCreateRequest,
  TResponse extends OpenAIResponseLike,
> {
  responses: {
    create(guard: Guard, context: RunContext, request: TRequest): Promise<GuardResult<TResponse>>;
  };
}
