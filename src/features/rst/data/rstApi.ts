// INPUT seam — the only place in the RST subject that touches the network.
// Mirrors the app's data/ convention: fetch here, map in adapter.ts, and never
// let the source's field names leak past this folder.

// --- Source configuration ---------------------------------------------------
// TODO(api): the user will supply these. Until they're set, isConfigured() is
// false and the fetch is intentionally disabled, so nothing pretends to work.
//   RST_API_BASE      — base URL of the tracking source
//   RST_SPACECRAFT_ID — the Roman/RST object identifier at that source
const RST_API_BASE = '';
const RST_SPACECRAFT_ID = '';

/** True once a real endpoint + spacecraft id have been filled in above. */
export function isConfigured(): boolean {
  return RST_API_BASE !== '' && RST_SPACECRAFT_ID !== '';
}

/**
 * The raw wire shape returned by the source. Refined to the real payload once
 * the live API is known; opaque for now so we don't guess at field names.
 */
export interface RstWireResponse {
  [key: string]: unknown;
}

/** Assemble the tracking request URL. TODO(api): real path/query for the id. */
export function buildTrackingUrl(): string {
  return `${RST_API_BASE}/${RST_SPACECRAFT_ID}`;
}

/**
 * Fetch the current tracking payload. Throws when the source isn't configured
 * yet; the hook turns that into a 'not-configured' state rather than an error.
 */
export async function fetchRstState(signal?: AbortSignal): Promise<RstWireResponse> {
  if (!isConfigured()) {
    throw new Error('RST tracking source is not configured yet.');
  }
  const res = await fetch(buildTrackingUrl(), { signal });
  if (!res.ok) throw new Error(`RST source returned ${res.status}`);
  return (await res.json()) as RstWireResponse;
}
