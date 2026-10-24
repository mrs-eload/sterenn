import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import {
  type EquipmentInput,
  type EquipmentListQuery,
  equipment_input_schema,
  equipment_list_query_schema,
} from '@sterenn/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import type { Equipment } from '../entities/equipment.entity';
import { EquipmentService } from '../services/equipment.service';

type ThreadResponse = {
  id: string;
  thread_size_id: string;
  gender: string;
  position: string;
  notes: string | null;
};

export type EquipmentResponse = {
  id: string;
  type: string;
  manufacturer: string;
  model: string;
  weight_g: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  specs: Record<string, unknown> | null;
  threads: ThreadResponse[];
};

// Same shape as the request body, plus ids and timestamps. The specs object
// drops its own key and back-reference, which only matter to the database.
function toSpecsResponse(specs: { equipment_id: string; equipment?: unknown } | null | undefined) {
  if (!specs) {
    return null;
  }
  const response: Record<string, unknown> = { ...specs };
  delete response.equipment_id;
  delete response.equipment;
  return response;
}

export function toEquipmentResponse(equipment: Equipment): EquipmentResponse {
  return {
    id: equipment.id,
    type: equipment.type,
    manufacturer: equipment.manufacturer,
    model: equipment.model,
    weight_g: equipment.weight_g,
    notes: equipment.notes,
    created_at: equipment.created_at,
    updated_at: equipment.updated_at,
    specs: toSpecsResponse(
      equipment.mount ??
        equipment.telescope ??
        equipment.camera ??
        equipment.filter_holder ??
        equipment.filter ??
        equipment.corrector,
    ),
    threads: (equipment.threads ?? []).map((thread) => ({
      id: thread.id,
      thread_size_id: thread.thread_size_id,
      gender: thread.gender,
      position: thread.position,
      notes: thread.notes,
    })),
  };
}

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment_service: EquipmentService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(equipment_list_query_schema)) query: EquipmentListQuery,
  ): Promise<EquipmentResponse[]> {
    return (await this.equipment_service.list(query)).map(toEquipmentResponse);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<EquipmentResponse> {
    return toEquipmentResponse(await this.equipment_service.findById(id));
  }

  @Post()
  async create(@Body(new ZodValidationPipe(equipment_input_schema)) body: EquipmentInput): Promise<EquipmentResponse> {
    const created = await this.equipment_service.create(body);
    return toEquipmentResponse(await this.equipment_service.findById(created.id));
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(equipment_input_schema)) body: EquipmentInput,
  ): Promise<EquipmentResponse> {
    return toEquipmentResponse(await this.equipment_service.update(id, body));
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.equipment_service.delete(id);
  }
}
