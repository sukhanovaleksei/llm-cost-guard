import { GuardError } from './GuardError.js';

export class InvalidMaxTokensError extends GuardError {
  constructor() {
    super('INVALID_MAX_TOKENS', 'provider.maxTokens must be a positive integer');
  }
}
