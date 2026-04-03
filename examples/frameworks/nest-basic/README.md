# frameworks/nest-basic

Shows how to use the Nest helper layer with middleware-style context initialization and a guard runner.

## What this example demonstrates

- using `createNestGuardContextMiddleware(...)`
- attaching guard context to a Nest-style request object
- using `createNestGuardRunner(...)`
- running a guarded request from a controller/service-like flow
- deriving `user.id` from request headers

## Run

```bash
npm run example:framework:nest
```

## Expected outcome

The script should print:

- a successful guarded result
- context created by the Nest middleware step
- final decision, preflight, and actual usage information

## Notes

This example does not boot a real Nest application. It focuses on validating the exported Nest integration helpers in isolation.