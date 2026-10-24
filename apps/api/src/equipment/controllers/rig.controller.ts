import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { type RigInput, rig_input_schema } from '@sterenn/shared';
import { CurrentUserId } from '../../auth/session.guard.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { RigProblems } from '../rules/rig-validator.js';
import { type RigWithProblems, RigService } from '../services/rig.service.js';

export type RigResponse = {
  id: string;
  name: string;
  is_current: boolean;
  mount_id: string | null;
  guide_telescope_id: string | null;
  guide_camera_id: string | null;
  chain: string[];
  filters: { filter_id: string; holder_id: string | null }[];
  created_at: Date;
  updated_at: Date;
  // Recomputed on every read. A rig made incomplete by a deletion shows up
  // here with errors (ADR 0004 section 12).
  problems: RigProblems;
};

// Same shape as the request body, plus ids, timestamps and problems.
function toRigResponse({ rig, problems }: RigWithProblems): RigResponse {
  return {
    id: rig.id,
    name: rig.name,
    is_current: rig.is_current,
    mount_id: rig.mount_id,
    guide_telescope_id: rig.guide_telescope_id,
    guide_camera_id: rig.guide_camera_id,
    chain: [...(rig.chain_items ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((chain_item) => chain_item.equipment_id),
    filters: (rig.filters ?? []).map(({ filter_id, holder_id }) => ({ filter_id, holder_id })),
    created_at: rig.created_at,
    updated_at: rig.updated_at,
    problems,
  };
}

@Controller('rigs')
export class RigController {
  constructor(private readonly rig_service: RigService) {}

  @Get()
  async list(@CurrentUserId() owner_id: string): Promise<RigResponse[]> {
    return (await this.rig_service.list(owner_id)).map(toRigResponse);
  }

  @Get(':id')
  async findById(@CurrentUserId() owner_id: string, @Param('id', ParseUUIDPipe) id: string): Promise<RigResponse> {
    return toRigResponse(await this.rig_service.findById(owner_id, id));
  }

  @Post()
  async create(
    @CurrentUserId() owner_id: string,
    @Body(new ZodValidationPipe(rig_input_schema)) body: RigInput,
  ): Promise<RigResponse> {
    return toRigResponse(await this.rig_service.create(owner_id, body));
  }

  @Put(':id')
  async update(
    @CurrentUserId() owner_id: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rig_input_schema)) body: RigInput,
  ): Promise<RigResponse> {
    return toRigResponse(await this.rig_service.update(owner_id, id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUserId() owner_id: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.rig_service.delete(owner_id, id);
  }
}
