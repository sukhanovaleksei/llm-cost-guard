import { InvalidUsagePayloadError } from '../errors/InvalidUsagePayloadError.js';
import type { ExecuteUsage, NormalizedUsage } from '../types/usage.js';
import { isNonNegativeInteger } from '../utils/validation.js';

export const normalizeExecuteUsage = (
  usage: ExecuteUsage | undefined,
): NormalizedUsage | undefined => {
  if (usage === undefined) return undefined;

  const hasInputTokens = usage.inputTokens !== undefined;
  const hasOutputTokens = usage.outputTokens !== undefined;
  const hasTotalTokens = usage.totalTokens !== undefined;

  if (!hasInputTokens && !hasOutputTokens && !hasTotalTokens)
    throw new InvalidUsagePayloadError(
      'usage must include at least one of inputTokens, outputTokens, or totalTokens',
    );

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  if (!isNonNegativeInteger(inputTokens))
    throw new InvalidUsagePayloadError('usage.inputTokens must be a non-negative integer');

  if (!isNonNegativeInteger(outputTokens))
    throw new InvalidUsagePayloadError('usage.outputTokens must be a non-negative integer');

  if (hasTotalTokens) {
    const totalTokens = usage.totalTokens as number;

    if (!isNonNegativeInteger(totalTokens))
      throw new InvalidUsagePayloadError('usage.totalTokens must be a non-negative integer');

    if (totalTokens !== inputTokens + outputTokens)
      throw new InvalidUsagePayloadError('usage.totalTokens must equal inputTokens + outputTokens');

    return { inputTokens, outputTokens, totalTokens };
  }

  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
};
