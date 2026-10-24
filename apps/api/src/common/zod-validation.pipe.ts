import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

// Request bodies and queries are validated with the zod schemas from
// @sterenn/shared, not with Nest's decorator-based validation.
// Usage: `@Body(new ZodValidationPipe(equipment_input_schema)) body: EquipmentInput`.
export class ZodValidationPipe<Schema extends z.ZodType> implements PipeTransform<unknown, z.output<Schema>> {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({ message: 'Invalid request', issues: result.error.issues });
    }
    return result.data;
  }
}
