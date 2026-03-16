export interface PreflightPricingSummary {
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  currency: 'USD';
}

export interface PreflightEstimate {
  providerId: string;
  model: string;
  estimatedInputTokens: number;
  estimatedInputCostUsd: number;
  estimatedWorstCaseCostUsd?: number | undefined;
  pricing: PreflightPricingSummary;
}
