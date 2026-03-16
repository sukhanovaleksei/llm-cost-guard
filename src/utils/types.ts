export type Nullable<T> = T | null | undefined;

export type MetadataPrimitive = string | number | boolean;
export type MetadataInput = Record<string, Nullable<MetadataPrimitive>>;
export type Metadata = Record<string, MetadataPrimitive>;
