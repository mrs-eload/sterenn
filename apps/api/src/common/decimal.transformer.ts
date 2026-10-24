import type { ColumnOptions, ValueTransformer } from 'typeorm';

// PostgreSQL returns numeric columns as strings so no precision is lost.
// numeric(10,3) always fits in a JS number, so converting back is safe.
export const decimal_transformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

// Every decimal column uses the precision from ADR 0004 section 12.
export const decimal_column: ColumnOptions = {
  type: 'decimal',
  precision: 10,
  scale: 3,
  transformer: decimal_transformer,
};
