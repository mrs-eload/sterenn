import { z } from 'zod';
import {
  EquipmentType,
  FilterType,
  HolderType,
  MountType,
  OpticalDesign,
  SensorColor,
  ThreadGender,
  ThreadPosition,
} from '../enums/index.js';
import {
  optional_long_text,
  optional_positive_decimal,
  optional_positive_integer,
  optional_short_text,
  positive_decimal,
  positive_integer,
  short_text,
} from './fields.js';

export const equipment_thread_input_schema = z.object({
  thread_size_id: z.uuid(),
  gender: z.enum(ThreadGender),
  position: z.enum(ThreadPosition),
  notes: optional_long_text,
});

const common_fields = {
  manufacturer: short_text,
  model: short_text,
  weight_g: optional_positive_integer,
  notes: optional_long_text,
  threads: z.array(equipment_thread_input_schema).default([]),
};

export const mount_specs_schema = z.object({
  mount_type: z.enum(MountType),
  goto: z.boolean(),
  payload_capacity_g: optional_positive_integer,
  goto_precision: optional_short_text,
});

export const telescope_specs_schema = z.object({
  optical_design: z.enum(OpticalDesign),
  aperture_mm: positive_decimal,
  focal_length_mm: positive_decimal,
  backfocus_min_mm: optional_positive_decimal,
  backfocus_max_mm: optional_positive_decimal,
  backfocus_recommended_mm: optional_positive_decimal,
  tube_length_mm: optional_positive_decimal,
});

export const camera_specs_schema = z.object({
  pixel_size_um: positive_decimal,
  resolution_x: positive_integer,
  resolution_y: positive_integer,
  sensor_color: z.enum(SensorColor),
  // The sensor part, e.g. "Sony IMX585".
  sensor_chip: optional_short_text,
  cooled: z.boolean().nullable().default(null),
  read_noise_e: optional_positive_decimal,
  full_well_e: optional_positive_integer,
  // Gain 0 is a real setting, so this one allows zero.
  measured_at_gain: z.number().int().nonnegative().nullable().default(null),
});

export const filter_holder_specs_schema = z.object({
  holder_type: z.enum(HolderType),
  positions: positive_integer,
  accepts_disc_diameter_mm: optional_positive_decimal,
});

export const passband_schema = z.object({
  center_nm: positive_decimal,
  bandwidth_nm: positive_decimal,
});

export const filter_specs_schema = z.object({
  filter_type: z.enum(FilterType),
  disc_diameter_mm: optional_positive_decimal,
  passbands: z.array(passband_schema).nullable().default(null),
});

export const corrector_specs_schema = z.object({
  focal_multiplier: positive_decimal,
});

// The allowed `specs` depend on `type`. An adapter has no specs table, so it
// has no `specs` key.
export const equipment_input_schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal(EquipmentType.MOUNT), ...common_fields, specs: mount_specs_schema }),
  z.object({ type: z.literal(EquipmentType.TELESCOPE), ...common_fields, specs: telescope_specs_schema }),
  z.object({ type: z.literal(EquipmentType.CAMERA), ...common_fields, specs: camera_specs_schema }),
  z.object({ type: z.literal(EquipmentType.FILTER_HOLDER), ...common_fields, specs: filter_holder_specs_schema }),
  z.object({ type: z.literal(EquipmentType.FILTER), ...common_fields, specs: filter_specs_schema }),
  z.object({ type: z.literal(EquipmentType.CORRECTOR), ...common_fields, specs: corrector_specs_schema }),
  z.object({ type: z.literal(EquipmentType.ADAPTER), ...common_fields }),
]);

export const equipment_list_query_schema = z.object({
  type: z.enum(EquipmentType).optional(),
  thread_size_id: z.uuid().optional(),
});

export type EquipmentThreadInput = z.infer<typeof equipment_thread_input_schema>;
export type MountSpecs = z.infer<typeof mount_specs_schema>;
export type TelescopeSpecs = z.infer<typeof telescope_specs_schema>;
export type CameraSpecs = z.infer<typeof camera_specs_schema>;
export type FilterHolderSpecs = z.infer<typeof filter_holder_specs_schema>;
export type Passband = z.infer<typeof passband_schema>;
export type FilterSpecs = z.infer<typeof filter_specs_schema>;
export type CorrectorSpecs = z.infer<typeof corrector_specs_schema>;
export type EquipmentInput = z.infer<typeof equipment_input_schema>;
export type EquipmentListQuery = z.infer<typeof equipment_list_query_schema>;
