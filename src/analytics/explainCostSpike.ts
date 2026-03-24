import type {
  BreakdownBaselinePart,
  CostSpikeDriver,
  CostSpikeExplanation,
  ResolvedCostSpikeConfig,
} from '../types/analytics.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type { ResolvedRunContext } from '../types/run.js';
import type { StorageAdapter } from '../types/storage.js';
import type { ActualUsage } from '../types/usage.js';
import { buildCostBaseline } from './buildCostBaseline.js';
import { selectComparableUsage } from './selectComparableUsage.js';

export interface ExplainCostSpikeParams {
  storage: StorageAdapter;
  config: ResolvedCostSpikeConfig;
  context: ResolvedRunContext;
  preflight: PreflightEstimate;
  actualUsage: ActualUsage;
}

const calculateRatio = (currentValue: number, baselineValue: number): number | undefined => {
  if (baselineValue <= 0) return undefined;

  return currentValue / baselineValue;
};

const pushDriverIfPositiveDelta = (drivers: CostSpikeDriver[], driver: CostSpikeDriver): void => {
  if (driver.delta <= 0) return;

  drivers.push(driver);
};

const findBreakdownBaselinePart = (
  parts: BreakdownBaselinePart[],
  key: string,
): BreakdownBaselinePart | undefined => {
  return parts.find((part) => part.key === key);
};

const buildTokenDrivers = (
  actualUsage: ActualUsage,
  baselineMedianInputTokens: number,
  baselineMedianOutputTokens: number,
): CostSpikeDriver[] => {
  const drivers: CostSpikeDriver[] = [];

  const inputRatio = calculateRatio(actualUsage.inputTokens, baselineMedianInputTokens);
  const outputRatio = calculateRatio(actualUsage.outputTokens, baselineMedianOutputTokens);

  pushDriverIfPositiveDelta(drivers, {
    key: 'inputTokens',
    label: 'Input tokens',
    kind: 'input-tokens',
    currentValue: actualUsage.inputTokens,
    baselineValue: baselineMedianInputTokens,
    delta: actualUsage.inputTokens - baselineMedianInputTokens,
    ratio: inputRatio,
  });

  pushDriverIfPositiveDelta(drivers, {
    key: 'outputTokens',
    label: 'Output tokens',
    kind: 'output-tokens',
    currentValue: actualUsage.outputTokens,
    baselineValue: baselineMedianOutputTokens,
    delta: actualUsage.outputTokens - baselineMedianOutputTokens,
    ratio: outputRatio,
  });

  return drivers;
};

const buildBreakdownDrivers = (
  preflight: PreflightEstimate,
  baselineParts: BreakdownBaselinePart[],
): CostSpikeDriver[] => {
  const drivers: CostSpikeDriver[] = [];
  const breakdown = preflight.breakdown;

  if (breakdown === undefined) return drivers;

  for (const part of breakdown.parts) {
    const baselinePart = findBreakdownBaselinePart(baselineParts, part.key);
    if (baselinePart === undefined) continue;

    const ratio = calculateRatio(
      part.estimatedInputCostUsd,
      baselinePart.medianEstimatedInputCostUsd,
    );

    pushDriverIfPositiveDelta(drivers, {
      key: part.key,
      label: `Breakdown: ${part.key}`,
      kind: 'breakdown-estimated-input-cost',
      currentValue: part.estimatedInputCostUsd,
      baselineValue: baselinePart.medianEstimatedInputCostUsd,
      delta: part.estimatedInputCostUsd - baselinePart.medianEstimatedInputCostUsd,
      ratio,
    });
  }

  const unattributedBaseline = findBreakdownBaselinePart(baselineParts, 'unattributed');

  if (unattributedBaseline !== undefined) {
    const ratio = calculateRatio(
      breakdown.unattributedEstimatedInputCostUsd,
      unattributedBaseline.medianEstimatedInputCostUsd,
    );

    pushDriverIfPositiveDelta(drivers, {
      key: 'unattributed',
      label: 'Breakdown: unattributed',
      kind: 'breakdown-estimated-input-cost',
      currentValue: breakdown.unattributedEstimatedInputCostUsd,
      baselineValue: unattributedBaseline.medianEstimatedInputCostUsd,
      delta:
        breakdown.unattributedEstimatedInputCostUsd -
        unattributedBaseline.medianEstimatedInputCostUsd,
      ratio,
    });
  }

  return drivers;
};

const sortDrivers = (drivers: CostSpikeDriver[]): CostSpikeDriver[] => {
  return [...drivers].sort((left, right) => {
    if (right.delta !== left.delta) return right.delta - left.delta;

    const leftRatio = left.ratio ?? 0;
    const rightRatio = right.ratio ?? 0;

    return rightRatio - leftRatio;
  });
};

export const explainCostSpike = async (
  params: ExplainCostSpikeParams,
): Promise<CostSpikeExplanation | undefined> => {
  const { storage, config, context, preflight, actualUsage } = params;

  if (!config.enabled) return undefined;

  const comparableRecords = await selectComparableUsage({ storage, context, config });

  const baseline = buildCostBaseline(comparableRecords);
  if (baseline === undefined) return undefined;

  if (baseline.sampleCount < config.minBaselineSamples) return undefined;

  const currentActualTotalCostUsd = actualUsage.actualTotalCostUsd;
  const baselineMedianActualTotalCostUsd = baseline.medianActualTotalCostUsd;
  const deltaUsd = currentActualTotalCostUsd - baselineMedianActualTotalCostUsd;
  const multiplier = calculateRatio(currentActualTotalCostUsd, baselineMedianActualTotalCostUsd);

  const passesAbsoluteThreshold = deltaUsd >= config.absoluteDeltaUsdThreshold;

  const passesMultiplierThreshold =
    multiplier === undefined
      ? currentActualTotalCostUsd >= config.absoluteDeltaUsdThreshold
      : multiplier >= config.multiplierThreshold;

  const detected = passesAbsoluteThreshold && passesMultiplierThreshold;

  const drivers: CostSpikeDriver[] = [
    ...buildTokenDrivers(actualUsage, baseline.medianInputTokens, baseline.medianOutputTokens),
    ...(baseline.breakdown !== undefined
      ? buildBreakdownDrivers(preflight, baseline.breakdown.parts)
      : []),
  ];

  return {
    detected,
    sampleCount: baseline.sampleCount,
    currentActualTotalCostUsd,
    baselineMedianActualTotalCostUsd,
    p90ActualTotalCostUsd: baseline.p90ActualTotalCostUsd,
    deltaUsd,
    multiplier,
    topDrivers: sortDrivers(drivers).slice(0, config.maxTopDrivers),
  };
};
