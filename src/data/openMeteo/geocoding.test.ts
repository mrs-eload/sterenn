import { describe, it, expect } from 'vitest';
import {
  buildGeocodeUrl,
  adaptGeocoding,
  parseCoordinates,
} from './geocoding.ts';

describe('buildGeocodeUrl', () => {
  it('encodes the name and applies defaults', () => {
    const url = new URL(buildGeocodeUrl({ name: 'Le Faou' }));
    expect(url.searchParams.get('name')).toBe('Le Faou');
    expect(url.searchParams.get('count')).toBe('5');
    expect(url.searchParams.get('language')).toBe('en');
    expect(url.searchParams.get('format')).toBe('json');
  });
});

describe('adaptGeocoding', () => {
  it('maps the wire shape and builds a disambiguated label', () => {
    // Trimmed copy of a real Morlaix response (verified live 2026-06-22).
    const out = adaptGeocoding({
      results: [
        {
          id: 2991772,
          name: 'Morlaix',
          latitude: 48.57784,
          longitude: -3.82792,
          country: 'France',
          admin1: 'Brittany',
        },
      ],
    });
    expect(out).toEqual([
      {
        id: 2991772,
        name: 'Morlaix',
        lat: 48.57784,
        lon: -3.82792,
        country: 'France',
        admin1: 'Brittany',
        label: 'Morlaix, Brittany, France',
      },
    ]);
  });

  it('treats a missing `results` key (the no-match case) as empty', () => {
    // The live miss response is `{ generationtime_ms }` with NO results key.
    expect(adaptGeocoding({})).toEqual([]);
  });

  it('drops records without numeric coordinates', () => {
    const out = adaptGeocoding({
      results: [
        { id: 1, name: 'Good', latitude: 10, longitude: 20 },
        // @ts-expect-error deliberately malformed record
        { id: 2, name: 'Bad', latitude: null, longitude: 20 },
      ],
    });
    expect(out.map((p) => p.name)).toEqual(['Good']);
  });

  it('omits absent admin1/country from the label', () => {
    const [place] = adaptGeocoding({
      results: [{ id: 9, name: 'Nowhere', latitude: 0, longitude: 0 }],
    });
    expect(place.label).toBe('Nowhere');
  });
});

describe('parseCoordinates', () => {
  it('parses a comma-separated pair', () => {
    expect(parseCoordinates('47.8, -3.2')).toEqual({ lat: 47.8, lon: -3.2 });
  });

  it('parses a whitespace-separated pair', () => {
    expect(parseCoordinates('  47.8   -3.2 ')).toEqual({ lat: 47.8, lon: -3.2 });
  });

  it('parses bare integers', () => {
    expect(parseCoordinates('48,-4')).toEqual({ lat: 48, lon: -4 });
  });

  it('rejects a place name', () => {
    expect(parseCoordinates('Morlaix')).toBeNull();
  });

  it('rejects out-of-range latitude', () => {
    expect(parseCoordinates('123, 4')).toBeNull();
  });

  it('rejects out-of-range longitude', () => {
    expect(parseCoordinates('10, 200')).toBeNull();
  });

  it('rejects a single number', () => {
    expect(parseCoordinates('47.8')).toBeNull();
  });
});
