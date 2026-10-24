#!/usr/bin/env node
// Pulls fresh geocentric state vectors for RST, JWST and HST from the JPL
// Horizons API and writes them to public/horizons/<craft>/<craft>_geo.txt.
//
// The request mirrors the files previously downloaded by hand from the Horizons
// web app (vector table 3, KM-S, ecliptic J2000, Earth body centre), so the
// output goes straight through features/rst/data/horizon-parser.ts.
//
// Usage:
//   node scripts/fetch-horizons.mjs              # all three, default window
//   node scripts/fetch-horizons.mjs rst jwst     # subset
//   node scripts/fetch-horizons.mjs --past 10 --future 20
//
// No API key needed. Local dev tool only — never imported by the app.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Step sizes match the hand-downloaded files the app was built against. HST at
// 1 d undersamples its 97 min orbit, but it's only shown as a dot near Earth.
const CRAFTS = {
  rst: { id: '-211', step: '60 m' },
  jwst: { id: '-170', step: '1 d' },
  hst: { id: '-48', step: '1 d' },
};

const DAY_MS = 86_400_000;

function parseArgs(argv) {
  const options = { past: 30, future: 28, crafts: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--past') options.past = Number(argv[++i]);
    else if (arg === '--future') options.future = Number(argv[++i]);
    else if (arg in CRAFTS) options.crafts.push(arg);
    else throw new Error(`Unknown argument "${arg}". Crafts: ${Object.keys(CRAFTS).join(', ')}`);
  }
  if (options.crafts.length === 0) options.crafts = Object.keys(CRAFTS);
  return options;
}

// Horizons accepts "YYYY-MM-DD HH:MM" (UT for vectors is interpreted as TDB,
// a ~69 s offset that doesn't matter at these step sizes).
function horizonsTime(date) {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function buildUrl(craft, start, stop) {
  const params = {
    format: 'text',
    COMMAND: craft.id,
    OBJ_DATA: 'YES',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    CENTER: '500@399',
    START_TIME: start,
    STOP_TIME: stop,
    STEP_SIZE: craft.step,
    REF_PLANE: 'ECLIPTIC',
    REF_SYSTEM: 'ICRF',
    VEC_TABLE: '3',
    VEC_CORR: 'NONE',
    OUT_UNITS: 'KM-S',
    CSV_FORMAT: 'NO',
    VEC_LABELS: 'YES',
  };
  // Horizons wants every value wrapped in single quotes.
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(key === 'format' ? value : `'${value}'`)}`)
    .join('&');
  return `${API_URL}?${query}`;
}

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

// Spacecraft ephemerides have hard edges (launch, end of prediction; HST's TLE
// span is only days). Horizons rejects the whole request rather than
// truncating, saying e.g. 'No ephemeris for target "..." after A.D. 2026-SEP-28 04:35:09.1820 TD'.
// Pull that boundary out so we can retry with a clamped window.
function coverageLimit(body) {
  const match = body.match(/No ephemeris for target .*? (prior to|after) A\.D\. (\d{4})-([A-Z]{3})-(\d{2}) (\d{2}):(\d{2})/);
  if (!match) return null;
  const [, side, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(+year, MONTHS[month], +day, +hour, +minute));
  return { side, date };
}

async function fetchCraft(name, options) {
  const craft = CRAFTS[name];
  const now = Date.now();
  let start = new Date(now - options.past * DAY_MS);
  let stop = new Date(now + options.future * DAY_MS);

  // At most one clamp per side, so two retries.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(buildUrl(craft, horizonsTime(start), horizonsTime(stop)));
    const body = await response.text();
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}\n${body.slice(0, 500)}`);
    if (body.includes('$$SOE')) return { body, start, stop };

    const limit = coverageLimit(body);
    if (!limit) throw new Error(`${name}: Horizons returned no ephemeris:\n${body.slice(-1500)}`);
    // Pad by a minute so we land strictly inside the coverage.
    if (limit.side === 'after') stop = new Date(limit.date.getTime() - 60_000);
    else start = new Date(limit.date.getTime() + 60_000);
    console.warn(`  ${name}: coverage ends ${limit.side} ${horizonsTime(limit.date)}, retrying`);
  }
  throw new Error(`${name}: could not find a window inside Horizons coverage`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let failed = false;

  for (const name of options.crafts) {
    try {
      const { body, start, stop } = await fetchCraft(name, options);
      const outPath = join(ROOT, 'public', 'horizons', name, `${name}_geo.txt`);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, body);
      const rows = body.split('$$SOE')[1].split('$$EOE')[0].match(/= A\.D\./g)?.length ?? 0;
      console.log(`✓ ${name}: ${rows} points, ${horizonsTime(start)} → ${horizonsTime(stop)} → ${outPath}`);
    } catch (error) {
      failed = true;
      console.error(`✗ ${error.message}`);
    }
  }

  if (failed) process.exitCode = 1;
}

main();
