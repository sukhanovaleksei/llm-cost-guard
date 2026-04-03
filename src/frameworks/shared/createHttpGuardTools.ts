import type { RunContext } from '../../types/run.js';
import { mergeRunContexts } from './mergeRunContexts.js';
import type { CreateHttpGuardToolsInput, HttpGuardTools } from './types.js';

const buildHttpBaseContext = (
  method: string,
  path: string,
  route: string | undefined,
  requestId: string | undefined,
): RunContext => {
  return {
    attribution: { endpoint: route ?? path, tags: [] },
    metadata: {
      httpMethod: method,
      httpPath: path,
      ...(route !== undefined ? { httpRoute: route } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
    },
  };
};

export const createHttpGuardTools = <TRequest>(
  input: CreateHttpGuardToolsInput<TRequest>,
): HttpGuardTools => {
  const factoryContext =
    input.contextFactory?.({ request: input.request, metadata: input.metadata }) ?? {};

  const baseContext = mergeRunContexts(
    buildHttpBaseContext(
      input.metadata.method,
      input.metadata.path,
      input.metadata.route,
      input.metadata.requestId,
    ),
    mergeRunContexts(input.defaultContext ?? {}, factoryContext),
  );

  const buildContext: HttpGuardTools['buildContext'] = (overrides: RunContext = {}): RunContext => {
    return mergeRunContexts(baseContext, overrides);
  };

  const run: HttpGuardTools['run'] = (overrides, execute) => {
    const context = mergeRunContexts(baseContext, overrides);
    return input.guard.run(context, execute);
  };

  const runWithContext: HttpGuardTools['runWithContext'] = (context, execute) => {
    return input.guard.run(context, execute);
  };

  return { buildContext, run, runWithContext };
};
