import { GuardError } from './GuardError.js';

export class InvalidAnthropicAdapterRequestError extends GuardError {
  public constructor(message: string) {
    super('INVALID_ANTHROPIC_ADAPTER_REQUEST', message);
    this.name = 'InvalidAnthropicAdapterRequestError';
  }
}
