import { z } from 'zod';
import { optional_short_text, positive_decimal } from './fields.js';

export const thread_size_input_schema = z.object({
  diameter_mm: positive_decimal,
  pitch_mm: positive_decimal,
  name: optional_short_text,
});

export type ThreadSizeInput = z.infer<typeof thread_size_input_schema>;
