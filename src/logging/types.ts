import type {
  CostSpikeDetectedEvent,
  ExecuteErrorEvent,
  ExecuteSuccessEvent,
  PolicyEvaluatedEvent,
  PreflightBuiltEvent,
  RequestBlockedEvent,
  RequestDowngradedEvent,
  RunStartEvent,
  UsageRecordedEvent,
} from '../types/hooks.js';

export type LogScalar = string | number | boolean | null;

export interface LogObject {
  [key: string]: LogValue;
}

export type LogValue = LogScalar | LogObject | LogValue[];

export type GuardLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type GuardLogEventName =
  | 'guard.run.started'
  | 'guard.preflight.built'
  | 'guard.policy.evaluated'
  | 'guard.request.blocked'
  | 'guard.request.downgraded'
  | 'guard.execute.succeeded'
  | 'guard.execute.failed'
  | 'guard.usage.recorded'
  | 'guard.cost_spike.detected';

export interface StructuredLogger {
  debug?: (eventName: GuardLogEventName, payload: LogObject) => void;
  info?: (eventName: GuardLogEventName, payload: LogObject) => void;
  warn?: (eventName: GuardLogEventName, payload: LogObject) => void;
  error?: (eventName: GuardLogEventName, payload: LogObject) => void;
}

export interface LoggerHookOptions {
  includeRequestContent?: boolean;
  includeMetadata?: boolean;
  includeTags?: boolean;
  includePreflight?: boolean;
  includeActualUsage?: boolean;
  includeUsageRecord?: boolean;
  includeCostSpikeExplanation?: boolean;
}

export interface NormalizedLoggerHookOptions {
  includeRequestContent: boolean;
  includeMetadata: boolean;
  includeTags: boolean;
  includePreflight: boolean;
  includeActualUsage: boolean;
  includeUsageRecord: boolean;
  includeCostSpikeExplanation: boolean;
}

export interface GuardLifecycleEventMap {
  'guard.run.started': RunStartEvent;
  'guard.preflight.built': PreflightBuiltEvent;
  'guard.policy.evaluated': PolicyEvaluatedEvent;
  'guard.request.blocked': RequestBlockedEvent;
  'guard.request.downgraded': RequestDowngradedEvent;
  'guard.execute.succeeded': ExecuteSuccessEvent;
  'guard.execute.failed': ExecuteErrorEvent;
  'guard.usage.recorded': UsageRecordedEvent;
  'guard.cost_spike.detected': CostSpikeDetectedEvent;
}
