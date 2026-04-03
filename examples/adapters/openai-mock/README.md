# adapters/openai-mock

Shows how to use `wrapOpenAI()` with a mock OpenAI-compatible client.

## What this example demonstrates

- integrating the guard with the OpenAI adapter
- calling `openai.responses.create(...)`
- deriving usage from an adapter response
- receiving a standard `GuardResult`
- keeping the example runnable without a real OpenAI API key

## Run

```bash
npm run example:adapter:openai
```

## Expected outcome

The script should print:

- an allowed decision
- estimated cost information
- actual usage extracted from the mock OpenAI response
- final adapter result payload

## Notes

This example uses a mock client on purpose. It validates the adapter flow without external network calls or real SDK credentials.