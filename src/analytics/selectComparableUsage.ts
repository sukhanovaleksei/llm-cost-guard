import type { ResolvedCostSpikeConfig } from '../types/analytics.js';
import type { ResolvedRunContext } from '../types/run.js';
import type { SpendQuery, StorageAdapter, UsageRecord } from '../types/storage.js';

export interface SelectComparableUsageParams {
  storage: StorageAdapter;
  context: ResolvedRunContext;
  config: ResolvedCostSpikeConfig;
}

const buildSpendQuery = (
  context: ResolvedRunContext,
  config: ResolvedCostSpikeConfig,
): SpendQuery => {
  return {
    projectId: context.project.id,
    providerId: context.provider.id,
    model: context.provider.model,
    ...(config.compareByFeature && context.attribution.feature !== undefined
      ? { feature: context.attribution.feature }
      : {}),
    ...(config.compareByEndpoint && context.attribution.endpoint !== undefined
      ? { endpoint: context.attribution.endpoint }
      : {}),
  };
};

const isComparableRecord = (record: UsageRecord): boolean => {
  return record.executed && !record.blocked && record.actualUsage !== undefined;
};

export const selectComparableUsage = async (
  params: SelectComparableUsageParams,
): Promise<UsageRecord[]> => {
  const { storage, context, config } = params;

  const query = buildSpendQuery(context, config);
  const records = await storage.listUsage(query);

  return records.filter(isComparableRecord);
};
