# adapters/anthropic-real

Runs the Anthropic adapter against the real Anthropic Messages API.

## What this example demonstrates

- real `@anthropic-ai/sdk` usage
- `wrapAnthropic(client)`
- real request budget checks
- real `actualUsage` reconciliation from provider response

## Setup

Copy `.env.example` to `.env` in this folder or define the variables in the repository root `.env`.

Required variables:
- `ANTHROPIC_API_KEY`

Optional variables:
- `ANTHROPIC_MODEL`

## Run

```bash
npm run example:adapter:anthropic:real
```

## Expected outcome

The script should print:

- an allowed decision
- estimated input cost
- estimated worst-case cost
- actual token usage from Anthropic
- final result payload

## Notes

This example is not part of examples:smoke because it requires external credentials and network access.