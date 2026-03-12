# llm-cost-guard

Open-source TypeScript SDK for LLM cost estimation, budget enforcement, usage attribution, and cost spike analysis.

## Status

Work in progress.

## Installation

```bash
npm install llm-cost-guard

## Quick start
import { createGuard } from "llm-cost-guard";

const guard = createGuard({
  defaultProjectId: "my-app",
  mode: "hard",
});

const result = await guard.run(
  {
    model: "gpt-4o-mini",
    providerId: "openai",
  },
  async () => {
    return { ok: true };
  }
);

console.log(result);