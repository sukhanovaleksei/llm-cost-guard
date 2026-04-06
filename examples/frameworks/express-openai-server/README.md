# frameworks/express-openai-server

Runs a real Express server that uses `llm-cost-guard` together with the OpenAI adapter.

## What this example demonstrates

- real `express` app wiring
- `withGuardedHandler(...)`
- request metadata + per-request guard context
- guarded OpenAI call from an HTTP endpoint

## Setup

Copy `.env.example` to `.env` in this folder or define the variables in the repository root `.env`.

Required variables:
- `OPENAI_API_KEY`

Optional variables:
- `OPENAI_MODEL`
- `PORT`

## Run

```bash
npm run example:framework:express:real
```

## Test manually

```bash
curl -X POST http://localhost:3000/chat \
  -H "content-type: application/json" \
  -d '{"prompt":"Explain budget guards","userId":"user-123"}'
```

## Notes

This example is intentionally not part of examples:smoke.