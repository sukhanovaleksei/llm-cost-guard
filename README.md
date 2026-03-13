# llm-cost-guard

Open-source TypeScript SDK for LLM cost estimation, budget enforcement, usage attribution, and cost spike analysis.

## Status

Work in progress.

## Installation

```bash
npm install llm-cost-guard

## Quick start
import { createGuard } from "llm-cost-guard";

const guard = createGuard({ defaultProjectId: "my-app" });

const result = await guard.run(
  {
    provider: {
      id: "openai",
      model: "gpt-4o-mini",
      maxTokens: 300
    },
    user: {
      id: "user-123"
    },
    attribution: {
      feature: "chat",
      endpoint: "/api/chat",
      tags: ["production", "support"]
    },
    metadata: {
      region: "eu",
      streaming: false
    },
    request: {
      messages: [{ role: "user", content: "Hello" }]
    }
  },
  async (context) => {
    return { ok: true, model: context.provider.model };
  }
);

console.log(result);