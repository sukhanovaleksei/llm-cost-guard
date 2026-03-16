import { InvalidMaxTokensError } from '../errors/InvalidMaxTokensError.js';
import { MissingModelError } from '../errors/MissingModelError.js';
import { MissingProjectIdError } from '../errors/MissingProjectIdError.js';
import { MissingProviderIdError } from '../errors/MissingProviderIdError.js';
import type { ResolvedGuardConfig } from '../types/config.js';
import type { ResolvedRunContext, RunContext } from '../types/run.js';
import {
  normalizeMetadata,
  normalizeNonEmptyString,
  normalizePositiveInteger,
  normalizeStringArray,
} from '../utils/normalize.js';

export const resolveRunContext = <TRequest = undefined>(
  config: ResolvedGuardConfig,
  context: RunContext<TRequest>,
): ResolvedRunContext<TRequest> => {
  const projectId =
    normalizeNonEmptyString(context.project?.id) ??
    normalizeNonEmptyString(config.defaultProjectId);
  if (!projectId) throw new MissingProjectIdError();

  const providerId = normalizeNonEmptyString(context.provider?.id);
  if (!providerId) throw new MissingProviderIdError();

  const model = normalizeNonEmptyString(context.provider?.model);
  if (!model) throw new MissingModelError();

  const maxTokensRaw = context.provider?.maxTokens;
  const maxTokens = normalizePositiveInteger(maxTokensRaw);

  if (maxTokensRaw !== undefined && maxTokens === undefined) throw new InvalidMaxTokensError();

  const userId = normalizeNonEmptyString(context.user?.id);
  const feature = normalizeNonEmptyString(context.attribution?.feature);
  const endpoint = normalizeNonEmptyString(context.attribution?.endpoint);
  const tags = normalizeStringArray(context.attribution?.tags);
  const metadata = normalizeMetadata(context.metadata);

  return {
    project: {
      id: projectId,
    },
    provider: {
      id: providerId,
      model,
      ...(maxTokens !== undefined ? { maxTokens } : {}),
    },
    ...(userId ? { user: { id: userId } } : {}),
    ...(context.request !== undefined ? { request: context.request } : {}),
    attribution: {
      ...(feature ? { feature } : {}),
      ...(endpoint ? { endpoint } : {}),
      tags,
    },
    metadata,
  };
};
