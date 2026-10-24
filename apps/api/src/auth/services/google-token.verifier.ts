import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';

export type GoogleIdentity = {
  sub: string;
  email: string;
  email_verified: boolean;
};

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  // verifyIdToken checks the signature against Google's keys, `aud` against our
  // client id, `iss` and expiry. Any failure means "not signed in", so it
  // returns null instead of throwing.
  async verify(id_token: string): Promise<GoogleIdentity | null> {
    try {
      const ticket = await this.client.verifyIdToken({ idToken: id_token, audience: env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        return null;
      }
      return { sub: payload.sub, email: payload.email, email_verified: payload.email_verified === true };
    } catch {
      return null;
    }
  }
}
