export interface ExecuteUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ActualUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  actualInputCostUsd: number;
  actualOutputCostUsd: number;
  actualTotalCostUsd: number;
  deltaFromEstimatedInputCostUsd: number;
  deltaFromEstimatedWorstCaseCostUsd: number;
}
