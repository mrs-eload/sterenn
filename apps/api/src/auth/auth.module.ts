import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controllers/auth.controller';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';
import { SessionRepository } from './repositories/session.repository';
import { TypeormSessionRepository } from './repositories/typeorm-session.repository';
import { TypeormUserRepository } from './repositories/typeorm-user.repository';
import { UserRepository } from './repositories/user.repository';
import { AuthService } from './services/auth.service';
import { GoogleTokenVerifier } from './services/google-token.verifier';
import { SessionGuard } from './session.guard';

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
