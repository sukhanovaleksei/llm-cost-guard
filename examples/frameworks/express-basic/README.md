# frameworks/express-basic

Shows how to use the Express helper layer with a lightweight Express-like request and response shape.

## What this example demonstrates

- using `withGuardedHandler(...)`
- building request context from HTTP metadata
- deriving `user.id` from headers
- running a guarded request inside a route handler
- returning an HTTP-style JSON response

## Run

```bash
npm run example:framework:express
```

## Expected outcome

The script should print:

- a successful guarded result
- request metadata-derived context
- final Express-style response state

## Notes

This example does not start a real Express server. It uses the exported framework helper interfaces to validate the handler integration path in a lightweight way.