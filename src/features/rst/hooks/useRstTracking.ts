import { useCallback, useEffect, useState } from 'react';
import { fetchRstState, isConfigured } from '../data/rstApi.ts';
import { adaptRstState } from '../data/adapter.ts';
import type { RstTelemetry } from '../types.ts';

// The single stateful piece of the subject: it chains data/ (fetch) → data/
// (adapter) and hands a plain result to dumb components. No astronomy, no
// rendering here — just orchestration and request lifecycle.

export type RstStatus = 'not-configured' | 'loading' | 'ready' | 'error';

export interface RstTracking {
  status: RstStatus;
  state: RstTelemetry | null;
  error: string | null;
  refetch: () => void;
}

export function useRstTracking(): RstTracking {
  // Seed straight to 'not-configured' when there's no endpoint yet, so we never
  // flash a spinner for a fetch that can't run.
  const [status, setStatus] = useState<RstStatus>(() =>
    isConfigured() ? 'loading' : 'not-configured',
  );
  const [state, setState] = useState<RstTelemetry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((): AbortController | undefined => {
    if (!isConfigured()) {
      setStatus('not-configured');
      return undefined;
    }
    const controller = new AbortController();
    setStatus('loading');
    setError(null);
    fetchRstState(controller.signal)
      .then((wire) => {
        setState(adaptRstState(wire));
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
    return controller;
  }, []);

  useEffect(() => {
    const controller = load();
    return () => controller?.abort();
  }, [load]);

  const refetch = useCallback(() => {
    load();
  }, [load]);

  return { status, state, error, refetch };
}
