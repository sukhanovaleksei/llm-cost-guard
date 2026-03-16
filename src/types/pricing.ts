export interface PricingEntry {
  providerId: string;
  model: string;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  cachedInputCostPerMillionTokens?: number | undefined;
  currency?: 'USD';
}

export interface ResolvedPricingEntry {
  providerId: string;
  model: string;
  inputCostPerMillionTokens: number;
  outputCostPerMillionTokens: number;
  cachedInputCostPerMillionTokens?: number | undefined;
  currency: 'USD';
}
