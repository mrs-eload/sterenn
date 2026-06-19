# CLAUDE.md

Operating guide for AI agents (and humans) working in this repo. Read this, then
`docs/STATUS.md` for current state, `docs/ROADMAP.md` for all subjects and build
order, then the ADRs in `docs/adr/` for the *why*.

## What this project is

`sterenn` — an astrophotography web app, built **one subject at a time**. Current
subject: "tonight's conditions". Don't scope-creep into other subjects unless
asked.

**Stack:** React 19, Vite, TypeScript (strict, `verbatimModuleSyntax` on), MUI
for UI, Vitest for tests. NestJS is **not** in use and should not be added unless
a specific API genuinely requires a server-side proxy (none has so far).

## Architecture — the one rule that matters

**Domain logic is framework-free and lives apart from React.** The data flows one
direction only:

```
data/      (fetch + map external APIs)  →
core/      (pure astronomy/sky logic, ZERO React/MUI/fetch)  →
features/  (UI: hooks wire data+core, components just render)
```

- **`core/`** — pure functions. No `fetch`, no React, no MUI, no `Date.now()`
  baked into logic. Everything here is unit-testable with zero mocking. This is
  the part that's actually the product (e.g. the Ouranos fix). Protect its purity.
- **`data/`** — the *only* place that touches the network. Fetch in one file, a
  **pure** adapter that maps the wire shape to our own types in another. Never let
  an external API's field names leak past `data/`.
- **`features/<subject>/`** — one folder per subject. A hook chains `data/` +
  `core/`; components are dumb (render props, no computation, no fetching).

**Do not** create top-level `components/`, `hooks/`, or `lib/` folders until
something is shared by **two** features. Premature shared folders are how this
stays not-simple. Promote on second use, not first.

## Commands

```bash
npm run dev          # Vite dev server
npm test             # Vitest once (MUST pass before any commit)
npm run test:watch   # Vitest watch
npm run lint         # ESLint
npm run build        # tsc -b && vite build (also a typecheck gate)
```

## Hard rules — do not violate

1. **Tests are not optional.** Every `core/` and `data/` module ships with a
   `.test.ts`. Run `npm test` before committing. A green suite is the contract.
   When you fix a bug, add the test that would have caught it (see the
   prefix-collision test in `adapter.test.ts` — that's the standard).

2. **Verify, don't assume.** This codebase was built by actually running the code
   and catching real bugs (a prefix collision, a suncalc import shape, a latitude
   edge case). Don't hand-wave that something "should work" — run it. If you can't
   run it (e.g. no network to an API), say so explicitly and mark the code as
   unverified, like ADR 0002 does. Never present unverified output as verified.

3. **Keep `core/` pure.** If you're about to import React, MUI, or `fetch` into
   anything under `core/`, stop — it belongs in `features/` or `data/`.

4. **Type-only imports.** `verbatimModuleSyntax` is on. Import types with
   `import type { Foo }`. A plain `import { Foo }` for a type-only symbol is a
   compile error here.

5. **suncalc has no default export.** Use `import * as SunCalc from 'suncalc'`.
   It exposes named functions (`getTimes`, `getMoonIllumination`, `getMoonTimes`).

6. **Times are epoch milliseconds internally.** Open-Meteo returns unixtime
   *seconds*; the adapter multiplies by 1000. `HourPoint.time` and `DarkWindow`
   are always ms. Don't mix units.

7. **No secrets, no backend creep.** Open-Meteo needs no key. Don't introduce API
   keys, `.env` secrets, or a server unless the task explicitly calls for it.

## Code style

- Prose-clear names over clever ones. `longestContiguousClearBlock`, not `lccb`.
- Comments explain **why**, not what. The non-obvious decisions (gap budget,
  precip-as-hard-break, pessimistic missing-data default, prefix-collision) all
  carry a comment explaining the reasoning. Match that bar.
- Small pure functions over big stateful ones. If a function both fetches and
  transforms, split it.
- Config objects with sane defaults over long positional arg lists (see
  `AnalyzeConfig`).
- Don't reformat code you're not changing. Keep diffs tight and reviewable.

## Domain gotchas (will bite you if you don't know them)

- **A clear night can still be `good: false`.** At Brittany's latitude (~47.8°N),
  June has < 3h of astronomical darkness, so the dark window itself is shorter
  than the minimum integration block. That's correct behaviour, not a bug. See
  `docs/STATUS.md`.
- **`getDarkWindow` can return `null`** — when there's no astronomical night at
  all (far north / midsummer). Callers must handle null, not assume a window.
- **Open-Meteo multi-model suffixes variables** (`cloud_cover_<slug>`). The
  adapter discovers these at runtime. If you touch `data/openMeteo`, re-read
  ADR 0002 first — there are two caveats still unverified against the live API.

## When unsure

Ask, or write down the assumption and mark it. Don't silently guess on domain
math (twilight, integration time, weather thresholds) — wrong astronomy looks
right until someone's outside at 2am with a clear sky the app called bad.
