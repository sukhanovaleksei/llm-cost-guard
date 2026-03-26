import type {
  RedisSortedSetMember,
  RedisStorageClient,
} from '../../src/storage/redis/redisTypes.js';

interface SortedSetState {
  members: Map<string, number>;
}

type HashState = Record<string, string>;

const cloneHashState = (value: HashState): HashState => {
  return { ...value };
};

const resolveNowMs = (now?: string): number => {
  return now === undefined ? Date.now() : new Date(now).getTime();
};

const isExpired = (expiresAtMs: number | undefined, nowMs: number): boolean => {
  if (expiresAtMs === undefined) return false;

  return nowMs >= expiresAtMs;
};

export interface FakeRedisStorageClient extends RedisStorageClient {
  setNow(now: string): void;
}

export const createFakeRedisStorageClient = (): FakeRedisStorageClient => {
  const stringValues = new Map<string, string>();
  const hashValues = new Map<string, HashState>();
  const sortedSets = new Map<string, SortedSetState>();
  const expirations = new Map<string, number>();

  let currentNowMs = Date.now();

  const getNowMs = (): number => {
    return currentNowMs;
  };

  const cleanupKeyIfExpired = (key: string): void => {
    const expiresAtMs = expirations.get(key);
    if (!isExpired(expiresAtMs, getNowMs())) return;

    expirations.delete(key);
    stringValues.delete(key);
    hashValues.delete(key);
    sortedSets.delete(key);
  };

  const ensureHash = (key: string): HashState => {
    cleanupKeyIfExpired(key);

    const existingHash = hashValues.get(key);
    if (existingHash !== undefined) return existingHash;

    const nextHash: HashState = {};
    hashValues.set(key, nextHash);
    return nextHash;
  };

  const ensureSortedSet = (key: string): SortedSetState => {
    cleanupKeyIfExpired(key);

    const existingState = sortedSets.get(key);
    if (existingState !== undefined) return existingState;

    const nextState: SortedSetState = {
      members: new Map<string, number>(),
    };

    sortedSets.set(key, nextState);
    return nextState;
  };

  const resolveScoreBound = (value: number | string): number => {
    if (value === '-inf') return Number.NEGATIVE_INFINITY;
    if (value === '+inf') return Number.POSITIVE_INFINITY;
    if (typeof value === 'string') return Number(value);

    return value;
  };

  return {
    setNow(now: string): void {
      currentNowMs = resolveNowMs(now);
    },

    async get(key: string): Promise<string | null> {
      cleanupKeyIfExpired(key);

      const value = stringValues.get(key);
      return value ?? null;
    },

    async mGet(keys: string[]): Promise<Array<string | null>> {
      return Promise.all(keys.map((key) => this.get(key)));
    },

    async set(key: string, value: string): Promise<string | null> {
      cleanupKeyIfExpired(key);
      stringValues.set(key, value);
      return 'OK';
    },

    async expire(key: string, seconds: number): Promise<number | boolean> {
      cleanupKeyIfExpired(key);

      const exists = stringValues.has(key) || hashValues.has(key) || sortedSets.has(key);

      if (!exists) return 0;

      expirations.set(key, getNowMs() + seconds * 1000);
      return 1;
    },

    async pExpire(key: string, milliseconds: number): Promise<number | boolean> {
      cleanupKeyIfExpired(key);

      const exists = stringValues.has(key) || hashValues.has(key) || sortedSets.has(key);

      if (!exists) return 0;

      expirations.set(key, getNowMs() + milliseconds);
      return 1;
    },

    async pTTL(key: string): Promise<number> {
      cleanupKeyIfExpired(key);

      const exists = stringValues.has(key) || hashValues.has(key) || sortedSets.has(key);

      if (!exists) return -2;

      const expiresAtMs = expirations.get(key);
      if (expiresAtMs === undefined) return -1;

      return Math.max(expiresAtMs - getNowMs(), 0);
    },

    async incr(key: string): Promise<number> {
      cleanupKeyIfExpired(key);

      const currentRawValue = stringValues.get(key);
      const currentValue = currentRawValue === undefined ? 0 : Number(currentRawValue);
      const nextValue = currentValue + 1;

      stringValues.set(key, String(nextValue));

      return nextValue;
    },

    async zAdd(key: string, members: RedisSortedSetMember[]): Promise<number> {
      const sortedSet = ensureSortedSet(key);

      let addedCount = 0;

      for (const member of members) {
        const alreadyExists = sortedSet.members.has(member.value);
        sortedSet.members.set(member.value, member.score);

        if (!alreadyExists) addedCount += 1;
      }

      return addedCount;
    },

    async zRangeByScore(
      key: string,
      min: number | string,
      max: number | string,
    ): Promise<string[]> {
      cleanupKeyIfExpired(key);

      const sortedSet = sortedSets.get(key);
      if (sortedSet === undefined) return [];

      const minScore = resolveScoreBound(min);
      const maxScore = resolveScoreBound(max);

      return [...sortedSet.members.entries()]
        .filter((entry) => {
          const score = entry[1];
          return score >= minScore && score <= maxScore;
        })
        .sort((left, right) => {
          if (left[1] !== right[1]) return left[1] - right[1];

          return left[0].localeCompare(right[0]);
        })
        .map((entry) => entry[0]);
    },

    async hIncrBy(key: string, field: string, increment: number): Promise<number> {
      const hash = ensureHash(key);

      const currentValue = Number(hash[field] ?? '0');
      const nextValue = currentValue + increment;

      hash[field] = String(nextValue);

      return nextValue;
    },

    async hIncrByFloat(key: string, field: string, increment: number): Promise<number | string> {
      const hash = ensureHash(key);

      const currentValue = Number(hash[field] ?? '0');
      const nextValue = currentValue + increment;

      hash[field] = String(nextValue);

      return nextValue;
    },

    async hGetAll(key: string): Promise<Record<string, string>> {
      cleanupKeyIfExpired(key);

      const hash = hashValues.get(key);
      if (hash === undefined) return {};

      return cloneHashState(hash);
    },
  };
};
