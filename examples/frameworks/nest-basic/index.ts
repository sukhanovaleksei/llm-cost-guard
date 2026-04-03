import {
  createNestGuardContextMiddleware,
  createNestGuardRunner,
  type NestRequestLike,
} from '../../../src/frameworks/nest/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

const readHeader = (value: string | string[] | undefined, fallbackValue: string): string => {
  if (Array.isArray(value)) return value[0] ?? fallbackValue;

  return value ?? fallbackValue;
};

const main = async (): Promise<void> => {
  const guard = createDemoGuard();

  const request: NestRequestLike = {
    method: 'POST',
    path: '/chat',
    originalUrl: '/chat',
    route: { path: '/chat' },
    ip: '127.0.0.1',
    headers: { 'x-user-id': 'nest-user-01', 'x-request-id': 'nest-request-01' },
    query: {},
  };

  const MiddlewareClass = createNestGuardContextMiddleware({
    defaultContext: {
      project: { id: 'nest-demo' },
      provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
    },
    contextFactory: ({ request: inputRequest }) => {
      return { user: { id: readHeader(inputRequest.headers['x-user-id'], 'anonymous') } };
    },
  });

  const middleware = new MiddlewareClass();

  middleware.use(request, {}, () => {
    return;
  });

  const tools = createNestGuardRunner({ guard, request });

  const result = await tools.run(
    {
      request: { messages: [{ role: 'user', content: 'Hello from the Nest helper example.' }] },
      attribution: { feature: 'examples', endpoint: '/chat', tags: ['framework', 'nest'] },
    },
    async () => {
      return {
        result: { ok: true, framework: 'nest' },
        usage: { inputTokens: 145, outputTokens: 75 },
      };
    },
  );

  printGuardResult('frameworks/nest-basic', result);
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('frameworks/nest-basic', wrappedError);
});
