# ADR 0001 — Conditions module: "good night" detection & astro-math library

**Status:** Accepted
**Date:** 2026-06-19
**Module:** Tonight's conditions (first subject built)

---

## Context

`sterenn` is an astrophotography web app (React + MUI; NestJS only if a backend
becomes necessary). It's built subject-by-subject. The first subject is a
"tonight's conditions" view, similar in spirit to Ouranos.

The motivating problem: **Ouranos flags a whole night as "good" when as little as
one hour is clear.** For astrophotography that's useless — a usable session needs
a *contiguous* stretch of clear sky long enough to integrate (3h minimum here).
One clear hour wedged between cloud is not a shootable night.

## Decision

### 1. Detection logic — run-length, not existence

The night verdict is computed from the **longest contiguous usable clear block**
inside the dark window, not from the existence of any single clear hour.

- **Dark window:** astronomical twilight only (sun below −18°). Hours outside it
  don't count regardless of cloud cover.
- **Per-hour classification:** `clear` / `cloud` / `precip`.
  - `clear` = cloud cover ≤ threshold (default 20%).
  - `precip` = precipitation probability ≥ threshold (default 30%) or any forecast mm.
- **Clouds are tolerant.** Isolated bad-cloud hours can be bridged via a
  configurable **gap budget** (default 1). This absorbs forecast noise — a single
  flaky hour shouldn't sever a 5-hour block. Default behaves near-strict; tunable.
- **Precipitation is a HARD break.** It severs the run unconditionally, ignoring
  the gap budget. Rain means packing up, not bridging.
- **Verdict:** night is "good" only if the longest usable block ≥ `minBlockHours`
  (default 3h).
- **Output is the block, not a boolean.** The module returns the block's start/end
  times plus a per-hour breakdown, so the UI can show *why* (green / bridged-amber /
  red-precip cells) instead of a mystery checkmark.

Implemented in `analyzeNight.ts` as a pure function (no fetch, no network dates) —
unit-tested independently of any data source.

```
analyzeNight(hourly: HourPoint[], dark: DarkWindow, config?) => NightAnalysis
```

Defaults: `cloudThreshold 20`, `cloudGapBudget 1`, `minBlockHours 3`,
`precipProbThreshold 30`, `precipMmThreshold 0`. All overridable per call.

### 2. Astronomy math library

| Need | Choice | Why |
|---|---|---|
| **Dark window + moon (conditions module)** | **`suncalc`** (mainline, by mourner) | Tiny, synchronous, BSD. Gives twilight phases directly (`nightEnd`/`night` = astronomical −18° = the dark window), plus `getMoonIllumination` (fraction + phase) and `getMoonTimes` (rise/set). Now validated against JPL Horizons & USNO, rise/set ~15s accurate. |
| **Target planning (future)** | **`astronomy-engine`** | When we add planet positions, target altitude curves, transit/rise-set with atmospheric refraction. Well-validated, MIT, multi-language. Use it *per-module* — don't pay its weight in the conditions module. |
| Maximum precision | `astronomy-bundle` (VSOP87) | Most precise but heavy and async (Promises). Overkill for twilight. Not chosen. |
| — | ~~`suncalc3`~~ (Hypnos3 fork) | Skip. Mainline `suncalc` caught up on precision and is better maintained. |

**Rule of thumb:** `suncalc` for the conditions module now; graduate specific
later modules to `astronomy-engine` only when they need planet/DSO positioning.

### 3. Data source (conditions)

**Open-Meteo** — no API key, browser-friendly CORS. Provides hourly `cloud_cover`,
`precipitation`, and `precipitation_probability`, which map almost field-for-field
onto `HourPoint`. **No NestJS proxy needed yet.** The multi-model picker (UKMO,
ICON, ECMWF, AROME…) seen in Ouranos is achievable via Open-Meteo's `models` query
param, so even that may not force a backend.

## Consequences

- The conditions module ships as a static SPA. Backend deferred until something
  genuinely requires it (a keyed/CORS-hostile API).
- `analyzeNight.ts` stays pure and source-agnostic — swapping or adding weather
  providers doesn't touch the detection logic.
- Next brick: `getDarkWindow(date, lat, lon)` — a thin `suncalc` wrapper emitting
  the `DarkWindow` shape `analyzeNight` consumes. Then the Open-Meteo → `HourPoint[]`
  adapter. After that the module is end-to-end.

## Open questions / not yet decided

- Tuning defaults (cloud threshold, gap budget) against real sessions in Brittany.
- Whether to factor seeing / transparency / wind / dew point into the verdict later
  (currently clouds + precip only, by deliberate choice).
- Multi-night strip (the 10-day view) — same `analyzeNight` per night, just looped.
