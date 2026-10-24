import type { ThreadSize } from '../entities/thread-size.entity';

export abstract class ThreadSizeRepository {
  abstract save(thread_size: ThreadSize): Promise<ThreadSize>;
  abstract findById(id: string): Promise<ThreadSize | null>;
  abstract list(): Promise<ThreadSize[]>;
  // Returns false when there was no such row.
  abstract delete(id: string): Promise<boolean>;
}
