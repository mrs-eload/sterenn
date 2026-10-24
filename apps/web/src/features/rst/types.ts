// Domain types for the temporary RST (Nancy Grace Roman Space Telescope)
// subject. Kept LOCAL to this feature — deliberately NOT in core/ — because the
// whole subject is temporary and must delete cleanly as a single folder.

/**
 * A single tracking fix for the spacecraft, in our own shape (never the
 * source's wire shape — that stays behind data/adapter).
 *
 * Provisional: only the fields we're certain of are modelled. The real telemetry
 * fields are added once the live source's payload is known — see the TODO in
 * `data/rstApi.ts`. Nothing here is guessed at.
 */
export interface RstTelemetry {
  /** When this fix was produced, epoch milliseconds (app-wide convention). */
  timestamp: number;
  /**
   * The untransformed source payload. Placeholder passthrough until the mapping
   * is written; real typed fields replace this once the API shape is known.
   */
  raw: unknown;
}
