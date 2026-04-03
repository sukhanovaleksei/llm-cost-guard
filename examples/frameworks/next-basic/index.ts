import {
  type NextHeadersLike,
  type NextRequestLike,
  withNextRouteGuard,
} from '../../../src/frameworks/next/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { printGuardError } from '../../_shared/printGuardError.js';
import { printGuardResult } from '../../_shared/printGuardResult.js';

interface DemoNextResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, string | number | boolean | null>;
}

class DemoHeaders implements NextHeadersLike {
  private readonly values: Map<string, string>;

  public constructor(entries: Record<string, string>) {
    this.values = new Map<string, string>();

    for (const [key, value] of Object.entries(entries)) this.values.set(key.toLowerCase(), value);
  }

  public forEach(callback: (value: string, key: string) => void): void {
    for (const [key, value] of this.values.entries()) callback(value, key);
  }

  public get(name: string): string | null {
    return this.values.get(name.toLowerCase()) ?? null;
  }
}

const main = async (): Promise<void> => {
  const guard = createDemoGuard();

  const request: NextRequestLike = {
    method: 'POST',
    url: 'https://example.test/api/chat',
    headers: new DemoHeaders({ 'x-user-id': 'next-user-01', 'x-request-id': 'next-request-01' }),
  };

  const route = withNextRouteGuard<NextRequestLike, DemoNextResponse>(
    {
      guard,
      defaultContext: {
        project: { id: 'next-demo' },
        provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 300 },
      },
      contextFactory: ({ request: inputRequest }) => {
        return { user: { id: inputRequest.headers.get('x-user-id') ?? 'anonymous' } };
      },
      responseFactory: ({ statusCode, headers, body }) => {
        return {
          statusCode,
          headers,
          body: body as Record<string, string | number | boolean | null>,
        };
      },
    },
    async ({ tools }) => {
      const result = await tools.run(
        {
          request: { messages: [{ role: 'user', content: 'Hello from the Next helper example.' }] },
          attribution: { feature: 'examples', endpoint: '/api/chat', tags: ['framework', 'next'] },
        },
        async () => {
          return {
            result: { ok: true, framework: 'next' },
            usage: { inputTokens: 150, outputTokens: 80 },
          };
        },
      );

      printGuardResult('frameworks/next-basic', result);

      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: { ok: true, framework: 'next', runId: result.runId },
      };
    },
  );

  const response = await route(request);

  console.log('\nnext-style response:');
  console.log(JSON.stringify(response, null, 2));
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  printGuardError('frameworks/next-basic', wrappedError);
});
