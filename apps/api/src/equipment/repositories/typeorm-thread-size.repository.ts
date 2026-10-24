import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThreadSize } from '../entities/thread-size.entity.js';
import { ThreadSizeRepository } from './thread-size.repository.js';

@Injectable()
export class TypeormThreadSizeRepository extends ThreadSizeRepository {
  constructor(@InjectRepository(ThreadSize) private readonly repository: Repository<ThreadSize>) {
    super();
  }

  save(thread_size: ThreadSize): Promise<ThreadSize> {
    return this.repository.save(thread_size);
  }

  findById(id: string): Promise<ThreadSize | null> {
    return this.repository.findOneBy({ id });
  }

  list(): Promise<ThreadSize[]> {
    return this.repository.find({ order: { diameter_mm: 'ASC', pitch_mm: 'ASC' } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }
}
