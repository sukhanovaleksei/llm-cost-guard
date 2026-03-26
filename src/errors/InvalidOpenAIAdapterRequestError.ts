import { GuardError } from './GuardError.js';

export class InvalidOpenAIAdapterRequestError extends GuardError {
  public constructor(message: string) {
    super('INVALID_OPENAI_ADAPTER_REQUEST', message);
    this.name = 'InvalidOpenAIAdapterRequestError';
  }
}
