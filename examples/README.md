## Example catalog

| Command | Category | What it demonstrates |
|---|---|---|
| `npm run example:core:basic-run` | core | minimal successful `guard.run()` flow |
| `npm run example:core:basic-run-blocked` | core | hard-mode budget block |
| `npm run example:core:basic-run-downgraded` | core | automatic downgrade |
| `npm run example:adapter:openai` | adapters | OpenAI adapter integration with mock client |
| `npm run example:adapter:anthropic` | adapters | Anthropic adapter integration with mock client |
| `npm run example:budget:per-user` | budgets | per-user aggregate budget behavior |
| `npm run example:storage:redis` | storage | Redis storage adapter contract |
| `npm run example:analytics:spike` | analytics | cost spike explanation flow |
| `npm run example:framework:express` | frameworks | Express helper usage |
| `npm run example:framework:next` | frameworks | Next route helper usage |
| `npm run example:framework:nest` | frameworks | Nest helper usage |

## Recommended order

1. core/basic-run
2. core/basic-run-blocked
3. core/basic-run-downgraded
4. adapter examples
5. budget example
6. storage example
7. analytics example
8. framework examples