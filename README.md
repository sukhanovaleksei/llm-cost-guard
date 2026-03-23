# llm-cost-guard

Open-source TypeScript SDK for LLM cost estimation, budget enforcement, usage attribution, and cost spike analysis.

## Status

Work in progress.

## Installation

```bash
npm install llm-cost-guard
```

## Quick start

```bash
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