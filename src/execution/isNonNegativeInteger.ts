export const isNonNegativeInteger = (value: number): boolean => {
  return Number.isInteger(value) && value >= 0;
};
