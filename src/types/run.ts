export interface RunContext<TRequest = undefined> {
  project?: {
    id?: string;
  };
  provider?: {
    id?: string;
    model?: string;
    maxTokens?: number;
  };
  user?: {
    id?: string;
  };
  request?: TRequest | undefined;
  attribution?: {
    feature?: string;
    endpoint?: string;
    tags?: string[];
  };
  metadata?: Record<string, string | number | boolean>;
}

export interface ResolvedRunContext<TRequest = undefined> {
  project: {
    id: string;
  };
  provider: {
    id: string;
    model: string;
    maxTokens?: number;
  };
  user?: {
    id?: string;
  };
  request?: TRequest | undefined;
  attribution: {
    feature?: string;
    endpoint?: string;
    tags: string[];
  };
  metadata: Record<string, string | number | boolean>;
}

export interface GuardDecision {
  allowed: boolean;
}

export interface GuardResult<TResult, TRequest = undefined> {
  result: TResult;
  context: ResolvedRunContext<TRequest>;
  decision: GuardDecision;
}

export type ExecuteFn<TResult, TRequest = undefined> = (
  context: ResolvedRunContext<TRequest>
) => Promise<TResult> | TResult;