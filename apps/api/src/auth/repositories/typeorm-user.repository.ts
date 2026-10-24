import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class TypeormUserRepository extends UserRepository {
  constructor(@InjectRepository(User) private readonly repository: Repository<User>) {
    super();
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByGoogleSub(google_sub: string): Promise<User | null> {
    return this.repository.findOneBy({ google_sub });
  }

  exists(): Promise<boolean> {
    return this.repository.exists();
  }
}
