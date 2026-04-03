# core/basic-run-downgraded

Shows how the guard can automatically downgrade an over-budget request instead of blocking it.

## What this example demonstrates

- request budget enforcement
- automatic downgrade policy
- fallback model selection
- fallback max token reduction
- reading the effective model inside the execute callback
- inspecting `appliedDowngrade`

## Run

```bash
npm run example:core:basic-run-downgraded
```

## Expected outcome

The script should print:

- an allowed decision
- downgrade metadata
- original model and effective model
- original max tokens and effective max tokens
- final result payload

## Notes

This example is useful when you want the package to preserve availability by switching to a cheaper configuration instead of rejecting the request.