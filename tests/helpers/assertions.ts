import type { GuardViolation, RequestBudgetViolation } from '../../src/types/run.js';

export const assertRequestBudgetViolation = (
  violation: GuardViolation | undefined,
): RequestBudgetViolation => {
  if (violation === undefined || violation.type !== 'request-budget')
    throw new Error('Expected request-budget violation');

  return violation;
};
