import { type RedisSortedSetMember, type RedisStorageClient } from '../../src/index.js';

interface SortedSetEntry {
  score: number;
  value: string;
}

const toScore = (value: number | string): number => {
  if (typeof value === 'number') return value;
  if (value === '-inf') return Number.NEGATIVE_INFINITY;
  if (value === '+inf') return Number.POSITIVE_INFINITY;
  return Number(value);
};

export const createFakeRedisClient = (): RedisStorageClient => {
  const stringStore = new Map<string, string>();
  const hashStore = new Map<string, Map<string, string>>();
  const sortedSetStore = new Map<string, SortedSetEntry[]>();
  const expiresAtMsStore = new Map<string, number>();

  const cleanupExpiredKey = (key: string): void => {
    const expiresAtMs = expiresAtMsStore.get(key);
    if (expiresAtMs === undefined) return;
    if (Date.now() < expiresAtMs) return;

    stringStore.delete(key);
    hashStore.delete(key);
    sortedSetStore.delete(key);
    expiresAtMsStore.delete(key);
  };

  const ensureHash = (key: string): Map<string, string> => {
    cleanupExpiredKey(key);

    const existing = hashStore.get(key);
    if (existing !== undefined) return existing;

    const next = new Map<string, string>();
    hashStore.set(key, next);
    return next;
  };

  const ensureSortedSet = (key: string): SortedSetEntry[] => {
    cleanupExpiredKey(key);

    const existing = sortedSetStore.get(key);
    if (existing !== undefined) return existing;

    const next: SortedSetEntry[] = [];
    sortedSetStore.set(key, next);
    return next;
  };

  return {
    async get(key: string): Promise<string | null> {
      cleanupExpiredKey(key);
      return stringStore.get(key) ?? null;
    },

    async mGet(keys: string[]): Promise<Array<string | null>> {
      const values: Array<string | null> = [];

      for (const key of keys) {
        cleanupExpiredKey(key);
        values.push(stringStore.get(key) ?? null);
      }

      return values;
    },

    async set(key: string, value: string): Promise<string | null> {
      stringStore.set(key, value);
      return 'OK';
    },

    async expire(key: string, seconds: number): Promise<number | boolean> {
      expiresAtMsStore.set(key, Date.now() + seconds * 1000);
      return 1;
    },

    async pExpire(key: string, milliseconds: number): Promise<number | boolean> {
      expiresAtMsStore.set(key, Date.now() + milliseconds);
      return 1;
    },

    async pTTL(key: string): Promise<number> {
      cleanupExpiredKey(key);

      const expiresAtMs = expiresAtMsStore.get(key);
      if (expiresAtMs === undefined) {
        const hasAnyValue = stringStore.has(key) || hashStore.has(key) || sortedSetStore.has(key);

        return hasAnyValue ? -1 : -2;
      }

      return Math.max(expiresAtMs - Date.now(), 0);
    },

    async incr(key: string): Promise<number> {
      cleanupExpiredKey(key);

      const currentValue = stringStore.get(key);
      const nextValue = (currentValue === undefined ? 0 : Number(currentValue)) + 1;

      stringStore.set(key, String(nextValue));
      return nextValue;
    },

    async zAdd(key: string, members: RedisSortedSetMember[]): Promise<number> {
      const entries = ensureSortedSet(key);

      for (const member of members) {
        const existingIndex = entries.findIndex((entry) => entry.value === member.value);
        if (existingIndex >= 0) entries.splice(existingIndex, 1);

        entries.push({ score: member.score, value: member.value });
      }

      entries.sort((left, right) => left.score - right.score);
      return members.length;
    },

    async zRangeByScore(
      key: string,
      min: number | string,
      max: number | string,
    ): Promise<string[]> {
      cleanupExpiredKey(key);

      const entries = sortedSetStore.get(key) ?? [];
      const minScore = toScore(min);
      const maxScore = toScore(max);

      return entries
        .filter((entry) => entry.score >= minScore && entry.score <= maxScore)
        .map((entry) => entry.value);
    },

    async hIncrBy(key: string, field: string, increment: number): Promise<number> {
      const hash = ensureHash(key);
      const currentValue = Number(hash.get(field) ?? '0');
      const nextValue = currentValue + increment;

      hash.set(field, String(nextValue));
      return nextValue;
    },

    async hIncrByFloat(key: string, field: string, increment: number): Promise<number | string> {
      const hash = ensureHash(key);
      const currentValue = Number(hash.get(field) ?? '0');
      const nextValue = currentValue + increment;

      hash.set(field, String(nextValue));
      return nextValue;
    },

    async hGetAll(key: string): Promise<Record<string, string>> {
      cleanupExpiredKey(key);

      const hash = hashStore.get(key);
      if (hash === undefined) return {};

      const result: Record<string, string> = {};

      for (const [field, value] of hash.entries()) result[field] = value;

      return result;
    },
  };
};
