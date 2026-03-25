export const isPositiveNumber = (value: number | undefined): boolean => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

export const isPositiveInteger = (value: number | undefined): boolean => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

export const resolvePositiveInteger = (value: number | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;

  return fallback;
};

export const resolvePositiveNumber = (value: number | undefined, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;

  return fallback;
};

export const resolveNonEmptyString = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

export const isNonNegativeInteger = (value: number): boolean => {
  return Number.isInteger(value) && value >= 0;
};
