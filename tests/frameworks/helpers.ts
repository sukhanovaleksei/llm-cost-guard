import type {
  ExpressGuardLocalsValue,
  ExpressRequestLike,
  ExpressResponseLike,
} from '../../src/frameworks/express/types.js';
import type { NestRequestLike, NestResponseLike } from '../../src/frameworks/nest/types.js';
import { createGuard } from '../../src/runtime/createGuard.js';
import { createMemoryStorage } from '../../src/storage/memory/memoryStorage.js';
import type { Guard } from '../../src/types/config.js';
import type { JsonObject } from '../../src/types/json.js';
import type { GuardResult, RunContext } from '../../src/types/run.js';

export const flushAsync = (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

export const createTestGuard = (): Guard => {
  return createGuard({
    defaultProjectId: 'test-project',
    storage: createMemoryStorage(),
    pricing: [
      {
        providerId: 'openai',
        model: 'gpt-4o-mini',
        inputCostPerMillionTokens: 0.15,
        outputCostPerMillionTokens: 0.6,
      },
    ],
  });
};

export const createThrowingGuard = (error: Error): Guard => {
  const baseGuard = createTestGuard();

  return {
    ...baseGuard,
    async run<TExecuteResult>(): Promise<GuardResult<TExecuteResult>> {
      throw error;
    },
  };
};

export const createBaseRunContext = (): RunContext => {
  return {
    provider: { id: 'openai', model: 'gpt-4o-mini', maxTokens: 128 },
    request: { messages: [{ role: 'user', content: 'Hello from test' }] },
  };
};

export const createExpressRequest = (
  overrides: Partial<ExpressRequestLike> = {},
): ExpressRequestLike => {
  return {
    method: 'POST',
    path: '/chat',
    originalUrl: '/chat',
    baseUrl: '',
    route: { path: '/chat' },
    ip: '127.0.0.1',
    headers: {},
    query: {},
    ...overrides,
  };
};

export class TestExpressResponse implements ExpressResponseLike {
  public locals: Record<string, ExpressGuardLocalsValue> = {};
  public headersSent = false;
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body: JsonObject | undefined;

  public status(code: number): this {
    this.statusCode = code;
    return this;
  }

  public json(body: JsonObject): this {
    this.body = body;
    this.headersSent = true;
    return this;
  }

  public setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }
}

export const createNestRequest = (overrides: Partial<NestRequestLike> = {}): NestRequestLike => {
  return {
    method: 'POST',
    path: '/chat',
    originalUrl: '/chat',
    route: { path: '/chat' },
    ip: '127.0.0.1',
    headers: {},
    query: {},
    ...overrides,
  };
};

export class TestNestResponse implements NestResponseLike {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body: JsonObject | undefined;

  public status(code: number): this {
    this.statusCode = code;
    return this;
  }

  public json(body: JsonObject): this {
    this.body = body;
    return this;
  }

  public setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }
}

export interface TestNextResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: JsonObject;
}

export interface TestNextResponseFactoryInput {
  statusCode: number;
  headers?: Record<string, string>;
  body: JsonObject;
}

export const createTestNextResponse = (input: TestNextResponseFactoryInput): TestNextResponse => {
  return { statusCode: input.statusCode, headers: input.headers ?? {}, body: input.body };
};
