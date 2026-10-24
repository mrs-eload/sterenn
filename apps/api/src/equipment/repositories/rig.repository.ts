import type { Rig } from '../entities/rig.entity.js';

// Saves and loads a Rig with its chain items and filters (cascade). A rig
// refers to equipment by id and never modifies it.
export abstract class RigRepository {
  abstract save(rig: Rig): Promise<Rig>;
  abstract findById(id: string): Promise<Rig | null>;
  abstract listByOwner(owner_id: string): Promise<Rig[]>;
  // Returns false when there was no such row.
  abstract delete(id: string): Promise<boolean>;
}
