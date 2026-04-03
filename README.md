# llm-cost-guard

Open-source TypeScript SDK for LLM cost estimation, budget enforcement, usage attribution, and cost spike analysis.

## Status

Work in progress.

## Installation

```bash
npm install llm-cost-guard
```

## Quick start

```ts
import { createGuard } from 'llm-cost-guard';

const guard = createGuard({
  defaultProjectId: 'my-app',
  pricing: [
    {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      inputCostPerMillionTokens: 0.15,
      outputCostPerMillionTokens: 0.6,
    },
  ],
  policies: {
    requestBudget: {
      maxEstimatedWorstCaseCostUsd: 0.01,
    },
  },
});

const result = await guard.run(
  {
    provider: {
      id: 'openai',
      model: 'gpt-4o-mini',
      maxTokens: 2000,
    },
    request: {
      messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
    },
  },
  async () => {
    const response = await providerCall();

    return {
      result: response,
      usage: {
        inputTokens: 1200,
        outputTokens: 300,
      },
    };
  },
);

console.log(result);
```

## OpenAI Responses API

```ts
import OpenAI from 'openai';
import { createGuard, wrapOpenAI } from 'llm-cost-guard';

const guard = createGuard({
  defaultProjectId: 'app-main',
  pricing: [
    {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      inputCostPerMillionTokens: 0.15,
      outputCostPerMillionTokens: 0.6,
    },
  ],
  policies: {
    requestBudget: {
      maxEstimatedWorstCaseCostUsd: 0.01,
    },
  },
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const openai = wrapOpenAI(client);

const result = await openai.responses.create(
  guard,
  {},
  {
    model: 'gpt-4o-mini',
    input: 'Explain distributed systems in depth',
    max_output_tokens: 500,
  },
);

console.log(result.actualUsage);
console.log(result.decision);
```

## Anthropic

```ts
import Anthropic from '@anthropic-ai/sdk';
import { createGuard, wrapAnthropic } from 'llm-cost-guard';

const guard = createGuard({
  defaultProjectId: 'app-main',
  pricing: [
    {
      providerId: 'anthropic',
      model: 'claude-3-5-haiku-latest',
      inputCostPerMillionTokens: 0.8,
      outputCostPerMillionTokens: 4,
    },
  ],
  policies: {
    requestBudget: {
      maxEstimatedWorstCaseCostUsd: 0.01,
    },
  },
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const anthropic = wrapAnthropic(client);

const result = await anthropic.messages.create(
  guard,
  {},
  {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 500,
    messages: [{ role: 'user', content: 'Explain distributed systems in depth' }],
  },
);

console.log(result.actualUsage);
console.log(result.decision);
```

## Automatic downgrade for over-budget requests

```ts
const guard = createGuard({
  defaultProjectId: 'app-main',
  pricing: [
    {
      providerId: 'openai',
      model: 'gpt-4o',
      inputCostPerMillionTokens: 2.5,
      outputCostPerMillionTokens: 10,
    },
    {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      inputCostPerMillionTokens: 0.15,
      outputCostPerMillionTokens: 0.6,
    },
  ],
  policies: {
    requestBudget: {
      maxEstimatedWorstCaseCostUsd: 0.001,
    },
    downgrade: {
      onRequestBudgetExceeded: {
        fallbackModel: 'gpt-4o-mini',
        fallbackMaxTokens: 500,
      },
    },
  },
});

const result = await guard.run(
  {
    provider: { id: 'openai', model: 'gpt-4o', maxTokens: 2000 },
    request: { messages: [{ role: 'user', content: 'Hello world' }] },
  },
  async (context) => {
    // context.provider.model may already be downgraded here
    return { ok: true, model: context.provider.model };
  },
);

console.log(result);
```

## Hooks

```ts
const guard = createGuard({
  defaultProjectId: 'app-main',
  pricing: [
    {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      inputCostPerMillionTokens: 0.15,
      outputCostPerMillionTokens: 0.6,
    },
  ],
  hooks: {
    onRequestBlocked(event) {
      console.log('blocked', event.violation);
    },
    onRequestDowngraded(event) {
      console.log('downgraded to', event.appliedDowngrade.effectiveModel);
    },
    onUsageRecorded(event) {
      console.log('usage recorded', event.usageRecord.id);
    },
  },
});
```

```ts
import { createConsoleLoggerHooks, createGuard } from 'llm-cost-guard';

const guard = createGuard({
  defaultProjectId: 'app-main',
  pricing: [
    {
      providerId: 'openai',
      model: 'gpt-4o-mini',
      inputCostPerMillionTokens: 0.15,
      outputCostPerMillionTokens: 0.6,
    },
  ],
  hooks: createConsoleLoggerHooks({
    minLevel: 'info',
    includeRequestContent: false,
  }),
});
```

## Runnable examples

See [`examples/README.md`](./examples/README.md).

Quick commands:

```bash
npm run example:core:basic-run
npm run example:core:basic-run-blocked
npm run example:adapter:openai
npm run example:budget:per-user
npm run example:storage:redis
npm run example:analytics:spike
npm run example:framework:express
npm run example:framework:next
npm run example:framework:nest
```