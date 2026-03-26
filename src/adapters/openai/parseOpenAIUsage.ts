import type { ExecuteUsage } from '../../types/usage.js';
import type { OpenAIResponseLike } from './types.js';

export const parseOpenAIUsage = <TResponse extends OpenAIResponseLike>(
  response: TResponse,
): ExecuteUsage | undefined => {
  const usage = response.usage;
  if (usage === undefined) return undefined;

  const hasInputTokens = usage.input_tokens !== undefined;
  const hasOutputTokens = usage.output_tokens !== undefined;
  const hasTotalTokens = usage.total_tokens !== undefined;

  if (!hasInputTokens && !hasOutputTokens && !hasTotalTokens) return undefined;

  return {
    ...(hasInputTokens ? { inputTokens: usage.input_tokens } : {}),
    ...(hasOutputTokens ? { outputTokens: usage.output_tokens } : {}),
    ...(hasTotalTokens ? { totalTokens: usage.total_tokens } : {}),
  };
};
