import { GuardError } from './GuardError.js';

export interface RateLimitedErrorDetails {
  providerId: string;
  model: string;
  scope: 'global' | 'user' | 'project' | 'provider';
  configuredLimit: number;
  currentCount: number;
  retryAfterSeconds: number;
}

export class RateLimitedError extends GuardError {
  public readonly providerId: string;
  public readonly model: string;
  public readonly scope: 'global' | 'user' | 'project' | 'provider';
  public readonly configuredLimit: number;
  public readonly currentCount: number;
  public readonly retryAfterSeconds: number;

  public constructor(details: RateLimitedErrorDetails) {
    const message = [
      'Rate limit exceeded:',
      `${details.scope} requests per minute ${details.currentCount}/${details.configuredLimit}`,
      `for provider "${details.providerId}" and model "${details.model}".`,
      `Retry after ${details.retryAfterSeconds} seconds.`,
    ].join(' ');

    super('RATE_LIMITED', message);

    this.name = 'RateLimitedError';
    this.providerId = details.providerId;
    this.model = details.model;
    this.scope = details.scope;
    this.configuredLimit = details.configuredLimit;
    this.currentCount = details.currentCount;
    this.retryAfterSeconds = details.retryAfterSeconds;
  }
}
