export interface BudgetWindow {
  from: string;
  to: string;
}

export const buildUtcDailyWindow = (now: Date): BudgetWindow => {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  return { from: from.toISOString(), to: to.toISOString() };
};

export const buildUtcMonthlyWindow = (now: Date): BudgetWindow => {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return { from: from.toISOString(), to: to.toISOString() };
};
