import { GuardError } from './GuardError.js';

export class MissingPricingEntryError extends GuardError {
  public constructor(providerId: string, model: string) {
    super(
      'MISSING_PRICING_ENTRY',
      `No pricing entry found for provider "${providerId}" and model "${model}".`,
    );
    this.name = 'MissingPricingEntryError';
  }
}
