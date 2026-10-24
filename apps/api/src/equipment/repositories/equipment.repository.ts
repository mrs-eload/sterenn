import type { EquipmentListQuery } from '@sterenn/shared';
import type { Equipment } from '../entities/equipment.entity';

// Saves and loads an Equipment with its specs row and threads (cascade).
export abstract class EquipmentRepository {
  abstract save(equipment: Equipment): Promise<Equipment>;
  abstract findById(id: string): Promise<Equipment | null>;
  abstract findByIds(ids: string[]): Promise<Equipment[]>;
  // Filters are applied in the database query, not in memory.
  abstract list(filters: EquipmentListQuery): Promise<Equipment[]>;
  // Returns false when there was no such row.
  abstract delete(id: string): Promise<boolean>;
}
