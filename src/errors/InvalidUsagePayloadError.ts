import { GuardError } from './GuardError.js';

export class InvalidUsagePayloadError extends GuardError {
  public constructor(message: string) {
    super('INVALID_USAGE_PAYLOAD', message);
    this.name = 'InvalidUsagePayloadError';
  }
}
