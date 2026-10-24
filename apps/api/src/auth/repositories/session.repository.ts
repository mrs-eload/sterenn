import type { Session } from '../entities/session.entity';

export abstract class SessionRepository {
  abstract save(session: Session): Promise<Session>;
  abstract findByTokenHash(token_hash: string): Promise<Session | null>;
  abstract deleteByTokenHash(token_hash: string): Promise<void>;
}
