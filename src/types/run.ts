export interface RunContext {
  projectId?: string;
  providerId?: string;
  model: string;
}

export interface GuardDecision {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
}

export interface GuardResult<TResult> {
  result: TResult;
  decision: GuardDecision;
}