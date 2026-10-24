import { Injectable } from '@nestjs/common';
import type { ThreadSizeInput } from '@sterenn/shared';
import { NotFoundError } from '../../common/domain-errors';
import { ThreadSize } from '../entities/thread-size.entity';
import { ThreadSizeRepository } from '../repositories/thread-size.repository';

@Injectable()
export class ThreadSizeService {
  constructor(private readonly thread_size_repository: ThreadSizeRepository) {}

  list(): Promise<ThreadSize[]> {
    return this.thread_size_repository.list();
  }

  async findById(id: string): Promise<ThreadSize> {
    const thread_size = await this.thread_size_repository.findById(id);
    if (!thread_size) {
      throw new NotFoundError('Thread size', id);
    }
    return thread_size;
  }

  create(input: ThreadSizeInput): Promise<ThreadSize> {
    return this.thread_size_repository.save(Object.assign(new ThreadSize(), input));
  }

  async update(id: string, input: ThreadSizeInput): Promise<ThreadSize> {
    const thread_size = await this.findById(id);
    return this.thread_size_repository.save(Object.assign(thread_size, input));
  }

  async delete(id: string): Promise<void> {
    if (!(await this.thread_size_repository.delete(id))) {
      throw new NotFoundError('Thread size', id);
    }
  }
}
