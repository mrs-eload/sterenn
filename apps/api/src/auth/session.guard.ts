import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AuthService } from './services/auth.service';

export const SESSION_COOKIE_NAME = 'sterenn_session';

const IS_PUBLIC_KEY = 'is_public';

type SessionRequest = Request & { user_id?: string };

// The guard is global (registered in AuthModule), so every route needs a
// session unless it opts out. Only sign-in does.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// The current user's id, which is all other modules get to know about the user.
export const CurrentUserId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const user_id = context.switchToHttp().getRequest<SessionRequest>().user_id;
  if (!user_id) {
    throw new UnauthorizedException();
  }
  return user_id;
});

export function setSessionCookie(response: Response, token: string, expires_at: Date): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    expires: expires_at,
    path: '/',
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}

export function readSessionCookie(request: Request): string | null {
  const value: unknown = request.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth_service: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const is_public = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (is_public) {
      return true;
    }

    const http = context.switchToHttp();
    const request = http.getRequest<SessionRequest>();
    const token = readSessionCookie(request);
    const authenticated = token ? await this.auth_service.authenticate(token, new Date()) : null;
    if (!token || !authenticated) {
      throw new UnauthorizedException();
    }

    request.user_id = authenticated.user_id;
    // The session's expiry slid forward, so the cookie's must too, or the
    // browser would drop it 30 days after sign-in regardless of use.
    setSessionCookie(http.getResponse<Response>(), token, authenticated.expires_at);
    return true;
  }
}
