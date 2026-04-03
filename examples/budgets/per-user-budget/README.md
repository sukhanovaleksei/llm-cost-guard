# budgets/per-user-budget

Shows how aggregate spend can be tracked and limited for a specific user.

## What this example demonstrates

- using a shared storage instance across multiple requests
- per-user daily aggregate budget checks
- running repeated requests for the same `user.id`
- observing how the second request behaves after earlier spend is recorded
- inspecting `decision` and possible budget violation details

## Run

```bash
npm run example:budget:per-user
```

## Expected outcome

The script should print the result of two requests for the same user. Typical things to observe:

- the first request is usually allowed
- the second request may be marked as over budget depending on the configured threshold
- the output shows how stored usage affects later decisions

## Notes

This example is a good starting point for SaaS-style usage controls, free-tier limits, and per-account budget enforcement.