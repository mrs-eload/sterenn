import { describe, it, expect } from 'vitest';
import { addRecent, parseRecents, MAX_RECENTS } from './recentLocations.ts';
import type { ObservingLocation } from './hooks/useTonight.ts';

const place = (id: string, lat = 47.8, lon = -3.2): ObservingLocation => ({
  id,
  label: id,
  lat,
  lon,
});

describe('addRecent', () => {
  it('prepends a new location, most-recent-first', () => {
    const out = addRecent([place('a')], place('b'));
    expect(out.map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('bumps a re-picked location to the front without duplicating it', () => {
    const out = addRecent([place('a'), place('b'), place('c')], place('b'));
    expect(out.map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps the freshest copy when an id is re-added', () => {
    const out = addRecent([place('paris', 48.85, 2.35)], place('paris', 1, 2));
    expect(out).toEqual([place('paris', 1, 2)]);
  });

  it('caps the list at MAX_RECENTS, dropping the oldest', () => {
    const start = Array.from({ length: MAX_RECENTS }, (_, i) => place(`p${i}`));
    const out = addRecent(start, place('new'));
    expect(out).toHaveLength(MAX_RECENTS);
    expect(out[0].id).toBe('new');
    // The oldest (last) entry fell off the end.
    expect(out.some((l) => l.id === `p${MAX_RECENTS - 1}`)).toBe(false);
  });
});

describe('parseRecents', () => {
  it('returns [] for null, empty, or non-JSON input', () => {
    expect(parseRecents(null)).toEqual([]);
    expect(parseRecents('')).toEqual([]);
    expect(parseRecents('not json')).toEqual([]);
  });

  it('returns [] when the parsed value is not an array', () => {
    expect(parseRecents('{"id":"a"}')).toEqual([]);
  });

  it('drops malformed records and keeps valid ones', () => {
    const raw = JSON.stringify([
      place('good'),
      { id: 'no-coords', label: 'x' },
      { id: 1, label: 'numeric id', lat: 1, lon: 2 },
      { id: 'nan', label: 'x', lat: Number.NaN, lon: 2 },
    ]);
    expect(parseRecents(raw).map((l) => l.id)).toEqual(['good']);
  });
});
