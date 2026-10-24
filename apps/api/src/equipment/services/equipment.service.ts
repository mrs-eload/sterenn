import { Injectable } from '@nestjs/common';
import { type EquipmentInput, type EquipmentListQuery, EquipmentType } from '@sterenn/shared';
import { NotFoundError, ValidationError } from '../../common/domain-errors';
import { EquipmentThread } from '../entities/equipment-thread.entity';
import { Equipment } from '../entities/equipment.entity';
import { Camera } from '../entities/specs/camera.entity';
import { Corrector } from '../entities/specs/corrector.entity';
import { FilterHolder } from '../entities/specs/filter-holder.entity';
import { Filter } from '../entities/specs/filter.entity';
import { Mount } from '../entities/specs/mount.entity';
import { Telescope } from '../entities/specs/telescope.entity';
import { EquipmentRepository } from '../repositories/equipment.repository';

// Writes the input onto the entity. An existing specs object is updated in
// place so TypeORM's cascade updates the row instead of inserting a duplicate.
function applyInput(equipment: Equipment, input: EquipmentInput): Equipment {
  equipment.type = input.type;
  equipment.manufacturer = input.manufacturer;
  equipment.model = input.model;
  equipment.weight_g = input.weight_g;
  equipment.notes = input.notes;

  const owner = { equipment_id: equipment.id };
  switch (input.type) {
    case EquipmentType.MOUNT:
      equipment.mount = Object.assign(equipment.mount ?? new Mount(), input.specs, owner);
      break;
    case EquipmentType.TELESCOPE:
      equipment.telescope = Object.assign(equipment.telescope ?? new Telescope(), input.specs, owner);
      break;
    case EquipmentType.CAMERA:
      equipment.camera = Object.assign(equipment.camera ?? new Camera(), input.specs, owner);
      break;
    case EquipmentType.FILTER_HOLDER:
      equipment.filter_holder = Object.assign(equipment.filter_holder ?? new FilterHolder(), input.specs, owner);
      break;
    case EquipmentType.FILTER:
      equipment.filter = Object.assign(equipment.filter ?? new Filter(), input.specs, owner);
      break;
    case EquipmentType.CORRECTOR:
      equipment.corrector = Object.assign(equipment.corrector ?? new Corrector(), input.specs, owner);
      break;
    case EquipmentType.ADAPTER:
      // An adapter is just an equipment row with threads; no specs table.
      break;
  }

  // PUT replaces the whole list. Rows no longer in it are deleted as orphans.
  equipment.threads = input.threads.map((thread_input) =>
    Object.assign(new EquipmentThread(), thread_input, { equipment_id: equipment.id }),
  );
  return equipment;
}

@Injectable()
export class EquipmentService {
  constructor(private readonly equipment_repository: EquipmentRepository) {}

  list(filters: EquipmentListQuery): Promise<Equipment[]> {
    return this.equipment_repository.list(filters);
  }

  async findById(id: string): Promise<Equipment> {
    const equipment = await this.equipment_repository.findById(id);
    if (!equipment) {
      throw new NotFoundError('Equipment', id);
    }
    return equipment;
  }

  create(input: EquipmentInput): Promise<Equipment> {
    return this.equipment_repository.save(applyInput(new Equipment(), input));
  }

  async update(id: string, input: EquipmentInput): Promise<Equipment> {
    const equipment = await this.findById(id);
    // The type decides which specs table holds the row, so it is fixed once created.
    if (equipment.type !== input.type) {
      throw new ValidationError([`Equipment type cannot change (is ${equipment.type}, got ${input.type})`]);
    }
    await this.equipment_repository.save(applyInput(equipment, input));
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    if (!(await this.equipment_repository.delete(id))) {
      throw new NotFoundError('Equipment', id);
    }
  }
}
