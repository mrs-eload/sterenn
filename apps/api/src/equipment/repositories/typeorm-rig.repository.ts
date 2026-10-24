import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rig } from '../entities/rig.entity';
import { RigRepository } from './rig.repository';

const RIG_RELATIONS = { chain_items: true, filters: true };

@Injectable()
export class TypeormRigRepository extends RigRepository {
  constructor(@InjectRepository(Rig) private readonly repository: Repository<Rig>) {
    super();
  }

  save(rig: Rig): Promise<Rig> {
    return this.repository.save(rig);
  }

  findById(id: string): Promise<Rig | null> {
    return this.repository.findOne({
      where: { id },
      relations: RIG_RELATIONS,
      order: { chain_items: { sort_order: 'ASC' } },
    });
  }

  listByOwner(owner_id: string): Promise<Rig[]> {
    return this.repository.find({
      where: { owner_id },
      relations: RIG_RELATIONS,
      order: { name: 'ASC', chain_items: { sort_order: 'ASC' } },
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
