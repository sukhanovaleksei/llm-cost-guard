import { createHttpGuardTools } from '../shared/createHttpGuardTools.js';
import { extractNestRequestMetadata } from './extractNestRequestMetadata.js';
import type { CreateNestGuardRunnerOptions, NestRequestLike } from './types.js';

export const createNestGuardRunner = <TRequest extends NestRequestLike>(
  options: CreateNestGuardRunnerOptions<TRequest>,
) => {
  const metadata =
    options.request.llmGuard?.metadata ?? extractNestRequestMetadata(options.request);

  return createHttpGuardTools({
    guard: options.guard,
    request: options.request,
    metadata,
    contextFactory: options.contextFactory,
    defaultContext: options.request.llmGuard?.context ?? options.defaultContext,
  });
};
