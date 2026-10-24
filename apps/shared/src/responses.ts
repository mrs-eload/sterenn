import type { ThreadGender } from './enums/thread-gender.js';
import type { ThreadPosition } from './enums/thread-position.js';
import type { RigProblems } from './rules/validate-rig.js';
import type { EquipmentInput } from './schemas/equipment.schema.js';
import type { RigFilterInput } from './schemas/rig.schema.js';

// Response bodies of the API (ADR 0004 section 12): the request shape plus
// ids and timestamps. Timestamps arrive as ISO strings once serialised.

export type UserResponse = {
  id: string;
  email: string;
};

export type ThreadSizeResponse = {
  id: string;
  diameter_mm: number;
  pitch_mm: number;
  name: string | null;
};

export type EquipmentThreadResponse = {
  id: string;
  thread_size_id: string;
  gender: ThreadGender;
  position: ThreadPosition;
  notes: string | null;
};

// Distributes over the union so each `type` keeps its own `specs` shape.
type WithResponseFields<T> = T extends unknown
  ? Omit<T, 'threads'> & {
      id: string;
      created_at: string;
      updated_at: string;
      threads: EquipmentThreadResponse[];
    }
  : never;

export type EquipmentResponse = WithResponseFields<EquipmentInput>;

export type RigResponse = {
  id: string;
  name: string;
  is_current: boolean;
  mount_id: string | null;
  guide_telescope_id: string | null;
  guide_camera_id: string | null;
  chain: string[];
  filters: RigFilterInput[];
  created_at: string;
  updated_at: string;
  // Recomputed by the API on every read.
  problems: RigProblems;
};
