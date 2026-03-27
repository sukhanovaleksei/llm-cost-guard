import type { HookEventBase } from '../types/hooks.js';
import type { ResolvedRunContext } from '../types/run.js';

export const createHookEventBase = (runId: string, context: ResolvedRunContext): HookEventBase => ({
  runId,
  timestamp: new Date().toISOString(),
  context,
});
