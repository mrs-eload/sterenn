# Project status

_Living document. Update it when a brick lands. The point: anyone (or any tool)
opening this repo cold should know what exists, what's proven, and what's next
without reading chat history._

**Last updated:** 2026-06-22

## What sterenn is

An astrophotography web app. Built **subject by subject** (one self-contained
feature at a time). Stack: **React 19 + Vite + TypeScript**, **MUI** for UI
(not yet installed), **NestJS only if a backend ever becomes necessary** — so
far it hasn't.

First subject: **"tonight's conditions"** — Ouranos-like, but fixing Ouranos's
core flaw (see below).

## The pipeline (conditions module)

```
getDarkWindow(date, lat, lon)        → DarkWindow      [core/sky]   ✅ built, tested
fetchForecast({lat,lon,models})      → OpenMeteoResponse [data/openMeteo] ✅ built
adaptForecast(res, {requestedModels})→ HourPoint[] per model [data/openMeteo] ✅ built, tested
analyzeNight(hourly, dark, config)   → NightAnalysis   [core/sky]   ✅ built, tested
```

All four exist and are wired into the UI (`features/conditions/`). 16 unit tests
pass (`npm test`); the data layer is now **verified against the live Open-Meteo
API** (see ADR 0002).

## The Ouranos fix (the whole reason this module exists)

Ouranos flags a night "good" if **any single hour** is clear. Useless for
astrophotography, which needs a **contiguous clear block ≥ 3h** to integrate.

`analyzeNight` measures the **longest contiguous usable clear block** inside the
dark window, not the existence of a clear hour. Clouds are tolerant (a
configurable gap budget bridges isolated bad-cloud hours); **precipitation is a
hard break** that severs the block regardless of budget. Output is the block +
a per-hour breakdown, so the UI can show *why*, not just a checkmark.

See `docs/adr/0001` for the design, `docs/adr/0002` for the data layer as built.

## Status by area

| Area | State | Notes |
|---|---|---|
| `core/sky/analyzeNight` | ✅ Done, 8 tests | The Ouranos fix. Pure. |
| `core/sky/darkWindow` | ✅ Done | suncalc wrapper. Returns `null` when no astro night (high latitude / summer). |
| `core/sky/describeNight` | ✅ Done, 4 tests | Pure verdict/reason: distinguishes "too cloudy" / "not dark long enough" / "no night". |
| `core/moon` | ⬜ Empty | Moon illumination/phase/rise-set via suncalc — not built. |
| `data/openMeteo` | ✅ Built, 4 tests, **live-verified** | Multi-model shape + slugs confirmed 2026-06-20. Dead slug `ecmwf_ifs04` replaced with `ecmwf_aifs025_single`. |
| `features/conditions` | ✅ Built | MUI dark theme + `useTonight` hook + NightCard, ObservationWindowBar, SkyQualityCurve, HourlyTable, ModelPicker, LocationSearch (geocode a city or type coordinates). |
| `data/openMeteo/geocoding` | ✅ Built, 12 tests, **live-verified** | City name → coords via Open-Meteo geocoding (no key). Pure `parseCoordinates` for typed lat/lon. Hit/miss shapes confirmed live 2026-06-22. |
| Backend (NestJS) | ⬜ Not needed yet | Deferred until an API forces it. |

## ⚠️ Known caveats / gotchas

1. ~~**Data layer is unverified against the live API.**~~ **Resolved 2026-06-20.**
   A live multi-model call confirmed the `cloud_cover_<slug>` suffix shape and the
   registry slugs. One slug was dead (`ecmwf_ifs04`, retired by Open-Meteo) and was
   replaced with `ecmwf_aifs025_single`. The runtime-suffix-discovery design held up:
   the dead slug degraded to one empty picker row, not a parse failure. Details in
   ADR 0002.

2. **Brittany latitude reality.** At ~47.8°N, June gives only ~95 min of
   astronomical darkness — *below* the 3h minimum. So a perfectly clear June
   night correctly returns `good: false`. This is the sky, not a bug. The UI now
   distinguishes **"too cloudy"** from **"not dark long enough"** via
   `core/sky/describeNight`. **Confirmed live 2026-06-20:** tonight's dark window
   in Brittany was 1.1h → every model returned `reason: 'too-short'`. Working as
   designed.

## Subject 1 (Conditions) — shipped

The end-to-end conditions view is built and runs:
`getDarkWindow → fetchForecast → adaptForecast → analyzeNight → describeNight`,
wired by `features/conditions/hooks/useTonight.ts` and rendered by dumb
components (NightCard, ObservationWindowBar, SkyQualityCurve, HourlyTable,
ModelPicker) under an MUI dark theme (`src/theme.ts`). Verified end-to-end
against the live API, `npm run build`/`lint`/`test` all green.

## Next brick

Subject 2 — **Moon** (per `docs/ROADMAP.md`): illumination / phase / rise-set via
suncalc (already a dependency). Build `core/moon` pure + tested first, then
surface it (likely as a column/section inside the conditions view, as the
roadmap notes it may start there before graduating to its own subject).

Possible polish on Conditions before moving on: an `analyzeNight` config UI.
Doesn't block shipping subject 1. (The location picker shipped 2026-06-22 —
`LocationSearch` geocodes a typed city or accepts raw coordinates, via
`data/openMeteo/geocoding`.)

Keep components dumb: they render, they don't compute. All logic stays in
`core/` and the hook.
