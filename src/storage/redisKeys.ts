const DEFAULT_NAMESPACE = 'llm-cost-guard';

const normalizeNamespace = (namespace?: string): string => {
  const trimmedNamespace = namespace?.trim();
  if (trimmedNamespace === undefined || trimmedNamespace.length === 0) return DEFAULT_NAMESPACE;

  return trimmedNamespace;
};

const pad2 = (value: number): string => {
  return String(value).padStart(2, '0');
};

export const resolveRedisNamespace = (namespace?: string): string => {
  return normalizeNamespace(namespace);
};

export const buildUsageRecordKey = (namespace: string, recordId: string): string => {
  return `${namespace}:usage:record:${recordId}`;
};

export const buildUsageIndexKey = (namespace: string): string => {
  return `${namespace}:usage:index:all`;
};

export const buildDailyGlobalSummaryKey = (namespace: string, dayId: string): string => {
  return `${namespace}:summary:day:${dayId}:global`;
};

export const buildMonthlyGlobalSummaryKey = (namespace: string, monthId: string): string => {
  return `${namespace}:summary:month:${monthId}:global`;
};

export const buildDailyUserSummaryKey = (
  namespace: string,
  dayId: string,
  userId: string,
): string => {
  return `${namespace}:summary:day:${dayId}:user:${userId}`;
};

export const buildMonthlyProjectSummaryKey = (
  namespace: string,
  monthId: string,
  projectId: string,
): string => {
  return `${namespace}:summary:month:${monthId}:project:${projectId}`;
};

export const buildMonthlyProviderSummaryKey = (
  namespace: string,
  monthId: string,
  projectId: string,
  providerId: string,
): string => {
  return `${namespace}:summary:month:${monthId}:project:${projectId}:provider:${providerId}`;
};

export const buildRateLimitStorageKey = (namespace: string, key: string): string => {
  return `${namespace}:${key}`;
};

export const getUtcDayId = (timestamp: string): string => {
  const date = new Date(timestamp);

  return [date.getUTCFullYear(), pad2(date.getUTCMonth() + 1), pad2(date.getUTCDate())].join('-');
};

export const getUtcMonthId = (timestamp: string): string => {
  const date = new Date(timestamp);

  return [date.getUTCFullYear(), pad2(date.getUTCMonth() + 1)].join('-');
};
