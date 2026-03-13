import { MissingModelError } from "../errors/MissingModelError.js";
import { MissingProjectIdError } from "../errors/MissingProjectIdError.js";
import { MissingProviderIdError } from "../errors/MissingProviderIdError.js";
import type { ResolvedRunContext, RunContext } from "../types/run.js";
import type { ResolvedGuardConfig } from "../types/runtime.js";
import { normalizeNonEmptyString } from "../utils/normalizeNonEmptyString.js";

export const resolveRunContext = (context: RunContext, config: ResolvedGuardConfig): ResolvedRunContext => {
  const projectId = normalizeNonEmptyString(context.projectId ?? config.defaultProjectId);
  if (!projectId) throw new MissingProjectIdError();

  const providerId = normalizeNonEmptyString(context.providerId);
  if (!providerId) throw new MissingProviderIdError();

  const model = normalizeNonEmptyString(context.model);
  if (!model) throw new MissingModelError();

  return { projectId, providerId, model };
}