import { GuardError } from './GuardError.js';

export interface RequestBudgetExceededErrorDetails {
  providerId: string;
  model: string;
  limitType: 'input' | 'worst-case';
  configuredLimitUsd: number;
  actualCostUsd: number;
  estimatedInputCostUsd: number;
  estimatedWorstCaseCostUsd: number;
}

export class RequestBudgetExceededError extends GuardError {
  public readonly providerId: string;
  public readonly model: string;
  public readonly limitType: 'input' | 'worst-case';
  public readonly configuredLimitUsd: number;
  public readonly actualCostUsd: number;
  public readonly estimatedInputCostUsd: number;
  public readonly estimatedWorstCaseCostUsd: number;

  public constructor(details: RequestBudgetExceededErrorDetails) {
    const message = [
      'Request budget exceeded:',
      `${details.limitType} estimated cost ${details.actualCostUsd.toFixed(6)} USD`,
      `exceeds configured limit ${details.configuredLimitUsd.toFixed(6)} USD`,
      `for provider "${details.providerId}" and model "${details.model}".`,
    ].join(' ');

    super('REQUEST_BUDGET_EXCEEDED', message);

    this.name = 'RequestBudgetExceededError';
    this.providerId = details.providerId;
    this.model = details.model;
    this.limitType = details.limitType;
    this.configuredLimitUsd = details.configuredLimitUsd;
    this.actualCostUsd = details.actualCostUsd;
    this.estimatedInputCostUsd = details.estimatedInputCostUsd;
    this.estimatedWorstCaseCostUsd = details.estimatedWorstCaseCostUsd;
  }
}
