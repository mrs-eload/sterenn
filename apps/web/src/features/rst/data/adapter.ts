import type { RstWireResponse } from './rstApi.ts';
import type { RstTelemetry } from '../types.ts';

/**
 * Pure map from the source's wire shape to our own RstTelemetry. No network, no
 * React, no Date.now — unit-testable once the wire shape is pinned down. Keeping
 * the mapping here means the source's field names never leak past data/.
 *
 * TODO(api): read the real fields off `wire` (timestamp, position, etc.). For
 * now we only carry the untransformed payload so the seam type-checks without
 * inventing a schema; timestamp is 0 as an explicit "not yet mapped" marker.
 */
export function adaptRstState(wire: RstWireResponse): RstTelemetry {
  return {
    timestamp: 0,
    raw: wire,
  };
}
