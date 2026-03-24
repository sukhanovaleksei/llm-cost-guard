import { GuardError } from './GuardError.js';

export class InvalidBreakdownPartError extends GuardError {
  public constructor(partIndex: number, message: string) {
    super('INVALID_BREAKDOWN_PART', `breakdown.parts[${partIndex}] ${message}`);
    this.name = 'InvalidBreakdownPartError';
  }
}
