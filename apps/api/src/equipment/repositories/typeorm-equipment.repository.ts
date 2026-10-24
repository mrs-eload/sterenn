import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EquipmentListQuery } from '@sterenn/shared';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import { EquipmentThread } from '../entities/equipment-thread.entity.js';
import { Equipment } from '../entities/equipment.entity.js';
import { EquipmentRepository } from './equipment.repository.js';

const SPECS_RELATIONS = ['mount', 'telescope', 'camera', 'filter_holder', 'filter', 'corrector'] as const;

const FULL_RELATIONS = {
  mount: true,
  telescope: true,
  camera: true,
  filter_holder: true,
  filter: true,
  corrector: true,
  threads: true,
};

@Injectable()
export class TypeormEquipmentRepository extends EquipmentRepository {
  constructor(@InjectRepository(Equipment) private readonly repository: Repository<Equipment>) {
    super();
  }

  save(equipment: Equipment): Promise<Equipment> {
    return this.repository.save(equipment);
  }

  findById(id: string): Promise<Equipment | null> {
    return this.repository.findOne({ where: { id }, relations: FULL_RELATIONS });
  }

  findByIds(ids: string[]): Promise<Equipment[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.repository.find({ where: { id: In(ids) }, relations: FULL_RELATIONS });
  }

  list(filters: EquipmentListQuery): Promise<Equipment[]> {
    let query: SelectQueryBuilder<Equipment> = this.repository.createQueryBuilder('equipment');
    for (const relation of SPECS_RELATIONS) {
      query = query.leftJoinAndSelect(`equipment.${relation}`, relation);
    }
    query = query.leftJoinAndSelect('equipment.threads', 'thread');

    if (filters.type) {
      query = query.andWhere('equipment.type = :type', { type: filters.type });
    }
    if (filters.thread_size_id) {
      // EXISTS rather than filtering the joined threads, so a matching item
      // still comes back with all of its threads.
      query = query.andWhere(
        (outer) =>
          `EXISTS ${outer
            .subQuery()
            .select('1')
            .from(EquipmentThread, 'matching_thread')
            .where('matching_thread.equipment_id = equipment.id')
            .andWhere('matching_thread.thread_size_id = :thread_size_id')
            .getQuery()}`,
        { thread_size_id: filters.thread_size_id },
      );
    }

    return query.orderBy('equipment.manufacturer', 'ASC').addOrderBy('equipment.model', 'ASC').getMany();
  }

  async delete(id: string): Promise<boolean> {
    // Specs, threads and rig rows go with it through ON DELETE CASCADE.
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
