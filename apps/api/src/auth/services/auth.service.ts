import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../../config/env.js';
import { Session } from '../entities/session.entity.js';
import { User } from '../entities/user.entity.js';
import { SessionRepository } from '../repositories/session.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { GoogleTokenVerifier } from './google-token.verifier.js';

export const SESSION_LIFETIME_DAYS = 30;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_BYTES = 32;

export type SignedIn = {
  user: User;
  token: string;
  expires_at: Date;
};

export type Authenticated = {
  user_id: string;
  expires_at: Date;
};

// The token is 32 random bytes, so a fast hash is enough: there is nothing to
// brute-force, unlike a password.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly google_token_verifier: GoogleTokenVerifier,
    private readonly user_repository: UserRepository,
    private readonly session_repository: SessionRepository,
  ) {}

  // Returns null for every refusal: bad token, wrong account, or a second
  // Google account once the single user exists.
  async signIn(id_token: string, user_agent: string | null, now: Date): Promise<SignedIn | null> {
    const identity = await this.google_token_verifier.verify(id_token);
    if (!identity) {
      return null;
    }

    let user = await this.user_repository.findByGoogleSub(identity.sub);
    if (!user) {
      // Only the first sign-in creates the user, and only for the allowed,
      // Google-verified email. After that the account is pinned by `sub`.
      const is_allowed_email =
        identity.email_verified && identity.email.toLowerCase() === env.ALLOWED_GOOGLE_EMAIL.toLowerCase();
      if (!is_allowed_email || (await this.user_repository.exists())) {
        return null;
      }
      user = new User();
      user.google_sub = identity.sub;
      user.email = identity.email;
      user = await this.user_repository.save(user);
    }

    const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
    const session = new Session();
    session.user_id = user.id;
    session.token_hash = hashToken(token);
    session.last_used_at = now;
    session.expires_at = new Date(now.getTime() + SESSION_LIFETIME_MS);
    session.user_agent = user_agent?.slice(0, 255) ?? null;
    await this.session_repository.save(session);

    return { user, token, expires_at: session.expires_at };
  }

  // Valid session → its lifetime slides forward 30 days from now.
  async authenticate(token: string, now: Date): Promise<Authenticated | null> {
    const session = await this.session_repository.findByTokenHash(hashToken(token));
    if (!session || session.expires_at.getTime() <= now.getTime()) {
      return null;
    }
    session.last_used_at = now;
    session.expires_at = new Date(now.getTime() + SESSION_LIFETIME_MS);
    await this.session_repository.save(session);
    return { user_id: session.user_id, expires_at: session.expires_at };
  }

  async signOut(token: string): Promise<void> {
    await this.session_repository.deleteByTokenHash(hashToken(token));
  }

  findUser(id: string): Promise<User | null> {
    return this.user_repository.findById(id);
  }
}
