import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { type GoogleSignInInput, google_sign_in_input_schema } from '@sterenn/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { User } from '../entities/user.entity.js';
import { AuthService } from '../services/auth.service.js';
import { clearSessionCookie, CurrentUserId, Public, readSessionCookie, setSessionCookie } from '../session.guard.js';

type UserResponse = { id: string; email: string };

function toUserResponse(user: User): UserResponse {
  return { id: user.id, email: user.email };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth_service: AuthService) {}

  @Public()
  @Post('google')
  @HttpCode(200)
  async signIn(
    @Body(new ZodValidationPipe(google_sign_in_input_schema)) body: GoogleSignInInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<UserResponse> {
    const signed_in = await this.auth_service.signIn(body.id_token, request.get('user-agent') ?? null, new Date());
    if (!signed_in) {
      throw new UnauthorizedException();
    }
    setSessionCookie(response, signed_in.token, signed_in.expires_at);
    return toUserResponse(signed_in.user);
  }

  @Post('logout')
  @HttpCode(204)
  async signOut(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const token = readSessionCookie(request);
    if (token) {
      await this.auth_service.signOut(token);
    }
    clearSessionCookie(response);
  }

  @Get('me')
  async me(@CurrentUserId() user_id: string): Promise<UserResponse> {
    const user = await this.auth_service.findUser(user_id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return toUserResponse(user);
  }
}
