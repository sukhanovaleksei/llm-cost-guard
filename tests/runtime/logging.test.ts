import { describe, expect, it } from 'vitest';

import {
  createGuard,
  createStructuredLoggerHooks,
  RequestBudgetExceededError,
} from '../../src/index.js';
import type {
  GuardLogEventName,
  GuardLogLevel,
  LogObject,
  StructuredLogger,
} from '../../src/logging/types.js';

interface CapturedLogEntry {
  level: GuardLogLevel;
  eventName: GuardLogEventName;
  payload: LogObject;
}

const createCapturedLogger = (): {
  entries: CapturedLogEntry[];
  logger: StructuredLogger;
} => {
  const entries: CapturedLogEntry[] = [];

  return {
    entries,
    logger: {
      debug: (eventName, payload): void => {
        entries.push({ level: 'debug', eventName, payload });
      },
      info: (eventName, payload): void => {
        entries.push({ level: 'info', eventName, payload });
      },
      warn: (eventName, payload): void => {
        entries.push({ level: 'warn', eventName, payload });
      },
      error: (eventName, payload): void => {
        entries.push({ level: 'error', eventName, payload });
      },
    },
  };
};

const getStringField = (payload: LogObject, key: string): string | undefined => {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
};

const getObjectField = (payload: LogObject, key: string): LogObject | undefined => {
  const value = payload[key];

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value;

  return undefined;
};

const createGuardWithPricing = (logger: StructuredLogger, includeRequestContent = false) =>
  createGuard({
    defaultProjectId: 'app-main',
    pricing: [
      {
        providerId: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
      },
      {
        providerId: 'openai',
        model: 'gpt-4o',
        inputCostPerMillionTokens: 2.5,
        outputCostPerMillionTokens: 10,
      },
    ],
    hooks: createStructuredLoggerHooks(logger, { includeRequestContent }),
  });

describe('structured logger hooks', () => {
  it('uses the same runId across all lifecycle events and the result', async () => {
    const { logger, entries } = createCapturedLogger();
    const guard = createGuardWithPricing(logger);

    const result = await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        request: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
      },
    );

    const runIds = entries
      .map((entry) => getStringField(entry.payload, 'runId'))
      .filter((value): value is string => value !== undefined);

    expect(runIds.length).toBeGreaterThan(0);
    expect(new Set(runIds).size).toBe(1);
    expect(runIds[0]).toBe(result.runId);
  });

  it('redacts request content by default', async () => {
    const { logger, entries } = createCapturedLogger();
    const guard = createGuardWithPricing(logger);

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        request: { messages: [{ role: 'user', content: 'secret prompt' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 50, outputTokens: 10 } };
      },
    );

    const startedEntry = entries.find((entry) => entry.eventName === 'guard.run.started');
    const request = startedEntry ? getObjectField(startedEntry.payload, 'request') : undefined;

    expect(request).toBeDefined();
    expect(getStringField(request ?? {}, 'requestType')).toBe('messages_request');
    expect(request?.messages).toBeUndefined();
  });

  it('includes request content when includeRequestContent is enabled', async () => {
    const { logger, entries } = createCapturedLogger();
    const guard = createGuardWithPricing(logger, true);

    await guard.run(
      {
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 200 },
        request: { messages: [{ role: 'user', content: 'visible prompt' }] },
      },
      async () => {
        return { result: { ok: true }, usage: { inputTokens: 50, outputTokens: 10 } };
      },
    );

    const startedEntry = entries.find((entry) => entry.eventName === 'guard.run.started');
    const request = startedEntry ? getObjectField(startedEntry.payload, 'request') : undefined;

    expect(request).toBeDefined();
    expect(getStringField(request ?? {}, 'requestType')).toBe('messages_request');
    expect(Array.isArray(request?.messages)).toBe(true);
  });

  it('logs blocked request and usage record for the same run', async () => {
    const { logger, entries } = createCapturedLogger();

    const guard = createGuard({
      defaultProjectId: 'app-main',
      mode: 'hard',
      pricing: [
        {
          providerId: 'openai',
          model: 'gpt-4o',
          inputCostPerMillionTokens: 2.5,
          outputCostPerMillionTokens: 10,
        },
      ],
      policies: {
        requestBudget: {
          maxEstimatedWorstCaseCostUsd: 0.000001,
        },
      },
      hooks: createStructuredLoggerHooks(logger),
    });

    await expect(
      guard.run(
        {
          provider: { id: 'openai', model: 'gpt-4o', maxTokens: 4000 },
          request: {
            messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
          },
        },
        async () => {
          return { result: { ok: true }, usage: { inputTokens: 100, outputTokens: 20 } };
        },
      ),
    ).rejects.toBeInstanceOf(RequestBudgetExceededError);

    const blockedEntry = entries.find((entry) => entry.eventName === 'guard.request.blocked');
    const usageRecordedEntry = entries.find((entry) => entry.eventName === 'guard.usage.recorded');

    expect(blockedEntry).toBeDefined();
    expect(usageRecordedEntry).toBeDefined();

    expect(getStringField(blockedEntry?.payload ?? {}, 'runId')).toBe(
      getStringField(usageRecordedEntry?.payload ?? {}, 'runId'),
    );
  });
});
