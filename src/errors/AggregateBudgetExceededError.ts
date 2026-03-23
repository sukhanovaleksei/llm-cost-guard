import type { AggregateBudgetScope, AggregateBudgetWindow } from '../types/run.js';
import { GuardError } from './GuardError.js';

export interface AggregateBudgetExceededErrorDetails {
  providerId: string;
  model: string;
  scope: AggregateBudgetScope;
  window: AggregateBudgetWindow;
  configuredLimitUsd: number;
  currentSpendUsd: number;
  estimatedRequestCostUsd: number;
  projectedSpendUsd: number;
}

export class AggregateBudgetExceededError extends GuardError {
  public readonly providerId: string;
  public readonly model: string;
  public readonly scope: AggregateBudgetScope;
  public readonly window: AggregateBudgetWindow;
  public readonly configuredLimitUsd: number;
  public readonly currentSpendUsd: number;
  public readonly estimatedRequestCostUsd: number;
  public readonly projectedSpendUsd: number;

  public constructor(details: AggregateBudgetExceededErrorDetails) {
    const message = [
      'Aggregate budget exceeded:',
      `projected ${details.scope} ${details.window} spend ${details.projectedSpendUsd.toFixed(6)} USD`,
      `exceeds configured limit ${details.configuredLimitUsd.toFixed(6)} USD`,
      `for provider "${details.providerId}" and model "${details.model}".`,
    ].join(' ');

    super('AGGREGATE_BUDGET_EXCEEDED', message);

    this.name = 'AggregateBudgetExceededError';
    this.providerId = details.providerId;
    this.model = details.model;
    this.scope = details.scope;
    this.window = details.window;
    this.configuredLimitUsd = details.configuredLimitUsd;
    this.currentSpendUsd = details.currentSpendUsd;
    this.estimatedRequestCostUsd = details.estimatedRequestCostUsd;
    this.projectedSpendUsd = details.projectedSpendUsd;
  }
}
