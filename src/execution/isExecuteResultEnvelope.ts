import type { ExecuteResultEnvelope } from '../types/run.js';

type EnvelopeCandidate<TExecuteResult> = {
  result?: TExecuteResult;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

export const isExecuteResultEnvelope = <TExecuteResult>(
  value: TExecuteResult | ExecuteResultEnvelope<TExecuteResult>,
): value is ExecuteResultEnvelope<TExecuteResult> => {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as EnvelopeCandidate<TExecuteResult>;
  return 'result' in candidate && 'usage' in candidate;
};
