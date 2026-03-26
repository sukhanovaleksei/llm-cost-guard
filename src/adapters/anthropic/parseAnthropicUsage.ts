import type { ExecuteUsage } from '../../types/usage.js';
import type { AnthropicMessageResponse } from './types.js';

export const parseAnthropicUsage = <TResponse extends AnthropicMessageResponse>(
  response: TResponse,
): ExecuteUsage | undefined => {
  const usage = response.usage;
  if (usage === undefined) return undefined;

  const hasInputTokens = usage.input_tokens !== undefined;
  const hasOutputTokens = usage.output_tokens !== undefined;

  if (!hasInputTokens && !hasOutputTokens) return undefined;

  return {
    ...(hasInputTokens ? { inputTokens: usage.input_tokens } : {}),
    ...(hasOutputTokens ? { outputTokens: usage.output_tokens } : {}),
  };
};
