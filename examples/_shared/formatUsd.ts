export const formatUsd = (value: number | undefined): string => {
  if (value === undefined) return 'n/a';
  return `$${value.toFixed(6)}`;
};
