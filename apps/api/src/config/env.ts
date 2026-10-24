import { existsSync } from 'node:fs';
import { z } from 'zod';

// A local .env is optional: on a host the variables come from the platform.
const ENV_FILE = '.env';
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const env_schema = z.object({
  DATABASE_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  ALLOWED_GOOGLE_EMAIL: z.email(),
  WEB_ORIGIN: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof env_schema>;

// Parsed once at startup so a missing variable stops the API immediately
// instead of failing on the first request that needs it.
export const env: Env = env_schema.parse(process.env);
