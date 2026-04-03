# frameworks/next-basic

Shows how to use the Next route helper layer with a lightweight Next-like request and response factory.

## What this example demonstrates

- using `withNextRouteGuard(...)`
- reading request metadata from a Next-style request
- deriving context from headers
- running a guarded request inside a route handler
- returning a normalized response through `responseFactory`

## Run

```bash
npm run example:framework:next
```

## Expected outcome

The script should print:

- a successful guarded result
- final decision and usage output
- a Next-style response object with status, headers, and body

## Notes

This example is intentionally lightweight. It validates the helper API without requiring a full Next.js project scaffold.