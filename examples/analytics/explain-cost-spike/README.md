# analytics/explain-cost-spike

Shows how the guard can compare a request against previous similar runs and explain unusual cost growth.

## What this example demonstrates

- creating baseline history from earlier successful requests
- enabling cost-spike analytics
- running a much larger follow-up request
- inspecting `costSpikeExplanation`
- reading top drivers behind the increase

## Run

```bash
npm run example:analytics:spike
```

## Expected outcome

The script should print:

- a final allowed result
- actual usage for the expensive request
- cost spike detection status
- baseline sample count
- delta versus baseline
- top drivers that contributed to the spike

## Notes

This example is especially useful for debugging cases where a request suddenly becomes much more expensive because of history growth, retrieval growth, or large outputs.