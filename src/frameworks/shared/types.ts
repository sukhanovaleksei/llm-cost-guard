import type { Guard } from '../../types/config.js';
import type { JsonObject } from '../../types/json.js';
import type {
  ExecuteReturnValue,
  GuardResult,
  ResolvedRunContext,
  RunContext,
} from '../../types/run.js';

export interface HttpRequestMetadata {
  method: string;
  path: string;
  route?: string | undefined;
  ip?: string | undefined;
  requestId?: string | undefined;
  headers: Record<string, string>;
  query: Record<string, string>;
}

export interface HttpGuardContextFactoryInput<TRequest> {
  request: TRequest;
  metadata: HttpRequestMetadata;
}

export type HttpGuardContextFactory<TRequest> = (
  input: HttpGuardContextFactoryInput<TRequest>,
) => RunContext;

export interface HttpGuardTools {
  buildContext(overrides?: RunContext): RunContext;

  run<TExecuteResult>(
    overrides: RunContext,
    execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
  ): Promise<GuardResult<TExecuteResult>>;

  runWithContext<TExecuteResult>(
    context: RunContext,
    execute: (context: ResolvedRunContext) => Promise<ExecuteReturnValue<TExecuteResult>>,
  ): Promise<GuardResult<TExecuteResult>>;
}

export interface CreateHttpGuardToolsInput<TRequest> {
  guard: Guard;
  request: TRequest;
  metadata: HttpRequestMetadata;
  contextFactory?: HttpGuardContextFactory<TRequest> | undefined;
  defaultContext?: RunContext | undefined;
}

export interface HttpGuardErrorBody extends JsonObject {
  error: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

export interface HttpGuardErrorResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: HttpGuardErrorBody;
}
