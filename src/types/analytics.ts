export interface CostSpikeConfig {
  enabled?: boolean;
  minBaselineSamples?: number;
  multiplierThreshold?: number;
  absoluteDeltaUsdThreshold?: number;
  compareByFeature?: boolean;
  compareByEndpoint?: boolean;
  maxTopDrivers?: number;
}

export interface ResolvedCostSpikeConfig {
  enabled: boolean;
  minBaselineSamples: number;
  multiplierThreshold: number;
  absoluteDeltaUsdThreshold: number;
  compareByFeature: boolean;
  compareByEndpoint: boolean;
  maxTopDrivers: number;
}

export interface GuardAnalyticsConfig {
  costSpike?: CostSpikeConfig;
}

export interface ResolvedGuardAnalyticsConfig {
  costSpike: ResolvedCostSpikeConfig;
}

export interface BreakdownBaselinePart {
  key: string;
  sampleCount: number;
  medianEstimatedTokens: number;
  medianEstimatedInputCostUsd: number;
}

export interface BreakdownBaselineSnapshot {
  sampleCount: number;
  parts: BreakdownBaselinePart[];
}

export interface CostBaselineSnapshot {
  sampleCount: number;
  medianActualTotalCostUsd: number;
  p90ActualTotalCostUsd: number;
  medianInputTokens: number;
  medianOutputTokens: number;
  breakdown?: BreakdownBaselineSnapshot | undefined;
}

export type CostSpikeDriverKind =
  | 'input-tokens'
  | 'output-tokens'
  | 'breakdown-estimated-input-cost';

export interface CostSpikeDriver {
  key: string;
  label: string;
  kind: CostSpikeDriverKind;
  currentValue: number;
  baselineValue: number;
  delta: number;
  ratio?: number | undefined;
}

export interface CostSpikeExplanation {
  detected: boolean;
  sampleCount: number;
  currentActualTotalCostUsd: number;
  baselineMedianActualTotalCostUsd: number;
  p90ActualTotalCostUsd: number;
  deltaUsd: number;
  multiplier?: number | undefined;
  topDrivers: CostSpikeDriver[];
}
