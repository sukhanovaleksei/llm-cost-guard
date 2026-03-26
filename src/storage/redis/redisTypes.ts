export interface RedisSortedSetMember {
  score: number;
  value: string;
}

export interface RedisStorageClient {
  get(key: string): Promise<string | null>;
  mGet(keys: string[]): Promise<Array<string | null>>;
  set(key: string, value: string): Promise<string | null>;

  expire(key: string, seconds: number): Promise<number | boolean>;
  pExpire(key: string, milliseconds: number): Promise<number | boolean>;
  pTTL(key: string): Promise<number>;

  incr(key: string): Promise<number>;

  zAdd(key: string, members: RedisSortedSetMember[]): Promise<number>;
  zRangeByScore(key: string, min: number | string, max: number | string): Promise<string[]>;

  hIncrBy(key: string, field: string, increment: number): Promise<number>;
  hIncrByFloat(key: string, field: string, increment: number): Promise<number | string>;
  hGetAll(key: string): Promise<Record<string, string>>;
}
