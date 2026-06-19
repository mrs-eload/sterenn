# Project status

_Living document. Update it when a brick lands. The point: anyone (or any tool)
opening this repo cold should know what exists, what's proven, and what's next
without reading chat history._

**Last updated:** 2026-06-19

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

All four exist. 12 unit tests pass (`npm test`).

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
| `core/moon` | ⬜ Empty | Moon illumination/phase/rise-set via suncalc — not built. |
| `data/openMeteo` | ✅ Built, 4 tests | ⚠️ Not yet run against the live API — see caveats. |
| `features/conditions` | ⬜ `.gitkeep` only | The UI. Next brick. |
| Backend (NestJS) | ⬜ Not needed yet | Deferred until an API forces it. |

## ⚠️ Known caveats / gotchas

1. **Data layer is unverified against the live API.** Built in a sandbox with no
   network to Open-Meteo. Model slugs (`models.ts`) and the multi-model response
   shape need confirming on first real fetch. Adapter is built to survive slug
   renames. Details in ADR 0002.

2. **Brittany latitude reality.** At ~47.8°N, June gives only ~95 min of
   astronomical darkness — *below* the 3h minimum. So a perfectly clear June
   night correctly returns `good: false`. This is the sky, not a bug. The UI
   should eventually distinguish **"too cloudy"** from **"not dark long enough"**
   (both are `good: false` but mean different things to the user).

## Next brick

`features/conditions/`:
- `hooks/useTonight.ts` — chains the four pipeline functions, exposes clean state.
- `components/` — night card, hourly table, observation-window bar, model picker,
  sky-quality curve (mirroring the Ouranos screenshot layout).
- Requires installing MUI (`@mui/material @emotion/react @emotion/styled`) and a
  dark theme (`src/theme.ts`).

Keep components dumb: they render, they don't compute. All logic stays in
`core/` and the hook.
