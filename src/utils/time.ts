import type { UsageRecord } from '../types/storage.js';

export const matchesFrom = (record: UsageRecord, from?: string): boolean => {
  if (from === undefined) return true;

  return new Date(record.timestamp).getTime() >= new Date(from).getTime();
};

export const matchesTo = (record: UsageRecord, to?: string): boolean => {
  if (to === undefined) return true;

  return new Date(record.timestamp).getTime() <= new Date(to).getTime();
};

export const resolveNowMs = (value?: string): number => {
  return value === undefined ? Date.now() : new Date(value).getTime();
};

export const toIsoString = (timestampMs: number): string => {
  return new Date(timestampMs).toISOString();
};

export const isSameUtcDayWindow = (from: string, to: string): boolean => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  return (
    fromDate.getUTCFullYear() === toDate.getUTCFullYear() &&
    fromDate.getUTCMonth() === toDate.getUTCMonth() &&
    fromDate.getUTCDate() === toDate.getUTCDate() &&
    fromDate.getUTCHours() === 0 &&
    fromDate.getUTCMinutes() === 0 &&
    fromDate.getUTCSeconds() === 0 &&
    fromDate.getUTCMilliseconds() === 0 &&
    toDate.getUTCHours() === 23 &&
    toDate.getUTCMinutes() === 59 &&
    toDate.getUTCSeconds() === 59 &&
    toDate.getUTCMilliseconds() === 999
  );
};

export const isSameUtcMonthWindow = (from: string, to: string): boolean => {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const expectedMonthEnd = new Date(
    Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );

  return (
    fromDate.getUTCFullYear() === toDate.getUTCFullYear() &&
    fromDate.getUTCMonth() === toDate.getUTCMonth() &&
    fromDate.getUTCDate() === 1 &&
    fromDate.getUTCHours() === 0 &&
    fromDate.getUTCMinutes() === 0 &&
    fromDate.getUTCSeconds() === 0 &&
    fromDate.getUTCMilliseconds() === 0 &&
    toDate.getTime() === expectedMonthEnd.getTime()
  );
};
