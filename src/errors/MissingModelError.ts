import { GuardError } from './GuardError.js';

export class MissingModelError extends GuardError {
  public constructor() {
    super('MISSING_MODEL', 'Model is required. Provide context.model.');
    this.name = 'MissingModelError';
  }
}
