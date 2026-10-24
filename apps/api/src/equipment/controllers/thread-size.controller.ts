import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { type ThreadSizeInput, thread_size_input_schema } from '@sterenn/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { ThreadSize } from '../entities/thread-size.entity.js';
import { ThreadSizeService } from '../services/thread-size.service.js';

@Controller('thread-sizes')
export class ThreadSizeController {
  constructor(private readonly thread_size_service: ThreadSizeService) {}

  @Get()
  list(): Promise<ThreadSize[]> {
    return this.thread_size_service.list();
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<ThreadSize> {
    return this.thread_size_service.findById(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(thread_size_input_schema)) body: ThreadSizeInput): Promise<ThreadSize> {
    return this.thread_size_service.create(body);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(thread_size_input_schema)) body: ThreadSizeInput,
  ): Promise<ThreadSize> {
    return this.thread_size_service.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.thread_size_service.delete(id);
  }
}
