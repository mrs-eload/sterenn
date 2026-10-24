import { EquipmentType } from '../enums/equipment-type.js';
import type { ThreadGender } from '../enums/thread-gender.js';
import { ThreadPosition } from '../enums/thread-position.js';

// The rig rules of ADR 0004 section 10, written once. The API's RigValidator
// runs them before saving; the web runs them live while a rig is edited, so
// both always agree.

export type RigPartThread = {
  thread_size_id: string;
  gender: ThreadGender;
  position: ThreadPosition;
};

// What the rules need to know about one piece of equipment. Each side adapts
// its own shape (entity or API response) to this.
export type RigPart = {
  id: string;
  type: EquipmentType;
  manufacturer: string;
  model: string;
  threads: RigPartThread[];
  // filter_holder only.
  positions: number | null;
  accepts_disc_diameter_mm: number | null;
  // filter only.
  disc_diameter_mm: number | null;
};

export type RigDraft = {
  mount_id: string | null;
  guide_telescope_id: string | null;
  guide_camera_id: string | null;
  // Equipment ids in optical order.
  chain: string[];
  filters: { filter_id: string; holder_id: string | null }[];
};

// Errors block a save. Warnings (rule b) are reported but do not.
export type RigProblems = {
  errors: string[];
  warnings: string[];
};

export type RigCheck = RigProblems & {
  // One entry per pair of neighbouring chain items (chain order, existing
  // items only): the thread size they share, or null when they share none.
  links: (string | null)[];
};

function label(part: RigPart): string {
  return `${part.manufacturer} ${part.model}`;
}

// Rule b literally: any thread of one with any thread of the other, same size,
// opposite gender.
export function matingThreadSize(threads_a: RigPartThread[], threads_b: RigPartThread[]): string | null {
  for (const thread_a of threads_a) {
    for (const thread_b of threads_b) {
      if (thread_a.thread_size_id === thread_b.thread_size_id && thread_a.gender !== thread_b.gender) {
        return thread_a.thread_size_id;
      }
    }
  }
  return null;
}

// c. The holder's inside thread mates with the filter's thread, or the holder
// accepts the filter's disc diameter.
export function filterFitsHolder(filter: RigPart, holder: RigPart): boolean {
  const inside_threads = holder.threads.filter((thread) => thread.position === ThreadPosition.INSIDE);
  if (matingThreadSize(inside_threads, filter.threads) !== null) {
    return true;
  }
  return (
    holder.accepts_disc_diameter_mm !== null &&
    filter.disc_diameter_mm !== null &&
    holder.accepts_disc_diameter_mm === filter.disc_diameter_mm
  );
}

function checkRole(
  id: string | null,
  expected_type: EquipmentType,
  role: string,
  parts: ReadonlyMap<string, RigPart>,
  errors: string[],
  is_required: boolean,
): void {
  if (id === null) {
    if (is_required) {
      errors.push(`The rig has no ${role}`);
    }
    return;
  }
  const part = parts.get(id);
  if (!part) {
    errors.push(`The ${role} ${id} does not exist`);
  } else if (part.type !== expected_type) {
    errors.push(`${label(part)} cannot be the ${role}: it is a ${part.type}`);
  }
}

// Pure: the caller passes every referenced part in `parts`, keyed by id. An id
// missing from it no longer exists.
export function validateRig(rig: RigDraft, parts: ReadonlyMap<string, RigPart>): RigCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const links: (string | null)[] = [];

  checkRole(rig.mount_id, EquipmentType.MOUNT, 'mount', parts, errors, true);
  checkRole(rig.guide_telescope_id, EquipmentType.TELESCOPE, 'guide telescope', parts, errors, false);
  checkRole(rig.guide_camera_id, EquipmentType.CAMERA, 'guide camera', parts, errors, false);

  const chain: RigPart[] = [];
  for (const id of rig.chain) {
    const item = parts.get(id);
    if (item) {
      chain.push(item);
    } else {
      errors.push(`Chain item ${id} does not exist`);
    }
  }

  // a. Exactly one telescope, first; exactly one camera, last.
  const telescope_count = chain.filter((item) => item.type === EquipmentType.TELESCOPE).length;
  const camera_count = chain.filter((item) => item.type === EquipmentType.CAMERA).length;
  if (chain.length === 0 || chain[0].type !== EquipmentType.TELESCOPE || telescope_count !== 1) {
    errors.push('The chain must start with exactly one telescope');
  }
  if (chain.length === 0 || chain[chain.length - 1].type !== EquipmentType.CAMERA || camera_count !== 1) {
    errors.push('The chain must end with exactly one camera');
  }

  // b. Neighbours share a thread size with opposite genders. Warning only.
  for (let index = 1; index < chain.length; index++) {
    const previous = chain[index - 1];
    const current = chain[index];
    const shared_size = matingThreadSize(previous.threads, current.threads);
    links.push(shared_size);
    if (shared_size === null) {
      warnings.push(`${label(previous)} and ${label(current)} have no matching thread`);
    }
  }

  const chain_ids = new Set(rig.chain);
  const filter_count_by_holder = new Map<string, number>();

  for (const rig_filter of rig.filters) {
    const filter = parts.get(rig_filter.filter_id);
    if (!filter) {
      errors.push(`Filter ${rig_filter.filter_id} does not exist`);
      continue;
    }
    if (filter.type !== EquipmentType.FILTER) {
      errors.push(`${label(filter)} is not a filter`);
      continue;
    }
    if (rig_filter.holder_id === null) {
      continue;
    }
    const holder = parts.get(rig_filter.holder_id);
    if (!holder) {
      errors.push(`Holder ${rig_filter.holder_id} does not exist`);
      continue;
    }
    if (!chain_ids.has(holder.id)) {
      errors.push(`${label(holder)} holds ${label(filter)} but is not in the chain`);
      continue;
    }
    filter_count_by_holder.set(holder.id, (filter_count_by_holder.get(holder.id) ?? 0) + 1);
    if (!filterFitsHolder(filter, holder)) {
      errors.push(`${label(filter)} does not fit ${label(holder)}`);
    }
  }

  // d. No more filters than the holder has positions.
  for (const [holder_id, count] of filter_count_by_holder) {
    const holder = parts.get(holder_id);
    if (holder && holder.positions !== null && count > holder.positions) {
      errors.push(`${label(holder)} has ${holder.positions} positions but holds ${count} filters`);
    }
  }

  return { errors, warnings, links };
}
