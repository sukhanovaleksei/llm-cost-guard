export const sortAscending = (values: number[]): number[] => {
  return [...values].sort((left, right) => left - right);
};

export const getPercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;

  const sorted = sortAscending(values);
  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];

  if (lowerValue === undefined || upperValue === undefined) return 0;
  if (lowerIndex === upperIndex) return lowerValue;

  const weight = position - lowerIndex;
  return lowerValue * (1 - weight) + upperValue * weight;
};

export const getMedian = (values: number[]): number => {
  return getPercentile(values, 0.5);
};
