export const normalizeNonEmptyString = (value: string | undefined | null): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  return trimmed;
}