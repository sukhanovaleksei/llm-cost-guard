import {
  type ExpressRequestLike,
  type ExpressResponseLike,
  withGuardedHandler,
} from '../../../src/frameworks/express/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

interface DemoResponseState {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, string | number | boolean | null> | null;
}

const readHeader = (value: string | string[] | undefined, fallbackValue: string): string => {
  if (Array.isArray(value)) return value[0] ?? fallbackValue;

  return value ?? fallbackValue;
};

const main = async (): Promise<void> => {
  const guard = createDemoGuard();

  const request: ExpressRequestLike = {
    method: 'POST',
    path: '/chat',
    originalUrl: '/chat',
    baseUrl: '',
    route: { path: '/chat' },
    ip: '127.0.0.1',
    headers: { 'x-user-id': 'express-user-01', 'x-request-id': 'express-request-01' },
    query: {},
  };

  const responseState: DemoResponseState = { statusCode: 200, headers: {}, body: null };

  const completion = new Promise<void>((resolve, reject) => {
    const response: ExpressResponseLike = {
      locals: {},

      status(code: number): ExpressResponseLike {
        responseState.statusCode = code;
        return this;
      },

      json(body): ExpressResponseLike {
        responseState.body = body as Record<string, string | number | boolean | null>;
        resolve();
        return this;
      },

      setHeader(name: string, value: string): void {
        responseState.headers[name] = value;
      },
    };

    const handler = withGuardedHandler(
      {
        guard,
        defaultContext: {
          project: { id: 'express-demo' },
          provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
        },
        contextFactory: ({ request: inputRequest }) => {
          return { user: { id: readHeader(inputRequest.headers['x-user-id'], 'anonymous') } };
        },
      },
      async ({ tools, response: inputResponse }) => {
        const result = await tools.run(
          {
            request: {
              messages: [{ role: 'user', content: 'Hello from the Express helper example.' }],
            },
            attribution: { feature: 'examples', endpoint: '/chat', tags: ['framework', 'express'] },
          },
          async () => {
            return {
              result: { ok: true, framework: 'express' },
              usage: { inputTokens: 140, outputTokens: 70 },
            };
          },
        );

        printGuardResult('frameworks/express-basic', result);

        inputResponse.status(200).json({ ok: true, framework: 'express', runId: result.runId });
      },
    );

    handler(request, response, (error?: Error) => {
      if (error !== undefined) reject(error);
    });
  });

  await completion;

  console.log('\nexpress-style response:');
  console.log(JSON.stringify(responseState, null, 2));
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('frameworks/express-basic', wrappedError);
});
