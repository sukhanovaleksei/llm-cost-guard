# core/basic-run

Minimal happy-path example for `createGuard()` and `guard.run()`.

## What this example demonstrates

- creating a guard with pricing and request-budget policy
- building a simple `RunContext`
- running an allowed request
- returning `result` together with `usage`
- inspecting `decision`, `preflight`, and `actualUsage`

## Run

```bash
npm run example:core:basic-run
```

## Expected outcome

The script should print:

- an allowed decision
- estimated input cost
- estimated worst-case cost
- actual token usage
- final result payload

## Notes

This is the recommended first example to run before moving to blocked, downgraded, budget, storage, analytics, or framework examples.