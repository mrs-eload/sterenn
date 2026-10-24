import { Injectable } from '@nestjs/common';
import { type RigDraft, type RigPart, type RigProblems, validateRig } from '@sterenn/shared';
import type { Equipment } from '../entities/equipment.entity.js';

export type { RigDraft, RigProblems };

function toRigPart(equipment: Equipment): RigPart {
  return {
    id: equipment.id,
    type: equipment.type,
    manufacturer: equipment.manufacturer,
    model: equipment.model,
    threads: equipment.threads ?? [],
    positions: equipment.filter_holder?.positions ?? null,
    accepts_disc_diameter_mm: equipment.filter_holder?.accepts_disc_diameter_mm ?? null,
    disc_diameter_mm: equipment.filter?.disc_diameter_mm ?? null,
  };
}

// ADR 0004 section 10. The rules themselves live in @sterenn/shared so the web
// editor runs exactly the same checks live; this class adapts entities to them.
@Injectable()
export class RigValidator {
  validate(rig: RigDraft, parts: ReadonlyMap<string, Equipment>): RigProblems {
    const rig_parts = new Map([...parts].map(([id, equipment]) => [id, toRigPart(equipment)]));
    const { errors, warnings } = validateRig(rig, rig_parts);
    return { errors, warnings };
  }
}
