import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { errorMessages } from '@app/data/sterennApi';
import { size, text, tone } from '../tokens';
import { Panel } from './primitives';

// Google Identity Services: the button returns an ID token, which the API
// verifies (ADR 0004 section 5). The client id is public, not a secret.
const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

type GoogleId = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });
}

export function GoogleSignIn({ onCredential }: { onCredential: (id_token: string) => Promise<void> }) {
  const button_ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(GOOGLE_CLIENT_ID ? null : 'VITE_GOOGLE_CLIENT_ID is not set.');

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let is_active = true;
    loadScript()
      .then(() => {
        const google_id = window.google?.accounts.id;
        if (!is_active || !google_id || !button_ref.current) return;
        google_id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) => {
            onCredential(credential).catch((sign_in_error: unknown) => setError(errorMessages(sign_in_error).join('. ')));
          },
        });
        google_id.renderButton(button_ref.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with' });
      })
      .catch((load_error: unknown) => setError(errorMessages(load_error).join('. ')));
    return () => {
      is_active = false;
    };
  }, [onCredential]);

  return (
    <Panel sx={{ maxWidth: 420, mx: 'auto', mt: 6, textAlign: 'center' }}>
      <Box sx={{ color: text.primary, fontWeight: 900, fontSize: size.xl, mb: 1 }}>Sign in</Box>
      <Box sx={{ color: text.secondary, fontSize: size.sm, mb: 3 }}>Your equipment and rigs are private to your account.</Box>
      <Box ref={button_ref} sx={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
      {error && <Box sx={{ color: tone.signal400, fontSize: size.sm, mt: 2 }}>{error}</Box>}
    </Panel>
  );
}
