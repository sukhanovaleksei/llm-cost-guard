export interface RunContext {
  projectId?: string;
  providerId?: string;
  model: string;
}

export interface ResolvedRunContext {
  projectId: string;
  providerId: string;
  model: string;
}

export interface GuardDecision {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
}

export interface GuardResult<TResult> {
  result: TResult;
  context: ResolvedRunContext;
  decision: GuardDecision;
}