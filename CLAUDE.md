# CLAUDE.md

Operating guide for AI agents (and humans) working in this repo. Read this, then
`docs/STATUS.md` for current state, `docs/ROADMAP.md` for all subjects and build
order, then the ADRs in `docs/adr/` for the *why*.

## What this project is

`sterenn` — an astrophotography web app, built **one subject at a time**. Shipped
so far: "tonight's conditions" and "equipment and rigs". Don't scope-creep into
other subjects unless asked.

**Stack:**

- **Web** (`apps/web`): React 19, Vite, TypeScript (strict), MUI for UI, Vitest
  for tests.
- **API** (`apps/api`): NestJS + TypeORM on PostgreSQL, Google sign-in with a
  session cookie. Spec: ADR 0004.
- **Shared** (`apps/shared`): enums, zod schemas, response types and the rig
  rules, used by both web and API.

## Repository layout

npm workspaces monorepo, one `npm install` at the root, one lockfile:

```
apps/web      the Vite app
apps/api      the NestJS API (+ migrations/, docker-compose.yml for local Postgres)
apps/shared   enums, zod schemas, response types, rig rules (built to dist/ first)
docs/         STATUS, ROADMAP, ADRs
```

`apps/shared` is compiled before the others consume it (`npm run build:shared`;
`dev`, `dev:api` and `build` do it for you). After changing anything in
`apps/shared/src`, rebuild it or the web and API see the old version.

## Web architecture — the one rule that matters

**Domain logic is framework-free and lives apart from React.** The data flows one
direction only (paths under `apps/web/src/`):

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
  an external API's field names leak past `data/`. Our own API
  (`data/sterennApi`) needs no adapter: its bodies are the `@sterenn/shared`
  types.
- **`features/<subject>/`** — one folder per subject. A hook chains `data/` +
  `core/`; components are dumb (render props, no computation, no fetching).

**Do not** create new top-level `components/`, `hooks/`, or `lib/` folders until
something is shared by **two** features. Premature shared folders are how this
stays not-simple. Promote on second use, not first.

Logic needed by **both** web and API (the rig rules) goes in `apps/shared`, not
in either app.

## API architecture

Follow ADR 0004 section 4 exactly: modules `AuthModule` and `EquipmentModule`;
TypeORM entities are the domain model; one abstract repository + TypeORM
implementation per aggregate; one service per repository; services contain no
HTTP code and no SQL (they throw `NotFoundError` / `ValidationError` from
`common/domain-errors.ts`, which `DomainErrorFilter` maps to responses). Request
bodies are validated with the shared zod schemas through `ZodValidationPipe`.
The session guard is global; only `@Public()` routes skip it.

## Naming conventions (new code, ADR 0004 section 1)

`snake_case` variables and properties, `camelCase` functions, `PascalCase`
classes and types, `UPPER_SNAKE_CASE` constants, enums `PascalCase` with
`UPPER_SNAKE_CASE` members. Never use the word `kind` for a field; the
discriminator is `type`. Existing code is not renamed.

## Commands

Run from the repo root:

```bash
npm run dev           # build shared, then the Vite dev server (http://localhost:5173/sterenn/)
npm run dev:api       # build shared, then the API in watch mode (http://localhost:3000)
npm test              # Vitest once, web (MUST pass before any commit)
npm run test:watch    # Vitest watch
npm run lint          # ESLint, web
npm run build         # shared, web (tsc -b && vite build), api (also a typecheck gate)

# database (in apps/api)
docker compose up -d                                              # local Postgres 17
npm run migration:generate -w @sterenn/api -- migrations/<Name>   # after an entity change
npm run migration:run -w @sterenn/api                             # the API also runs pending ones at startup
```

Local env files (gitignored): `apps/api/.env` (from `.env.example`) and
`apps/web/.env.local` (from `apps/web/.env.example`).

## Hard rules — do not violate

1. **Tests are not optional.** Every `core/` and `data/` module ships with a
   `.test.ts`. Run `npm test` before committing. A green suite is the contract.
   When you fix a bug, add the test that would have caught it (see the
   prefix-collision test in `adapter.test.ts` — that's the standard).

   **Verification step is TS-check only.** When verifying a change in progress,
   run the typecheck (`npm run build`) — do **not** run `npm test`. Save the full
   suite for the commit gate above, not for routine verification.

2. **Verify, don't assume.** This codebase was built by actually running the code
   and catching real bugs (a prefix collision, a suncalc import shape, a latitude
   edge case). Don't hand-wave that something "should work" — run it. If you can't
   run it (e.g. no network to an API), say so explicitly and mark the code as
   unverified, like ADR 0002 does. Never present unverified output as verified.

3. **Keep `core/` pure.** If you're about to import React, MUI, or `fetch` into
   anything under `core/`, stop — it belongs in `features/` or `data/`.

4. **Type-only imports.** `verbatimModuleSyntax` is on in `apps/shared`: import
   types with `import type { Foo }`. It is off in `apps/web` and `apps/api` (the
   API is CommonJS, where it forbids `import` syntax), but keep using
   `import type` for type-only symbols there too. In the API, never `import type`
   a class that Nest injects: decorator metadata needs the value import.

5. **suncalc has no default export.** Use `import * as SunCalc from 'suncalc'`.
   It exposes named functions (`getTimes`, `getMoonIllumination`, `getMoonTimes`).

6. **Times are epoch milliseconds internally.** Open-Meteo returns unixtime
   *seconds*; the adapter multiplies by 1000. `HourPoint.time` and `DarkWindow`
   are always ms. Don't mix units.

7. **Secrets stay out of the repo.** Open-Meteo needs no key. The API's config
   lives in `apps/api/.env` (gitignored). The Google client ID is public; there
   is no client secret in this app and none should be added (sign-in uses the ID
   token only, ADR 0004 section 5). Don't add new backend services, keys or
   modules beyond ADR 0004 unless the task explicitly calls for it.

8. **Schema changes go through migrations.** `synchronize` is off. Change the
   entity, generate a migration, review the SQL, commit it.

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
- Don't type check or build or launch dev server, I'll tell you if there is an issue.

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
- **The rig rules are written once**, in `apps/shared/src/rules/validate-rig.ts`.
  The API's `RigValidator` and the web rig editor both call it. Change the rules
  there, never in one app only. Thread matching (rule b) is literal to the ADR:
  any thread of one part with any thread of the next, same size, opposite gender.
- **Deleting equipment never deletes a rig.** Chain items and rig filters go
  with it; mount and guide references become null and the rig reports errors
  ("incomplete"). A thread size still used by a thread cannot be deleted (409).

## When unsure

Ask, or write down the assumption and mark it. Don't silently guess on domain
math (twilight, integration time, weather thresholds) — wrong astronomy looks
right until someone's outside at 2am with a clear sky the app called bad.
