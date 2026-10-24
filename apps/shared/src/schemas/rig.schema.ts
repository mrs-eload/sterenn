import { z } from 'zod';
import { short_text } from './fields.js';

export const rig_filter_input_schema = z.object({
  filter_id: z.uuid(),
  holder_id: z.uuid().nullable().default(null),
});

export const rig_input_schema = z.object({
  name: short_text,
  is_current: z.boolean().default(false),
  mount_id: z.uuid(),
  guide_telescope_id: z.uuid().nullable().default(null),
  guide_camera_id: z.uuid().nullable().default(null),
  // Equipment ids in optical order, telescope first, camera last. The array
  // index becomes `sort_order`. The same id may appear twice (two identical
  // adapters), which is why the chain key is (rig_id, sort_order).
  chain: z.array(z.uuid()),
  // The table key is (rig_id, filter_id), so a filter appears at most once.
  filters: z
    .array(rig_filter_input_schema)
    .default([])
    .refine(
      (filters) => new Set(filters.map((filter) => filter.filter_id)).size === filters.length,
      { message: 'A filter can appear only once in a rig' },
    ),
});

export type RigFilterInput = z.infer<typeof rig_filter_input_schema>;
export type RigInput = z.infer<typeof rig_input_schema>;
