import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './common/domain-error.filter';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Vercel routes /api/* to this service without stripping the prefix, and
  // serving the API on the web app's own domain keeps the SameSite=Lax session
  // cookie first-party.
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalFilters(new DomainErrorFilter());
  // Only the frontend may call the API with credentials (ADR 0004 section 5).
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  await app.listen(env.PORT);
}

void bootstrap();
