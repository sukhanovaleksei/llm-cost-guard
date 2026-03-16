import type { Metadata, MetadataInput, Nullable } from './types.js';

export const normalizeNonEmptyString = (value: Nullable<string>): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  return trimmed;
};

export const normalizeStringArray = (value: Nullable<readonly string[]>): string[] => {
  if (!Array.isArray(value)) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (typeof item !== 'string') continue;

    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) continue;

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
};

export const normalizeMetadata = (value: Nullable<MetadataInput>): Metadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Metadata = {};

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean')
      result[key] = raw;
  }

  return result;
};

export const normalizePositiveInteger = (value: Nullable<number>): number | undefined => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return undefined;

  return value;
};
