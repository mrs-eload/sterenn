import { Injectable } from '@nestjs/common';
import type { RigInput } from '@sterenn/shared';
import { NotFoundError, ValidationError } from '../../common/domain-errors';
import type { Equipment } from '../entities/equipment.entity';
import { RigChainItem } from '../entities/rig-chain-item.entity';
import { RigFilter } from '../entities/rig-filter.entity';
import { Rig } from '../entities/rig.entity';
import { EquipmentRepository } from '../repositories/equipment.repository';
import { RigRepository } from '../repositories/rig.repository';
import { type RigDraft, type RigProblems, RigValidator } from '../rules/rig-validator';

export type RigWithProblems = {
  rig: Rig;
  problems: RigProblems;
};

function toDraft(rig: Rig): RigDraft {
  return {
    mount_id: rig.mount_id,
    guide_telescope_id: rig.guide_telescope_id,
    guide_camera_id: rig.guide_camera_id,
    chain: [...(rig.chain_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((chain_item) => chain_item.equipment_id),
    filters: (rig.filters ?? []).map(({ filter_id, holder_id }) => ({ filter_id, holder_id })),
  };
}

function referencedIds(draft: RigDraft): string[] {
  const ids = [draft.mount_id, draft.guide_telescope_id, draft.guide_camera_id, ...draft.chain];
  for (const rig_filter of draft.filters) {
    ids.push(rig_filter.filter_id, rig_filter.holder_id);
  }
  return ids.filter((id): id is string => id !== null);
}

// Chain rows are keyed by (rig_id, sort_order), so on PUT TypeORM updates the
// rows at existing positions and deletes the positions past the new end.
function applyInput(rig: Rig, input: RigInput): Rig {
  rig.name = input.name;
  rig.is_current = input.is_current;
  rig.mount_id = input.mount_id;
  rig.guide_telescope_id = input.guide_telescope_id;
  rig.guide_camera_id = input.guide_camera_id;
  rig.chain_items = input.chain.map((equipment_id, sort_order) =>
    Object.assign(new RigChainItem(), { rig_id: rig.id, sort_order, equipment_id }),
  );
  rig.filters = input.filters.map((rig_filter) => Object.assign(new RigFilter(), rig_filter, { rig_id: rig.id }));
  return rig;
}

@Injectable()
export class RigService {
  constructor(
    private readonly rig_repository: RigRepository,
    private readonly equipment_repository: EquipmentRepository,
    private readonly rig_validator: RigValidator,
  ) {}

  async list(owner_id: string): Promise<RigWithProblems[]> {
    const rigs = await this.rig_repository.listByOwner(owner_id);
    const drafts = rigs.map(toDraft);
    // One load for every rig's parts instead of one per rig.
    const parts = await this.loadParts(drafts.flatMap(referencedIds));
    return rigs.map((rig, index) => ({ rig, problems: this.rig_validator.validate(drafts[index], parts) }));
  }

  async findById(owner_id: string, id: string): Promise<RigWithProblems> {
    const rig = await this.findOwned(owner_id, id);
    return { rig, problems: await this.check(toDraft(rig)) };
  }

  async create(owner_id: string, input: RigInput): Promise<RigWithProblems> {
    await this.checkOrRefuse(input);
    const rig = new Rig();
    rig.owner_id = owner_id;
    const saved = await this.rig_repository.save(applyInput(rig, input));
    return this.findById(owner_id, saved.id);
  }

  async update(owner_id: string, id: string, input: RigInput): Promise<RigWithProblems> {
    const rig = await this.findOwned(owner_id, id);
    await this.checkOrRefuse(input);
    await this.rig_repository.save(applyInput(rig, input));
    return this.findById(owner_id, id);
  }

  async delete(owner_id: string, id: string): Promise<void> {
    await this.findOwned(owner_id, id);
    await this.rig_repository.delete(id);
  }

  // Another owner's rig is reported as missing rather than forbidden, so its
  // existence is not revealed.
  private async findOwned(owner_id: string, id: string): Promise<Rig> {
    const rig = await this.rig_repository.findById(id);
    if (!rig || rig.owner_id !== owner_id) {
      throw new NotFoundError('Rig', id);
    }
    return rig;
  }

  private async checkOrRefuse(input: RigInput): Promise<void> {
    const problems = await this.check(input);
    if (problems.errors.length > 0) {
      throw new ValidationError(problems.errors);
    }
  }

  private async check(draft: RigDraft): Promise<RigProblems> {
    return this.rig_validator.validate(draft, await this.loadParts(referencedIds(draft)));
  }

  private async loadParts(ids: string[]): Promise<Map<string, Equipment>> {
    const parts = await this.equipment_repository.findByIds([...new Set(ids)]);
    return new Map(parts.map((part) => [part.id, part]));
  }
}
