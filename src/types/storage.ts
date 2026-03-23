import type { Metadata } from '../utils/types.js';
import type { PreflightEstimate } from './preflight.js';
import type { GuardDecision, RequestBudgetViolation } from './run.js';
import type { ActualUsage } from './usage.js';

export type MaybePromise<TValue> = TValue | Promise<TValue>;

export interface UsageRecord {
  id: string;
  timestamp: string;

  projectId: string;
  providerId: string;
  model: string;

  userId?: string;
  feature?: string;
  endpoint?: string;

  tags: string[];
  metadata: Metadata;

  decision: GuardDecision;
  preflight: PreflightEstimate;
  actualUsage?: ActualUsage | undefined;
  violation?: RequestBudgetViolation;

  executed: boolean;
  blocked: boolean;
}

export interface SpendQuery {
  from?: string;
  to?: string;

  projectId?: string;
  providerId?: string;
  model?: string;

  userId?: string;
  feature?: string;
  endpoint?: string;
  tag?: string;
}

export interface SpendSummary {
  requestCount: number;
  executedCount: number;
  blockedCount: number;

  estimatedInputCostUsd: number;
  estimatedWorstCaseCostUsd: number;
  actualTotalCostUsd: number;
}

export interface StorageAdapter {
  recordUsage(record: UsageRecord): MaybePromise<void>;
  listUsage(query?: SpendQuery): MaybePromise<UsageRecord[]>;
  getSpendSummary(query?: SpendQuery): MaybePromise<SpendSummary>;
}
