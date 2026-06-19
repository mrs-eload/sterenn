# ADR 0002 — Open-Meteo data layer (as built)

**Status:** Accepted
**Date:** 2026-06-19
**Supersedes the data-source section of:** ADR 0001 (which described the plan; this records the implementation)
**Module:** `src/data/openMeteo/`

---

## Context

ADR 0001 decided: fetch conditions from Open-Meteo (keyless, CORS-open, no
backend), multi-model picker via the `models=` param. This ADR records how that
was actually implemented and the sharp edges found while building it.

## What was built

Three files plus a barrel, under `src/data/openMeteo/`:

- **`models.ts`** — the weather-model registry for the picker (`best_match`,
  `ecmwf_ifs025`, `ecmwf_ifs04`, `meteofrance_arome_france`, `icon_global`,
  `icon_eu`, `ukmo_global_deterministic_10km`), the requested hourly variables
  (`cloud_cover`, `precipitation`, `precipitation_probability`), and defaults.
- **`client.ts`** — `buildForecastUrl()` + `fetchForecast()`, plus the wire
  types. Requests `timeformat=unixtime` and `timezone=GMT` so the adapter never
  parses timezones. `forecast_days` defaults to 2 (the dark window crosses
  midnight, so tonight + margin).
- **`adapter.ts`** — `adaptForecast(res, { requestedModels })` → pure mapping to
  `Record<modelId, HourPoint[]>`. No network, fully unit-tested.

## Key implementation decisions

### Runtime model-suffix discovery (not a hardcoded slug list)

When multiple models are requested, Open-Meteo suffixes each variable with the
model slug: `cloud_cover_ecmwf_ifs025`, `cloud_cover_meteofrance_arome_france`,
etc. A single model returns bare keys: `cloud_cover`.

The adapter **discovers** which models are present by scanning the `hourly` keys
and stripping known base-variable prefixes — it does NOT trust the registry slug
list. Consequence: if Open-Meteo renames a slug, parsing still works; only the
picker label in `models.ts` would need updating. The data flow degrades
gracefully instead of silently dropping a model.

### Prefix-collision fix (the bug that proves the tests earn their keep)

`precipitation_probability` *starts with* `precipitation`. Naive
longest-prefix-wins-by-declaration-order matching parsed the key
`precipitation_probability` as base `precipitation` + suffix `probability`,
inventing a phantom model called "probability". Fix: match base variables
**longest-first** (`BASE_VARS_BY_LENGTH`). Covered by the multi-model test.

### Missing data → pessimistic

A `null`/missing `cloud_cover` value maps to `cloudCover: 100` (overcast), so a
data gap never accidentally reads as a clear sky. Precip fields default to 0.

## ✅ Verified against the live API (2026-06-20)

Both caveats below were confirmed with a live multi-model call to
`api.open-meteo.com` for Brittany (48.2, -4.1). Results:

1. **Multi-model suffix shape** — confirmed exactly as documented:
   `cloud_cover_<slug>`, `precipitation_<slug>`, `precipitation_probability_<slug>`,
   with a single shared `time` array. `adaptForecast` handles it unchanged.
2. **Model slugs** — confirmed working (non-null data): `best_match`,
   `ecmwf_ifs025`, `meteofrance_arome_france`, `icon_eu`, `icon_global`,
   `ukmo_global_deterministic_10km`.
   - **One slug was dead:** `ecmwf_ifs04` returned all-null `cloud_cover`
     (Open-Meteo retired the 0.4° HRES product). Replaced in the registry with
     `ecmwf_aifs025_single` (ECMWF AIFS 0.25°). Note the `_single` suffix: the
     plain `ecmwf_aifs025` exposes only upper-air levels, so its `cloud_cover`
     came back all-null too — surface variables live on the `*_single` model.
   - **Observed nicety:** some models omit a variable entirely (e.g. UKMO has no
     `precipitation_probability` → all null). The adapter's `numOr` default (0 for
     precip) covers this; missing `cloud_cover` still defaults to 100 (pessimistic).

This confirms the runtime-suffix-discovery design (ADR decision above) earns its
keep: a retired slug degraded to one empty picker row instead of breaking parsing.

## Consequences

- Conditions module still ships as a static SPA. No NestJS.
- `adapter.ts` is pure and source-agnostic — swapping/adding weather providers
  touches only `src/data/`, never `core/` or `features/`.
- The full pipeline now exists end-to-end except live confirmation and UI:
  `getDarkWindow → fetchForecast → adaptForecast → analyzeNight`.
