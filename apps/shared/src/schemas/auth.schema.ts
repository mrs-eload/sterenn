import { z } from 'zod';

export const google_sign_in_input_schema = z.object({
  id_token: z.string().min(1),
});

export type GoogleSignInInput = z.infer<typeof google_sign_in_input_schema>;
