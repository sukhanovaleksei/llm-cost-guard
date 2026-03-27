import type { GuardHooks } from '../types/hooks.js';
import {
  normalizeLoggerHookOptions,
  serializeCostSpikeDetectedEvent,
  serializeExecuteErrorEvent,
  serializeExecuteSuccessEvent,
  serializePolicyEvaluatedEvent,
  serializePreflightBuiltEvent,
  serializeRequestBlockedEvent,
  serializeRequestDowngradedEvent,
  serializeRunStartEvent,
  serializeUsageRecordedEvent,
} from './serializers.js';
import type {
  GuardLogEventName,
  GuardLogLevel,
  LoggerHookOptions,
  LogObject,
  StructuredLogger,
} from './types.js';

const emitStructuredLog = (
  logger: StructuredLogger,
  level: GuardLogLevel,
  eventName: GuardLogEventName,
  payload: LogObject,
): void => {
  if (level === 'debug') {
    logger.debug?.(eventName, payload);
    return;
  }

  if (level === 'info') {
    logger.info?.(eventName, payload);
    return;
  }

  if (level === 'warn') {
    logger.warn?.(eventName, payload);
    return;
  }

  logger.error?.(eventName, payload);
};

export const createStructuredLoggerHooks = (
  logger: StructuredLogger,
  options: LoggerHookOptions = {},
): GuardHooks => {
  const normalizedOptions = normalizeLoggerHookOptions(options);

  return {
    onRunStart: (event): void => {
      emitStructuredLog(
        logger,
        'debug',
        'guard.run.started',
        serializeRunStartEvent(event, normalizedOptions),
      );
    },

    onPreflightBuilt: (event): void => {
      emitStructuredLog(
        logger,
        'debug',
        'guard.preflight.built',
        serializePreflightBuiltEvent(event, normalizedOptions),
      );
    },

    onPolicyEvaluated: (event): void => {
      emitStructuredLog(
        logger,
        'info',
        'guard.policy.evaluated',
        serializePolicyEvaluatedEvent(event, normalizedOptions),
      );
    },

    onRequestBlocked: (event): void => {
      emitStructuredLog(
        logger,
        'error',
        'guard.request.blocked',
        serializeRequestBlockedEvent(event, normalizedOptions),
      );
    },

    onRequestDowngraded: (event): void => {
      emitStructuredLog(
        logger,
        'warn',
        'guard.request.downgraded',
        serializeRequestDowngradedEvent(event, normalizedOptions),
      );
    },

    onExecuteSuccess: (event): void => {
      emitStructuredLog(
        logger,
        'info',
        'guard.execute.succeeded',
        serializeExecuteSuccessEvent(event, normalizedOptions),
      );
    },

    onExecuteError: (event): void => {
      emitStructuredLog(
        logger,
        'error',
        'guard.execute.failed',
        serializeExecuteErrorEvent(event, normalizedOptions),
      );
    },

    onUsageRecorded: (event): void => {
      emitStructuredLog(
        logger,
        'info',
        'guard.usage.recorded',
        serializeUsageRecordedEvent(event, normalizedOptions),
      );
    },

    onCostSpikeDetected: (event): void => {
      emitStructuredLog(
        logger,
        'warn',
        'guard.cost_spike.detected',
        serializeCostSpikeDetectedEvent(event, normalizedOptions),
      );
    },
  };
};
