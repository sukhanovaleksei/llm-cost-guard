export interface PreflightPricingSummary {
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  currency: 'USD';
}

export interface PreflightBreakdownPart {
  key: string;
  estimatedTokens: number;
  estimatedInputCostUsd: number;
}

export interface PreflightBreakdown {
  parts: PreflightBreakdownPart[];
  attributedEstimatedTokens: number;
  attributedEstimatedInputCostUsd: number;
  totalEstimatedInputTokens: number;
  unattributedEstimatedTokens: number;
  unattributedEstimatedInputCostUsd: number;
}

export interface PreflightEstimate {
  providerId: string;
  model: string;
  estimatedInputTokens: number;
  estimatedInputCostUsd: number;
  estimatedWorstCaseCostUsd?: number | undefined;
  pricing: PreflightPricingSummary;
  breakdown?: PreflightBreakdown | undefined;
}
