import type { GuardHooks } from '../types/hooks.js';
import { createStructuredLoggerHooks } from './createStructuredLoggerHooks.js';
import type {
  GuardLogEventName,
  GuardLogLevel,
  LoggerHookOptions,
  LogObject,
  StructuredLogger,
} from './types.js';

export interface ConsoleLoggerHookOptions extends LoggerHookOptions {
  minLevel?: GuardLogLevel;
}

const levelWeight: Record<GuardLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const shouldWrite = (level: GuardLogLevel, minLevel: GuardLogLevel): boolean =>
  levelWeight[level] >= levelWeight[minLevel];

const writeToConsole = (
  level: GuardLogLevel,
  eventName: GuardLogEventName,
  payload: LogObject,
): void => {
  if (level === 'debug') {
    console.debug(eventName, payload);
    return;
  }

  if (level === 'info') {
    console.info(eventName, payload);
    return;
  }

  if (level === 'warn') {
    console.warn(eventName, payload);
    return;
  }

  console.error(eventName, payload);
};

export const createConsoleLoggerHooks = (options: ConsoleLoggerHookOptions = {}): GuardHooks => {
  const minLevel = options.minLevel ?? 'info';

  const logger: StructuredLogger = {
    debug: (eventName, payload): void => {
      if (shouldWrite('debug', minLevel)) writeToConsole('debug', eventName, payload);
    },

    info: (eventName, payload): void => {
      if (shouldWrite('info', minLevel)) writeToConsole('info', eventName, payload);
    },

    warn: (eventName, payload): void => {
      if (shouldWrite('warn', minLevel)) writeToConsole('warn', eventName, payload);
    },

    error: (eventName, payload): void => {
      if (shouldWrite('error', minLevel)) writeToConsole('error', eventName, payload);
    },
  };

  return createStructuredLoggerHooks(logger, options);
};
