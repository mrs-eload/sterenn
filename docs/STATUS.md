# Project status

_Living document. Update it when a brick lands. The point: anyone (or any tool)
opening this repo cold should know what exists, what's proven, and what's next
without reading chat history._

**Last updated:** 2026-10-23

## What sterenn is

An astrophotography web app. Built **subject by subject** (one self-contained
feature at a time). Since ADR 0004 it is an npm workspaces monorepo:

- `apps/web`: **React 19 + Vite + TypeScript**, **MUI** for UI.
- `apps/api`: **NestJS + TypeORM + PostgreSQL**, Google sign-in.
- `apps/shared`: enums, zod schemas, response types, rig rules.

Shipped subjects: **"tonight's conditions"** (Ouranos-like, but fixing
Ouranos's core flaw, see below) and **"equipment and rigs"**.

## The pipeline (conditions module)

```
getDarkWindow(date, lat, lon)        → DarkWindow      [core/sky]   ✅ built, tested
fetchForecast({lat,lon,models})      → OpenMeteoResponse [data/openMeteo] ✅ built
adaptForecast(res, {requestedModels})→ HourPoint[] per model [data/openMeteo] ✅ built, tested
analyzeNight(hourly, dark, config)   → NightAnalysis   [core/sky]   ✅ built, tested
```

All four exist and are wired into the UI (`apps/web/src/features/conditions/`).
16 unit tests pass (`npm test`); the data layer is **verified against the live
Open-Meteo API** (see ADR 0002).

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
| `apps/shared` | ✅ Built, no tests | Enums, zod schemas, response types, `validateRig` (the rig rules, used by API and web). |
| `apps/api` auth | ✅ Built, **live-verified** | Google sign-in (ID token only, no client secret), single allowed account, SHA-256-hashed session cookie, 30-day sliding expiry, global guard. Real sign-in confirmed 2026-10-23. |
| `apps/api` equipment + rigs | ✅ Built, no tests | `/equipment`, `/thread-sizes`, `/rigs` per ADR 0004 section 12. Initial migration applied on Postgres 17. |
| `data/sterennApi` | ✅ Built | Fetch client with credentials; bodies are the shared types. |
| `features/equipment` | ✅ Built, **runs end to end** | From the Claude Design kit (`ui_kits/equipment/index.html`, Rigs tab from `rigs-visual.html`): inventory tables + detail panel, add/edit dialog, rigs view with a side-view drawing of the optical chain (refractor or Cassegrain-style tube by optical design), rig editor with live checks, Google sign-in gate. |

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

3. **Equipment and rigs have no automated tests.** Shared, API and the equipment
   feature were verified by running them (migration, boot, 401/400 smoke tests,
   real Google sign-in, the page in the browser), not by a test suite.

4. **Rule b follows the ADR, not the design mock.** Thread matching counts any
   thread of one chain part with any thread of the next. The Claude Design mock
   matched only rear → front. Switching is one function in
   `apps/shared/src/rules/validate-rig.ts`.

5. **Passbands can't be edited in the UI yet.** The design's dialog has no
   field for them; existing passbands are kept on save.

6. **Node version.** `@nestjs/cli` 12 asks for Node ≥ 24.15; it ran on 24.13
   with only an engine warning.

## Subject 1 (Conditions) — shipped

The end-to-end conditions view is built and runs:
`getDarkWindow → fetchForecast → adaptForecast → analyzeNight → describeNight`,
wired by `features/conditions/hooks/useTonight.ts` and rendered by dumb
components (NightCard, ObservationWindowBar, SkyQualityCurve, HourlyTable,
ModelPicker) under an MUI dark theme. Verified end-to-end against the live API,
`npm run build`/`lint`/`test` all green.

## Equipment and rigs (ADR 0004) — shipped

Done, in order:

1. Monorepo: Vite app moved to `apps/web`, root npm workspaces.
2. `apps/shared`: enums + zod schemas (+ later response types and `validateRig`).
3. `apps/api` skeleton: NestJS + TypeORM, `common/`, `config/`.
4. `AuthModule`: Google sign-in, sessions, guard.
5. `EquipmentModule`: thread sizes, equipment + specs + threads.
6. Rigs: entities, `RigValidator` (delegates to shared `validateRig`), `RigService`.
7. Migration `1792783457511-Init` generated and applied; CHECK-change detection
   verified (ADR 0004 "To verify").
8. Frontend: `/equipment` page from the Claude Design kit.

Running it locally: `docker compose up -d` in `apps/api`, fill `apps/api/.env`
and `apps/web/.env.local`, then `npm run dev:api` and `npm run dev`. See README.

Hosting (ADR 0004 section 13): Vercel, web and API as two services of one
project on `sterenn-astro.bzh`, API under `/api`, Neon Postgres in Frankfurt.
Not yet deployed. Still to verify on the first deploy: that Vercel installs the
whole workspace for one service, and that the NestJS build runs with our own
`buildCommand`.

## Next brick

Subject 2 — **Moon** (per `docs/ROADMAP.md`): illumination / phase / rise-set via
suncalc (already a dependency). Build `core/moon` pure + tested first, then
surface it (likely as a column/section inside the conditions view, as the
roadmap notes it may start there before graduating to its own subject).

Possible polish: an `analyzeNight` config UI; a passband editor for filters;
tests for `validateRig` and the API services.

Keep components dumb: they render, they don't compute. All logic stays in
`core/`, `apps/shared` and the hook.
