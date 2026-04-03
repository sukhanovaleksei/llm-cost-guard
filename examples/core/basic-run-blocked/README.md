# core/basic-run-blocked

Shows how a request is blocked before execution when the estimated request cost exceeds the configured hard limit.

## What this example demonstrates

- request preflight estimation
- hard-mode request budget enforcement
- blocking an over-budget request before the provider call
- handling a thrown guard error

## Run

```bash
npm run example:core:basic-run-blocked
```

## Expected outcome

The script should fail with a budget-related error and print:

- error name
- error message
- stack trace

## Notes

This example is intentionally expected to fail in order to show the blocking behavior in hard mode.