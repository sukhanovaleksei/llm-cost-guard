# adapters/openai-real

Runs the OpenAI adapter against the real OpenAI Responses API.

## What this example demonstrates

- real `openai` SDK usage
- `wrapOpenAI(client)`
- real request budget checks
- real `actualUsage` reconciliation from provider response

## Setup

Copy `.env.example` to `.env` in this folder or define the variables in the repository root `.env`.

Required variables:
- `OPENAI_API_KEY`

Optional variables:
- `OPENAI_MODEL`

## Run

```bash
npm run example:adapter:openai:real
```

## Notes

This example is not part of examples:smoke because it requires external credentials and network access.