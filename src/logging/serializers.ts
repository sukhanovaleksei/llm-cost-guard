import type { CostSpikeDriver, CostSpikeExplanation } from '../types/analytics.js';
import type {
  CostSpikeDetectedEvent,
  ExecuteErrorEvent,
  ExecuteSuccessEvent,
  HookEventBase,
  PolicyEvaluatedEvent,
  PreflightBuiltEvent,
  RequestBlockedEvent,
  RequestDowngradedEvent,
  RunStartEvent,
  UsageRecordedEvent,
} from '../types/hooks.js';
import type { PreflightEstimate } from '../types/preflight.js';
import type {
  MessageLike,
  MessagesRequestLike,
  RequestLike,
  RequestRecord,
  RequestRecordValue,
} from '../types/requests.js';
import type {
  AppliedDowngrade,
  EffectiveRunConfig,
  GuardDecision,
  GuardViolation,
} from '../types/run.js';
import type { UsageRecord } from '../types/storage.js';
import type { ActualUsage } from '../types/usage.js';
import type { Metadata } from '../utils/types.js';
import type {
  LoggerHookOptions,
  LogObject,
  LogValue,
  NormalizedLoggerHookOptions,
} from './types.js';

export const normalizeLoggerHookOptions = (
  options: LoggerHookOptions = {},
): NormalizedLoggerHookOptions => ({
  includeRequestContent: options.includeRequestContent ?? false,
  includeMetadata: options.includeMetadata ?? true,
  includeTags: options.includeTags ?? true,
  includePreflight: options.includePreflight ?? true,
  includeActualUsage: options.includeActualUsage ?? true,
  includeUsageRecord: options.includeUsageRecord ?? true,
  includeCostSpikeExplanation: options.includeCostSpikeExplanation ?? true,
});

const serializeMetadata = (metadata: Metadata): LogObject => {
  const result: LogObject = {};

  for (const [key, value] of Object.entries(metadata)) result[key] = value;

  return result;
};

const serializeMessage = (message: MessageLike): LogObject => {
  const result: LogObject = {};

  if (message.role !== undefined) result.role = message.role;
  if (message.content !== undefined) result.content = message.content;

  return result;
};

const isStringArray = (value: RequestRecordValue): value is string[] =>
  Array.isArray(value) && value.every((item): item is string => typeof item === 'string');

const isMessageArray = (value: RequestRecordValue): value is MessageLike[] =>
  Array.isArray(value) &&
  value.every(
    (item): item is MessageLike =>
      typeof item === 'object' && item !== null && !Array.isArray(item),
  );

const serializeRequestRecordValue = (value: RequestRecordValue): LogValue => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;

  if (isStringArray(value)) return [...value];

  if (isMessageArray(value)) return value.map((message) => serializeMessage(message));

  return null;
};

const serializeRequestRecord = (record: RequestRecord): LogObject => {
  const result: LogObject = {};

  for (const [key, value] of Object.entries(record))
    result[key] = serializeRequestRecordValue(value);

  return result;
};

const isMessagesRequestLike = (request: RequestLike): request is MessagesRequestLike =>
  typeof request === 'object' && !Array.isArray(request) && 'messages' in request;

const isMessageLike = (request: RequestLike): request is MessageLike =>
  typeof request === 'object' &&
  !Array.isArray(request) &&
  !('messages' in request) &&
  ('role' in request || 'content' in request);

const summarizeRequestLike = (request: RequestLike | undefined): LogObject => {
  if (request === undefined) return { requestPresent: false };

  if (typeof request === 'string') return { requestPresent: true, requestType: 'string' };

  if (isMessagesRequestLike(request))
    return {
      requestPresent: true,
      requestType: 'messages_request',
      messageCount: request.messages?.length ?? 0,
    };

  if (isMessageLike(request)) return { requestPresent: true, requestType: 'message' };

  return { requestPresent: true, requestType: 'record', fieldCount: Object.keys(request).length };
};

const serializeRequestLike = (request: RequestLike | undefined): LogObject => {
  if (request === undefined) return { requestPresent: false };

  if (typeof request === 'string')
    return { requestPresent: true, requestType: 'string', content: request };

  if (isMessagesRequestLike(request))
    return {
      requestPresent: true,
      requestType: 'messages_request',
      messages: (request.messages ?? []).map((message) => serializeMessage(message)),
    };

  if (isMessageLike(request))
    return { requestPresent: true, requestType: 'message', message: serializeMessage(request) };

  return { requestPresent: true, requestType: 'record', fields: serializeRequestRecord(request) };
};

const serializePreflight = (preflight: PreflightEstimate): LogObject => {
  const result: LogObject = {
    providerId: preflight.providerId,
    model: preflight.model,
    estimatedInputTokens: preflight.estimatedInputTokens,
    estimatedInputCostUsd: preflight.estimatedInputCostUsd,
    pricing: {
      inputCostPerMillionTokens: preflight.pricing.inputCostPerMillionTokens,
      outputCostPerMillionTokens: preflight.pricing.outputCostPerMillionTokens,
      currency: preflight.pricing.currency,
    },
  };

  if (preflight.estimatedWorstCaseCostUsd !== undefined)
    result.estimatedWorstCaseCostUsd = preflight.estimatedWorstCaseCostUsd;

  if (preflight.breakdown !== undefined)
    result.breakdown = {
      parts: preflight.breakdown.parts.map((part) => ({
        key: part.key,
        estimatedTokens: part.estimatedTokens,
        estimatedInputCostUsd: part.estimatedInputCostUsd,
      })),
      attributedEstimatedTokens: preflight.breakdown.attributedEstimatedTokens,
      attributedEstimatedInputCostUsd: preflight.breakdown.attributedEstimatedInputCostUsd,
      totalEstimatedInputTokens: preflight.breakdown.totalEstimatedInputTokens,
      unattributedEstimatedTokens: preflight.breakdown.unattributedEstimatedTokens,
      unattributedEstimatedInputCostUsd: preflight.breakdown.unattributedEstimatedInputCostUsd,
    };

  return result;
};

const serializeDecision = (decision: GuardDecision): LogObject => {
  const result: LogObject = {
    allowed: decision.allowed,
    blocked: decision.blocked,
    action: decision.action,
    checkedPolicies: [...decision.checkedPolicies],
  };

  if (decision.reasonCode !== undefined) result.reasonCode = decision.reasonCode;

  if (decision.reasonMessage !== undefined) result.reasonMessage = decision.reasonMessage;

  return result;
};

const serializeViolation = (violation: GuardViolation): LogObject => {
  if (violation.type === 'request-budget')
    return {
      type: violation.type,
      limitType: violation.limitType,
      configuredLimitUsd: violation.configuredLimitUsd,
      actualCostUsd: violation.actualCostUsd,
    };

  if (violation.type === 'aggregate-budget')
    return {
      type: violation.type,
      scope: violation.scope,
      window: violation.window,
      configuredLimitUsd: violation.configuredLimitUsd,
      currentSpendUsd: violation.currentSpendUsd,
      estimatedRequestCostUsd: violation.estimatedRequestCostUsd,
      projectedSpendUsd: violation.projectedSpendUsd,
    };

  return {
    type: violation.type,
    scope: violation.scope,
    window: violation.window,
    configuredLimit: violation.configuredLimit,
    currentCount: violation.currentCount,
    retryAfterSeconds: violation.retryAfterSeconds,
  };
};

const serializeAppliedDowngrade = (appliedDowngrade: AppliedDowngrade): LogObject => {
  const result: LogObject = {
    reason: appliedDowngrade.reason,
    originalProviderId: appliedDowngrade.originalProviderId,
    effectiveProviderId: appliedDowngrade.effectiveProviderId,
    originalModel: appliedDowngrade.originalModel,
    effectiveModel: appliedDowngrade.effectiveModel,
  };

  if (appliedDowngrade.originalMaxTokens !== undefined)
    result.originalMaxTokens = appliedDowngrade.originalMaxTokens;

  if (appliedDowngrade.effectiveMaxTokens !== undefined)
    result.effectiveMaxTokens = appliedDowngrade.effectiveMaxTokens;

  return result;
};

const serializeActualUsage = (actualUsage: ActualUsage): LogObject => ({
  inputTokens: actualUsage.inputTokens,
  outputTokens: actualUsage.outputTokens,
  totalTokens: actualUsage.totalTokens,
  actualInputCostUsd: actualUsage.actualInputCostUsd,
  actualOutputCostUsd: actualUsage.actualOutputCostUsd,
  actualTotalCostUsd: actualUsage.actualTotalCostUsd,
  deltaFromEstimatedInputCostUsd: actualUsage.deltaFromEstimatedInputCostUsd,
  deltaFromEstimatedWorstCaseCostUsd: actualUsage.deltaFromEstimatedWorstCaseCostUsd,
});

const serializeCostSpikeDriver = (driver: CostSpikeDriver): LogObject => {
  const result: LogObject = {
    key: driver.key,
    label: driver.label,
    kind: driver.kind,
    currentValue: driver.currentValue,
    baselineValue: driver.baselineValue,
    delta: driver.delta,
  };

  if (driver.ratio !== undefined) result.ratio = driver.ratio;

  return result;
};

const serializeCostSpikeExplanation = (explanation: CostSpikeExplanation): LogObject => {
  const result: LogObject = {
    detected: explanation.detected,
    sampleCount: explanation.sampleCount,
    currentActualTotalCostUsd: explanation.currentActualTotalCostUsd,
    baselineMedianActualTotalCostUsd: explanation.baselineMedianActualTotalCostUsd,
    p90ActualTotalCostUsd: explanation.p90ActualTotalCostUsd,
    deltaUsd: explanation.deltaUsd,
    topDrivers: explanation.topDrivers.map((driver) => serializeCostSpikeDriver(driver)),
  };

  if (explanation.multiplier !== undefined) result.multiplier = explanation.multiplier;

  return result;
};

const serializeUsageRecord = (
  usageRecord: UsageRecord,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result: LogObject = {
    id: usageRecord.id,
    runId: usageRecord.runId,
    timestamp: usageRecord.timestamp,
    projectId: usageRecord.projectId,
    providerId: usageRecord.providerId,
    model: usageRecord.model,
    executed: usageRecord.executed,
    blocked: usageRecord.blocked,
    decision: serializeDecision(usageRecord.decision),
    preflight: serializePreflight(usageRecord.preflight),
  };

  if (usageRecord.userId !== undefined) result.userId = usageRecord.userId;

  if (usageRecord.feature !== undefined) result.feature = usageRecord.feature;

  if (usageRecord.endpoint !== undefined) result.endpoint = usageRecord.endpoint;

  if (options.includeTags && usageRecord.tags.length > 0) result.tags = [...usageRecord.tags];

  if (options.includeMetadata && Object.keys(usageRecord.metadata).length > 0)
    result.metadata = serializeMetadata(usageRecord.metadata);

  if (usageRecord.actualUsage !== undefined && options.includeActualUsage)
    result.actualUsage = serializeActualUsage(usageRecord.actualUsage);

  if (usageRecord.violation !== undefined)
    result.violation = serializeViolation(usageRecord.violation);

  if (usageRecord.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(usageRecord.appliedDowngrade);

  return result;
};

const serializeEffectiveConfig = (
  effectiveConfig: EffectiveRunConfig,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result: LogObject = {
    mode: effectiveConfig.mode,
    projectId: effectiveConfig.project.projectId,
    providerId: effectiveConfig.provider.providerId,
    providerType: effectiveConfig.provider.providerType,
  };

  if (effectiveConfig.project.defaultProviderId !== undefined)
    result.defaultProviderId = effectiveConfig.project.defaultProviderId;

  if (effectiveConfig.provider.pricingRef !== undefined)
    result.pricingRef = effectiveConfig.provider.pricingRef;

  if (options.includeTags && effectiveConfig.request.tags.length > 0)
    result.requestTags = [...effectiveConfig.request.tags];

  if (options.includeMetadata && Object.keys(effectiveConfig.request.metadata).length > 0)
    result.requestMetadata = serializeMetadata(effectiveConfig.request.metadata);

  return result;
};

const createBasePayload = (
  event: HookEventBase,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result: LogObject = {
    runId: event.runId,
    timestamp: event.timestamp,
    projectId: event.context.project.id,
    providerId: event.context.provider.id,
    model: event.context.provider.model,
  };

  if (event.context.provider.maxTokens !== undefined)
    result.maxTokens = event.context.provider.maxTokens;

  if (event.context.user?.id !== undefined) result.userId = event.context.user.id;

  if (event.context.attribution.feature !== undefined)
    result.feature = event.context.attribution.feature;

  if (event.context.attribution.endpoint !== undefined)
    result.endpoint = event.context.attribution.endpoint;

  if (options.includeTags && event.context.attribution.tags.length > 0)
    result.tags = [...event.context.attribution.tags];

  if (options.includeMetadata && Object.keys(event.context.metadata).length > 0)
    result.metadata = serializeMetadata(event.context.metadata);

  return result;
};

export const serializeRunStartEvent = (
  event: RunStartEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.request = options.includeRequestContent
    ? serializeRequestLike(event.rawContext.request)
    : summarizeRequestLike(event.rawContext.request);

  return result;
};

export const serializePreflightBuiltEvent = (
  event: PreflightBuiltEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  return result;
};

export const serializePolicyEvaluatedEvent = (
  event: PolicyEvaluatedEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (event.violation !== undefined) result.violation = serializeViolation(event.violation);

  if (event.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  return result;
};

export const serializeRequestBlockedEvent = (
  event: RequestBlockedEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (event.violation !== undefined) result.violation = serializeViolation(event.violation);

  if (event.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  return result;
};

export const serializeRequestDowngradedEvent = (
  event: RequestDowngradedEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);
  result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  return result;
};

export const serializeExecuteSuccessEvent = (
  event: ExecuteSuccessEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (event.actualUsage !== undefined && options.includeActualUsage)
    result.actualUsage = serializeActualUsage(event.actualUsage);

  if (event.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  if (event.costSpikeExplanation !== undefined && options.includeCostSpikeExplanation)
    result.costSpikeExplanation = serializeCostSpikeExplanation(event.costSpikeExplanation);

  return result;
};

export const serializeExecuteErrorEvent = (
  event: ExecuteErrorEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);
  result.error = { name: event.error.name, message: event.error.message };

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (event.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  return result;
};

export const serializeUsageRecordedEvent = (
  event: UsageRecordedEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (event.actualUsage !== undefined && options.includeActualUsage)
    result.actualUsage = serializeActualUsage(event.actualUsage);

  if (event.violation !== undefined) result.violation = serializeViolation(event.violation);

  if (event.appliedDowngrade !== undefined)
    result.appliedDowngrade = serializeAppliedDowngrade(event.appliedDowngrade);

  if (options.includeUsageRecord)
    result.usageRecord = serializeUsageRecord(event.usageRecord, options);

  return result;
};

export const serializeCostSpikeDetectedEvent = (
  event: CostSpikeDetectedEvent,
  options: NormalizedLoggerHookOptions,
): LogObject => {
  const result = createBasePayload(event, options);

  result.decision = serializeDecision(event.decision);
  result.effectiveConfig = serializeEffectiveConfig(event.effectiveConfig, options);

  if (options.includePreflight) result.preflight = serializePreflight(event.preflight);

  if (options.includeActualUsage) result.actualUsage = serializeActualUsage(event.actualUsage);

  if (options.includeCostSpikeExplanation)
    result.costSpikeExplanation = serializeCostSpikeExplanation(event.costSpikeExplanation);

  return result;
};
