/**
 * Open-Meteo geocoding — turn a typed place name into coordinates.
 *
 * Same contract as the rest of data/: this is the *only* place that touches the
 * geocoding network, the wire shape is mapped to our own `GeoPlace` here, and
 * Open-Meteo's field names (latitude/longitude/admin1/…) never leak past this
 * file. The forecast pipeline downstream only ever sees `{ lat, lon }`.
 *
 * The API needs no key (same free tier as /v1/forecast). Verified live
 * 2026-06-22: a hit returns `{ results: [...] }`; a miss returns an object with
 * NO `results` key at all (not an empty array), so the adapter treats a missing
 * `results` as "no matches".
 */

const BASE = 'https://geocoding-api.open-meteo.com/v1/search';

/** A place the user can observe from, in our own vocabulary. */
export interface GeoPlace {
  /** Open-Meteo's numeric id — stable, handy as a React key. */
  id: number;
  /** Bare place name, e.g. "Morlaix". */
  name: string;
  lat: number;
  lon: number;
  /** Country name, e.g. "France". Optional — not every record carries it. */
  country?: string;
  /** First-level region, e.g. "Brittany". Optional. */
  admin1?: string;
  /**
   * A disambiguated one-line label for the picker, e.g.
   * "Morlaix, Brittany, France". Built here so the UI stays dumb.
   */
  label: string;
}

/** The slice of the geocoding wire shape we read. */
interface RawGeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

interface RawGeoResponse {
  /** Absent (not empty) when nothing matched. */
  results?: RawGeoResult[];
}

export interface GeocodeParams {
  name: string;
  /** Max matches to return. Open-Meteo caps this; we default to 5 for the picker. */
  count?: number;
  /** UI language for names. Defaults to English. */
  language?: string;
  /** Override base URL for testing. */
  baseUrl?: string;
}

export function buildGeocodeUrl(p: GeocodeParams): string {
  const url = new URL(p.baseUrl ?? BASE);
  url.searchParams.set('name', p.name);
  url.searchParams.set('count', String(p.count ?? 5));
  url.searchParams.set('language', p.language ?? 'en');
  url.searchParams.set('format', 'json');
  return url.toString();
}

/**
 * Pure adapter: wire response → our GeoPlace[]. A missing `results` key (the
 * no-match case) maps to an empty array. Records missing coordinates are dropped
 * rather than passed downstream as NaN.
 */
export function adaptGeocoding(raw: RawGeoResponse): GeoPlace[] {
  if (!raw.results) return [];
  return raw.results
    .filter(
      (r) =>
        typeof r.latitude === 'number' && typeof r.longitude === 'number',
    )
    .map((r) => {
      const parts = [r.name, r.admin1, r.country].filter(
        (s): s is string => Boolean(s),
      );
      return {
        id: r.id,
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        country: r.country,
        admin1: r.admin1,
        label: parts.join(', '),
      };
    });
}

/** Geocode a place name. Returns [] when nothing matches. */
export async function geocode(
  name: string,
  signal?: AbortSignal,
  params: Omit<GeocodeParams, 'name'> = {},
): Promise<GeoPlace[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const res = await fetch(buildGeocodeUrl({ name: trimmed, ...params }), {
    signal,
  });
  if (!res.ok) {
    throw new Error(`Open-Meteo geocoding ${res.status}: ${res.statusText}`);
  }
  return adaptGeocoding((await res.json()) as RawGeoResponse);
}

/**
 * Parse a typed coordinate pair into { lat, lon }, or null if the text isn't a
 * coordinate pair. Pure — no network, so the UI can try this synchronously
 * before falling back to a geocoding request.
 *
 * Accepts two signed decimal degrees in "lat, lon" order, separated by a comma
 * and/or whitespace: "47.8, -3.2", "47.8 -3.2", "-3,2,47,8"… no. Decimal point
 * only (a comma is always a separator, never a decimal mark) to keep "47,8 -3,2"
 * unambiguous. Range-checked: lat ∈ [-90, 90], lon ∈ [-180, 180]; out-of-range
 * pairs return null so a mistyped place name doesn't read as coordinates.
 */
export function parseCoordinates(
  input: string,
): { lat: number; lon: number } | null {
  const m = input
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}
