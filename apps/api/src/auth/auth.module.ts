import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controllers/auth.controller.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';
import { SessionRepository } from './repositories/session.repository.js';
import { TypeormSessionRepository } from './repositories/typeorm-session.repository.js';
import { TypeormUserRepository } from './repositories/typeorm-user.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuthService } from './services/auth.service.js';
import { GoogleTokenVerifier } from './services/google-token.verifier.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleTokenVerifier,
    { provide: UserRepository, useClass: TypeormUserRepository },
    { provide: SessionRepository, useClass: TypeormSessionRepository },
    // Global: every route in every module requires a session unless @Public().
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
