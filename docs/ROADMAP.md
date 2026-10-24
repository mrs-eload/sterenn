# Roadmap

Every subject discussed for sterenn, with build flags. **Keep this updated** —
when a flag flips, edit it here in the same commit. This is the at-a-glance map;
`docs/STATUS.md` holds the detailed state of the *current* subject.

**Flags:** ✅ done · ⚙️ partial · ⬜ not started · n/a not applicable
**Last updated:** 2026-10-23

## Subjects

### 1. Conditions — "tonight's conditions" _(shipped ✅)_

The first subject. Fixes Ouranos's "any clear hour = good night" flaw by detecting
the longest contiguous clear block ≥3h. See ADR 0001 (design), ADR 0002 (data
layer, now live-verified), STATUS.md (detail).

| Piece | UI | Logic | API |
|---|---|---|---|
| Dark window (twilight, suncalc) | n/a | ✅ | — |
| Night analysis (the Ouranos fix) | n/a | ✅ | — |
| Verdict/reason (too-cloudy vs too-short) | n/a | ✅ | — |
| Weather fetch + adapter | n/a | ✅ live-verified | Open-Meteo (keyless) |
| Model picker | ✅ | ✅ registry done | Open-Meteo |
| UI: night card, hourly table, observation-window bar, sky-quality curve | ✅ | n/a | — |

**Done.** Optional later polish: a location picker (the `useTonight` hook already
takes `lat`/`lon`) and an analysis-config UI. Neither blocks the subject.

### 2. Moon

| Piece | UI | Logic | API |
|---|---|---|---|
| Illumination, phase, rise/set (suncalc) | ⬜ | ⬜ | — |
| UI surfacing | ⬜ | ⬜ | — |

Note: suncalc is already a dependency. Some moon data already feeds the
conditions module conceptually (the moon-illumination column in the Ouranos
screenshot), so this may start as part of conditions and graduate to its own
subject.

### 3. Target planning — "what's up tonight"

| Piece | UI | Logic | API |
|---|---|---|---|
| Target positions, altitude curves, transit/rise-set | ⬜ | ⬜ | — |
| UI: target list, altitude-vs-time chart | ⬜ | ⬜ | — |

**Library:** graduate to `astronomy-engine` here (per ADR 0001) — suncalc covers
sun/moon, but planets/DSO positioning needs the heavier lib. Local, no API.

### 4. Rig tools

| Piece | UI | Logic | API |
|---|---|---|---|
| FOV / framing calculator | ⬜ | ⬜ | — |
| Exposure / sub-length helper | ⬜ | ⬜ | — |

Pure geometry and math. The user's rig (Askar SQA55 + ASI585MC Pro) gives the
sensor/focal-length constants. Local, no API.

### 4b. Equipment and rigs _(shipped ✅)_

| Piece | UI | Logic | API |
|---|---|---|---|
| Monorepo (`apps/web`, `apps/api`, `apps/shared`) | n/a | ✅ | — |
| Shared enums, zod schemas, response types | n/a | ✅ | — |
| Google sign-in + sessions | ✅ | ✅ live-verified | own API (NestJS) |
| Equipment, thread sizes | ✅ | ✅ | own API (NestJS) |
| Rigs + rig rules (`validateRig`, shared) | ✅ | ✅ | own API (NestJS) |

The first persistent data, and the first backend: NestJS + TypeORM on
PostgreSQL. Spec: ADR 0004. Screens built from the Claude Design kit
(`ui_kits/equipment`). Open: hosting provider. Polish later: passband editor,
tests. The rig tools of subject 4 (FOV, exposure) can now read real equipment
specs from here.

### 5. Session planner _(full dashboard)_

| Piece | UI | Logic | API |
|---|---|---|---|
| Aggregate conditions + moon + targets into one plan | ⬜ | ⬜ | depends on the above |

The "everything" view. Build last — it composes the other subjects. No new API
of its own; inherits Open-Meteo from conditions.

## API summary

External APIs: **Open-Meteo** (conditions weather), keyless and CORS-open.
Twilight, moon, target positions, FOV and exposure stay **local computation**
via suncalc / astronomy-engine / plain math.

Own API: **`apps/api`** (NestJS + TypeORM + PostgreSQL) for equipment, rigs and
Google sign-in. See ADR 0004.

## Build order (recommended)

1. ~~Finish **Conditions UI** + live-API verification → ship subject 1.~~ ✅ Done.
2. **Moon** (cheap, suncalc already present, complements conditions). ← next.
3. **Target planning** (introduces astronomy-engine).
4. **Rig tools** (self-contained, no dependency on others).
5. **Session planner** (composes everything).

One subject at a time. Don't start a subject before the previous one ships unless
explicitly redirected.
