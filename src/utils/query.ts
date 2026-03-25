import type { SpendQuery, UsageRecord } from '../types/storage.js';
import { matchesFrom, matchesTo } from './time.js';

export const matchesQuery = (record: UsageRecord, query?: SpendQuery): boolean => {
  if (query === undefined) return true;

  if (query.projectId !== undefined && record.projectId !== query.projectId) return false;
  if (query.providerId !== undefined && record.providerId !== query.providerId) return false;
  if (query.model !== undefined && record.model !== query.model) return false;
  if (query.userId !== undefined && record.userId !== query.userId) return false;
  if (query.feature !== undefined && record.feature !== query.feature) return false;
  if (query.endpoint !== undefined && record.endpoint !== query.endpoint) return false;
  if (query.tag !== undefined && !record.tags.includes(query.tag)) return false;
  if (!matchesFrom(record, query.from)) return false;
  if (!matchesTo(record, query.to)) return false;

  return true;
};
