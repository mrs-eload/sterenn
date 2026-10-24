import type { User } from '../entities/user.entity.js';

export abstract class UserRepository {
  abstract save(user: User): Promise<User>;
  abstract findById(id: string): Promise<User | null>;
  abstract findByGoogleSub(google_sub: string): Promise<User | null>;
  // Single-user app: tells whether the one allowed account has signed in yet.
  abstract exists(): Promise<boolean>;
}
