import { z } from 'zod';

// Column limits from ADR 0004 section 12: numeric(10,3) and varchar(255).
// Optional columns default to null so a PUT that omits one clears it, which
// is what "replace the whole item" means.

export const short_text = z.string().trim().min(1).max(255);
export const optional_short_text = short_text.nullable().default(null);
export const optional_long_text = z.string().nullable().default(null);

export const positive_decimal = z.number().positive().max(9_999_999.999);
export const optional_positive_decimal = positive_decimal.nullable().default(null);

export const positive_integer = z.number().int().positive();
export const optional_positive_integer = positive_integer.nullable().default(null);
