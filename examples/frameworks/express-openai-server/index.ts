import express, { type Request, type Response } from 'express';
import OpenAI from 'openai';

import { wrapOpenAI } from '../../../src/adapters/openai/index.js';
import { withGuardedHandler } from '../../../src/frameworks/express/index.js';
import { createDemoGuard } from '../../_shared/createDemoGuard.js';
import { getRequiredEnv } from '../../_shared/getRequiredEnv.js';
import { loadExampleEnv } from '../../_shared/loadExampleEnv.js';

loadExampleEnv(import.meta.url);

interface ChatRequestBody {
  prompt?: string;
  userId?: string;
}

interface ChatResponseBody {
  ok: boolean;
  runId: string;
  model: string;
  text: string;
}

interface ErrorResponseBody {
  ok: boolean;
  error: string;
}

interface ExpressChatRequest extends Request {
  body: ChatRequestBody;
}

const main = async (): Promise<void> => {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const port = Number(process.env.PORT ?? '3000');

  const client = new OpenAI({ apiKey });
  const openai = wrapOpenAI(client);

  const guard = createDemoGuard({
    policies: { requestBudget: { maxEstimatedWorstCaseCostUsd: 0.01 } },
  });

  const app = express();
  app.use(express.json());

  app.get('/health', (_request: Request, response: Response) => {
    response.json({ ok: true });
  });

  app.post(
    '/chat',
    withGuardedHandler<ExpressChatRequest, Response>(
      {
        guard,
        defaultContext: {
          project: { id: 'express-openai-server' },
          provider: { id: 'openai', model, maxTokens: 300 },
        },
        contextFactory: ({ request }) => {
          return { user: { id: request.body.userId ?? 'anonymous' } };
        },
      },
      async ({ request, response, tools }) => {
        const prompt = request.body.prompt?.trim() ?? 'Say hello from llm-cost-guard';

        const result = await tools.run(
          {
            request: { messages: [{ role: 'user', content: prompt }] },
            attribution: {
              feature: 'chat-api',
              endpoint: '/chat',
              tags: ['framework', 'express', 'real'],
            },
          },
          async () => {
            const providerResult = await openai.responses.create(
              guard,
              {},
              { model, input: prompt, max_output_tokens: 250 },
            );

            const text =
              typeof providerResult.result?.output_text === 'string'
                ? providerResult.result.output_text
                : 'No text output';

            return {
              result: {
                runId: providerResult.runId,
                model: providerResult.context.provider.model,
                text,
              },
              usage:
                providerResult.actualUsage === undefined
                  ? { inputTokens: 0, outputTokens: 0 }
                  : {
                      inputTokens: providerResult.actualUsage.inputTokens,
                      outputTokens: providerResult.actualUsage.outputTokens,
                    },
            };
          },
        );

        const payload: ChatResponseBody = {
          ok: true,
          runId: result.runId,
          model: result.context.provider.model,
          text: result.result === undefined ? 'No result payload' : result.result.text,
        };

        response.status(200).json(payload);
      },
    ),
  );

  app.use((error: Error, _request: Request, response: Response<ErrorResponseBody>) => {
    response.status(500).json({ ok: false, error: error.message });
  });

  app.listen(port, () => {
    console.log(`Express example server is running on http://localhost:${port}`);
    console.log('POST /chat with JSON body: {"prompt":"Hello","userId":"user-1"}');
  });
};

main().catch((error) => {
  const wrappedError = error instanceof Error ? error : new Error(String(error));
  console.error(wrappedError);
  process.exitCode = 1;
});
