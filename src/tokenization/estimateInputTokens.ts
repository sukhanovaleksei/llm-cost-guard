import type { RequestLike } from '../types/requests.js';
import { extractTextForEstimation } from './requestText.js';

export const estimateInputTokens = (request: RequestLike | undefined): number => {
  const text = extractTextForEstimation(request).trim();
  if (text.length === 0) return 0;

  return Math.ceil(text.length / 4);
};
