# adapters/anthropic-mock

Shows how to use `wrapAnthropic()` with a mock Anthropic-compatible client.

## What this example demonstrates

- integrating the guard with the Anthropic adapter
- calling `anthropic.messages.create(...)`
- mapping usage from an adapter response
- receiving a standard `GuardResult`
- keeping the example runnable without a real Anthropic API key

## Run

```bash
npm run example:adapter:anthropic
```

## Expected outcome

The script should print:

- an allowed decision
- estimated cost information
- actual usage extracted from the mock Anthropic response
- final adapter result payload

## Notes

This example is mock-based by design. It is meant to validate adapter integration and public API shape without external dependencies.