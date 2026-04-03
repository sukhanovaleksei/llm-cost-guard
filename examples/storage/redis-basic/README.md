# storage/redis-basic

Shows how to plug the guard into the Redis storage adapter contract.

## What this example demonstrates

- creating a Redis-backed storage adapter
- recording multiple usage records
- reusing the same storage across requests
- reading aggregated spend summary after execution
- validating the adapter contract without a real Redis server

## Run

```bash
npm run example:storage:redis
```

## Expected outcome

The script should print:

- two successful guarded requests
- actual usage for both requests
- a final spend summary loaded from the Redis-style storage adapter

## Notes

This example uses an in-memory fake Redis client, not a real Redis instance. That keeps the example deterministic while still validating the Redis adapter API shape.