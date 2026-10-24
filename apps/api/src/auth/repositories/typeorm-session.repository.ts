import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../entities/session.entity.js';
import { SessionRepository } from './session.repository.js';

@Injectable()
export class TypeormSessionRepository extends SessionRepository {
  constructor(@InjectRepository(Session) private readonly repository: Repository<Session>) {
    super();
  }

  save(session: Session): Promise<Session> {
    return this.repository.save(session);
  }

  findByTokenHash(token_hash: string): Promise<Session | null> {
    return this.repository.findOneBy({ token_hash });
  }

  async deleteByTokenHash(token_hash: string): Promise<void> {
    await this.repository.delete({ token_hash });
  }
}
