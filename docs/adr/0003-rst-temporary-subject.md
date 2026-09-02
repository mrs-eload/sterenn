# ADR 0003 — RST tracking as a temporary, self-contained subject

**Status:** Accepted
**Date:** 2026-08-30
**Module:** `src/features/rst/` (+ route wiring)

---

## Context

A spacecraft — the **Nancy Grace Roman Space Telescope (RST)** — launched today,
and we want a short-lived section of the app to track it. This is explicitly a
**temporary side subject**, not a roadmap item (`docs/ROADMAP.md` is untouched):
it should be easy to add now and, more importantly, **easy to delete later**
without leaving traces or risking the shipped Conditions subject.

The data source, its API, and the spacecraft id **were not available when the
scaffold was built**. So this ADR records the *structure and the isolation
contract*; the data layer is deliberately stubbed and marked, not guessed at.

## Decision

### 1. One deletable folder: `src/features/rst/`

Everything for the subject lives under `features/rst/`. It does **not** use the
shared `core/` or `data/openMeteo` layers, and it adds **nothing** to them. The
Conditions pipeline (`core/sky`, `data/openMeteo`) is untouched. Retiring RST is
therefore: delete `src/features/rst/`, delete `src/pages/Rst.tsx`, and remove the
four one-line route/nav entries (all tagged with a "temporary" comment). No other
file carries subject logic.

This intentionally **trades the "promote shared code on second use" rule for
deletability**. RST is temporary, so its types and pure logic are kept local to
the feature rather than lifted into `core/` — coupling it to `core/` would make
it un-deletable. The one architectural rule that still holds is the direction of
data flow (below).

### 2. The layering is replicated *inside* the feature

The app's `data → core → features` separation is reproduced as folders within
`features/rst/`, so the subject still separates input / mapping / logic / UI:

```
features/rst/
  data/rstApi.ts    INPUT  — the only place that touches the network (fetch)
  data/adapter.ts   MAP    — pure wire→domain; source field names never leak out
  logic/track.ts    LOGIC  — pure, clock-injected, unit-tested (isStale)
  types.ts          domain shape (local, provisional)
  hooks/useRstTracking.ts   orchestration: chains data → adapter, owns request state
  components/TrackingCard.tsx  dumb render, computes nothing
  RstView.tsx       the screen; owns the hook, threads output to widgets
```

Same conventions as the rest of the app: internal time is **epoch milliseconds**,
type-only imports, pure logic testable with zero mocking (`logic/track.test.ts`).

### 3. Route + nav wiring (four tagged lines)

- `routes/paths.ts` — `rst: '/rst'`
- `routes/router.tsx` — lazy `Rst` page + a `/rst` route child
- `routes/sitemap.ts` — a nav item (`RST`, `mingcute:rocket-line`)
- `pages/Rst.tsx` — thin route entry that renders `<RstView />`

Each is commented as temporary so the deletion path is obvious.

### 4. The data layer is stubbed and honestly disabled — NOT faked

`rstApi.ts` holds `RST_API_BASE` and `RST_SPACECRAFT_ID` as empty `TODO(api)`
constants. While empty, `isConfigured()` is `false`: the hook seeds to a
`not-configured` state and the view shows an "awaiting source" placeholder. The
fetch path is written and ready, but **no endpoint, id, or payload schema is
invented**. When the real source is supplied, the change is confined to
`rstApi.ts` (endpoint/id/request) and `adapter.ts` (wire→domain mapping); the
domain type in `types.ts` currently carries only a `timestamp` plus the raw
payload passthrough, replaced with real fields at that point.

## Status / verification

- ✅ Route reachable; nav item renders; `not-configured` placeholder shows.
- ✅ `logic/track.ts` pure + unit-tested.
- ⏳ **Unverified — no live source yet.** The fetch/adapter/domain shape are
  placeholders pending the API, id, and payload. This is called out here and in
  `TODO(api)` markers rather than presented as working (per CLAUDE.md rule 2).

## Consequences

- Zero blast radius on Conditions: nothing shared was modified.
- Deletion is mechanical and total (one folder + one page + four tagged lines).
- The roadmap and subject-at-a-time discipline are preserved — RST is a labelled
  detour, not a new roadmap subject.
