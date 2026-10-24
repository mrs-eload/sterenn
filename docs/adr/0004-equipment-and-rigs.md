# ADR 0004: Equipment and rigs module, backend, and sign-in

- Status: accepted
- Date: 2026-10-10, updated 2026-10-20, 2026-10-23 (decisions in section 12, implementation notes)
- Decided by: Elo
- Target path in the repo: `docs/adr/0004-equipment-and-rigs.md`

## How to use this document

This is the specification for the equipment and rigs module. Every item under "Decisions" was explicitly agreed. Implement those as written.

Anything listed under "Not decided" has no answer yet. Do not pick one. Ask Elo.

Anything listed under "Out of scope" must not be built or designed as part of this work.

## Context

Sterenn is a personal astrophotography web app. Until now it was a single React + Vite + TypeScript app with no backend and no stored data. This module adds the first persistent data: pieces of equipment, and rigs assembled from them.

The app is built for one person. It will be reachable on the public internet, so the API must not be usable by anyone else.

The database engine and the hosting provider are not chosen yet. The database will be whatever the chosen host offers. Everything below has to work without knowing which database it is.

## Decisions

### 1. Naming conventions

These apply to all new code. Existing code is not renamed as part of this work; that will be handled separately.

| What | Convention | Example |
|---|---|---|
| Variables and properties | `snake_case` | `pixel_size_um`, `owner_id` |
| Methods and functions | `camelCase` | `findById()`, `sqlList()` |
| Classes and types | `PascalCase` | `Equipment`, `RigValidator`, `CreateEquipmentInput` |
| Constants | `UPPER_SNAKE_CASE` | `SESSION_LIFETIME_DAYS` |
| Enums | `PascalCase` name, `UPPER_SNAKE_CASE` members | `SensorColor.MONO` |

Consequences:

- Entity properties have the same names as their database columns. No `name:` option is needed on `@Column`.
- API request and response bodies use `snake_case` keys, because the zod schemas use the property names.
- Names imposed by libraries keep their own casing: TypeORM and NestJS options (`onDelete`, `nullable`), React built-in props (`className`, `onClick`). Props of our own React components follow the table above.
- Never use the word `kind` for a field, column, variable or in documentation. The discriminator is called `type`.
- No ESLint rule enforces these conventions.

### 2. Repository layout

The repo becomes an npm workspaces monorepo:

```
apps/web      the existing Vite app, moved from the repo root
apps/api      the new NestJS API
apps/shared   enums and zod schemas used by both web and api
```

Root `package.json` declares `"workspaces": ["apps/*"]`. One `npm install` at the root, one lockfile.

### 3. Backend stack

- NestJS for the API.
- TypeORM for database access.
- Database engine: PostgreSQL (decided 2026-10-23, see section 12). The portability rules still apply: use only column types and features that work on any SQL database TypeORM supports. No database-specific types, no native database enum columns, no database-specific indexes.

### 4. Backend architecture

The backend follows domain-driven design, kept to the parts below.

**Modules.** Two NestJS modules:

- `AuthModule`: the user, sessions, Google sign-in, and the session guard used by every other route.
- `EquipmentModule`: equipment and its specs, threads, thread sizes, and rigs. Rigs are part of this module, not a separate one.

`EquipmentModule` does not import anything from `AuthModule` except the session guard and the current user's id. It stores that id in `rig.owner_id` and nothing else about the user.

**Domain model.** The TypeORM entities are the domain model. There are no separate domain classes and no mappers between domain and persistence objects. As a result, entity files import `typeorm` for their decorators. That is accepted.

**Repositories.** Each group of entities that is always loaded and saved together has exactly one repository. The other entities in the group have no repository of their own and are saved through the main entity by TypeORM cascade.

| Repository | Saves and loads | Through cascade |
|---|---|---|
| `EquipmentRepository` | `Equipment` | its specs entity, its `EquipmentThread` rows |
| `ThreadSizeRepository` | `ThreadSize` | nothing |
| `RigRepository` | `Rig` | its `RigChainItem` and `RigFilter` rows |

There is no `EquipmentThreadRepository`, `RigChainItemRepository` or `RigFilterRepository`. A rig refers to equipment by id and never modifies equipment.

Each repository is an abstract class (used as the NestJS injection token) with a TypeORM implementation:

```ts
export abstract class EquipmentRepository {
  abstract save(item: Equipment): Promise<Equipment>;
  abstract findById(id: string): Promise<Equipment | null>;
}

// equipment.module.ts
providers: [{ provide: EquipmentRepository, useClass: TypeormEquipmentRepository }]
```

**Services.** One service per repository: `EquipmentService`, `ThreadSizeService`, `RigService`, plus `AuthService`. Each action (create, update, delete, list, save a rig…) is a method on the relevant service. Services contain no HTTP code and no SQL.

**Rig rules.** The rules in section 10 live in a `RigValidator` class in `rules/`. `RigService.save` loads the rig's parts through `EquipmentRepository`, calls the validator, then saves through `RigRepository`.

**Not used:** CQRS (no command or query bus, no `@nestjs/cqrs`), and value objects (grouped fields such as backfocus stay as plain properties on the entity).

**Folder layout:**

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── zod-validation.pipe.ts
│   │   ├── decimal.transformer.ts
│   │   └── sql-list.ts
│   ├── config/
│   │   ├── env.ts
│   │   └── data-source.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── controllers/
│   │   │   └── auth.controller.ts
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   └── google-token.verifier.ts
│   │   ├── entities/
│   │   │   ├── user.entity.ts
│   │   │   └── session.entity.ts
│   │   ├── repositories/
│   │   │   ├── user.repository.ts
│   │   │   ├── typeorm-user.repository.ts
│   │   │   ├── session.repository.ts
│   │   │   └── typeorm-session.repository.ts
│   │   └── session.guard.ts
│   └── equipment/
│       ├── equipment.module.ts
│       ├── controllers/
│       │   ├── equipment.controller.ts
│       │   ├── thread-size.controller.ts
│       │   └── rig.controller.ts
│       ├── services/
│       │   ├── equipment.service.ts
│       │   ├── thread-size.service.ts
│       │   └── rig.service.ts
│       ├── entities/
│       │   ├── equipment.entity.ts
│       │   ├── equipment-thread.entity.ts
│       │   ├── specs/
│       │   │   ├── mount.entity.ts
│       │   │   ├── telescope.entity.ts
│       │   │   ├── camera.entity.ts
│       │   │   ├── filter-holder.entity.ts
│       │   │   ├── filter.entity.ts
│       │   │   └── corrector.entity.ts
│       │   ├── thread-size.entity.ts
│       │   ├── rig.entity.ts
│       │   ├── rig-chain-item.entity.ts
│       │   └── rig-filter.entity.ts
│       ├── rules/
│       │   └── rig-validator.ts
│       └── repositories/
│           ├── equipment.repository.ts
│           ├── typeorm-equipment.repository.ts
│           ├── thread-size.repository.ts
│           ├── typeorm-thread-size.repository.ts
│           ├── rig.repository.ts
│           └── typeorm-rig.repository.ts
├── migrations/
└── test/

apps/shared/src/
├── enums/
└── schemas/
```

`session.guard.ts` sits at the root of `auth/` because other modules use it. `google-token.verifier.ts` is in `services/` because it calls Google and stores nothing.

### 5. Sign-in and sessions

Sign-in is Google only. There are no passwords.

Flow:

1. The frontend shows a "Sign in with Google" button. Google returns an ID token to the frontend.
2. The frontend posts the ID token to the API.
3. The API verifies the token with `google-auth-library` (`verifyIdToken`: signature, `aud` equal to the app's Google client ID, `iss`, expiry).
4. The API identifies the account by the token's `sub` field, not by email.
5. Only one Google account is allowed in. Its email address is set in an environment variable. The first sign-in whose email matches creates the single `app_user` row and stores its `sub`. Any other Google account is refused.
6. On success the API creates a `session` row and sets a cookie.

Sessions:

- The cookie holds a random value. The database stores only a hash of it (`session.token_hash`).
- The cookie is HttpOnly, Secure and SameSite.
- Each request: the API hashes the cookie value, finds the session row, checks `expires_at`, then updates `last_used_at` and pushes `expires_at` forward.
- Lifetime: 30 days, extended on each use.
- Logout deletes the session row and clears the cookie.
- There are no access tokens, refresh tokens or JWTs issued by this API. Google access and refresh tokens are not requested and not stored.

Access rules:

- Every route except the sign-in route requires a valid session. Without one the API answers 401.
- The frontend holds no secret. The Google client ID is public.
- CORS allows only the frontend's origin to call the API with credentials.

Single user: there is no role column and no sign-up route.

### 6. Data model

Conventions:

- `?` means the column is optional (nullable). Everything else is required.
- All primary keys are UUIDs, except where a table's primary key is a foreign key or a composite, as shown.
- Units are in the column names: millimetres, micrometres, nanometres, grams. All weights are in grams.
- The user table is named `app_user` because `user` is a reserved word in several databases.

```
── account and sessions ──────────────────────────────

app_user                          -- one row
  id          PK
  google_sub  text, UNIQUE        -- Google's permanent id for the account
  email       text                -- display only
  created_at  timestamp
  updated_at  timestamp

session
  id            PK
  user_id       FK app_user
  token_hash    text, UNIQUE
  expires_at    timestamp
  last_used_at  timestamp
  user_agent    text ?
  created_at    timestamp

── reference data ────────────────────────────────────

thread_size                       -- a thread dimension, e.g. M48x0.75
  id           PK
  diameter_mm  decimal
  pitch_mm     decimal
  name         text ?             -- common name, e.g. "T2"
  UNIQUE (diameter_mm, pitch_mm)

── equipment ─────────────────────────────────────────

equipment                         -- columns common to every item
  id            PK
  type          mount | telescope | camera | filter_holder | filter | adapter | corrector
  manufacturer  text
  model         text
  weight_g      integer ?
  notes         text ?
  created_at    timestamp
  updated_at    timestamp

mount
  equipment_id        PK, FK equipment
  mount_type          equatorial | alt_az
  goto                boolean
  payload_capacity_g  integer ?
  goto_precision      text ?

telescope                         -- used as main or guide telescope
  equipment_id              PK, FK equipment
  optical_design            refractor | reflector | catadioptric
  aperture_mm               decimal
  focal_length_mm           decimal
  backfocus_min_mm          decimal ?
  backfocus_max_mm          decimal ?
  backfocus_recommended_mm  decimal ?
  tube_length_mm            decimal ?

camera                            -- used as main or guide camera
  equipment_id      PK, FK equipment
  pixel_size_um     decimal
  resolution_x      integer
  resolution_y      integer
  sensor_color      mono | color
  sensor_chip       text ?        -- e.g. "Sony IMX585" (added 2026-10-23)
  cooled            boolean ?
  read_noise_e      decimal ?
  full_well_e       integer ?
  measured_at_gain  integer ?     -- gain setting at which the two values above were measured

filter_holder
  equipment_id              PK, FK equipment
  holder_type               wheel | drawer
  positions                 integer
  accepts_disc_diameter_mm  decimal ?   -- for unmounted filters

filter
  equipment_id      PK, FK equipment
  filter_type       L | R | G | B | Ha | OIII | SII | dual_band | other
  disc_diameter_mm  decimal ?           -- for unmounted filters
  passbands         json ?              -- [{ center_nm, bandwidth_nm }, ...]

corrector                         -- reducer, flattener, barlow
  equipment_id      PK, FK equipment
  focal_multiplier  decimal

-- adapter: a row in equipment with threads. It has no specs table.

equipment_thread                  -- a physical thread on a piece of equipment
  id              PK
  equipment_id    FK equipment
  thread_size_id  FK thread_size
  gender          male | female
  position        front | rear | inside
  notes           text ?

── rigs ──────────────────────────────────────────────

rig
  id                  PK
  owner_id            FK app_user
  name                text
  is_current          boolean, default false
  mount_id            FK mount ?
  guide_telescope_id  FK telescope ?
  guide_camera_id     FK camera ?
  created_at          timestamp
  updated_at          timestamp

rig_chain_item                    -- the optical parts, in order, telescope first, camera last
  rig_id        FK rig
  equipment_id  FK equipment
  sort_order    integer
  PK (rig_id, sort_order)

rig_filter                        -- the filters used in a rig
  rig_id     FK rig
  filter_id  FK filter
  holder_id  FK equipment ?       -- the chain item the filter sits in
  PK (rig_id, filter_id)
```

Notes on the model:

- A backfocus that is a single fixed value is stored with the same number in `backfocus_min_mm` and `backfocus_max_mm`.
- A mounted filter records its thread as an `equipment_thread` row. An unmounted filter records `disc_diameter_mm` instead.
- A piece of equipment can have any number of threads. A telescope can have a front thread and a rear thread; an adapter typically has a front thread, a rear thread and an inside thread that a filter screws into.
- A telescope or camera is not inherently "main" or "guide". The role comes from where the rig references it.
- Rigs have an owner. Equipment and thread sizes do not; they are shared.
- Any number of rigs can have `is_current = true`. Do not enforce a single current rig.
- `passbands` must be stored with a portable column type (TypeORM `simple-json`), not a database-specific JSON type.

### 7. How the tables are mapped in TypeORM

The layout is one shared `equipment` table plus one specs table per type, with the specs table's primary key being the equipment id.

Do not use TypeORM's entity inheritance feature (`extends` with `@TableInheritance`, or an abstract base entity) for this. That feature can only produce a single wide table or fully separate tables, and both were rejected (see "Rejected alternatives").

Write `Equipment` and each specs entity (`Mount`, `Telescope`, `Camera`, `FilterHolder`, `Filter`, `Corrector`) as separate entities joined by a one-to-one relation on `equipment_id`. Saving an equipment item saves its specs row and its threads with it, by cascade.

### 8. Fixed-choice columns

These columns accept a fixed list of values: `equipment.type`, `mount.mount_type`, `telescope.optical_design`, `camera.sensor_color`, `filter_holder.holder_type`, `filter.filter_type`, `equipment_thread.gender`, `equipment_thread.position`.

- Each list is a TypeScript string enum in `apps/shared/src/enums/`, written once:

  ```ts
  export enum SensorColor {
    MONO = 'mono',
    COLOR = 'color',
  }
  ```

- The zod validation (`z.enum(SensorColor)`), the frontend dropdown options and the database constraint are all derived from the enum (`Object.values(SensorColor)`). No list is typed out a second time anywhere.
- In the database each of these columns is a text column with a CHECK constraint whose expression is built from the enum's values.
- No lookup tables. No native database enum columns.
- CHECK expressions are raw SQL and the database is unknown, so write them portably (plain `column IN ('a', 'b')`, no database-specific quoting or functions).
- TypeScript enums are not allowed when the compiler option `erasableSyntaxOnly` is `true`. The existing `apps/web` config has it set to `false`; the new `apps/api` and `apps/shared` configs must also set it to `false`.

### 9. Deleting

- Deleting a piece of equipment deletes its specs row, its `equipment_thread` rows, and its rows in `rig_chain_item` and `rig_filter` (cascade).
- A rig is never deleted because one of its parts was deleted. `rig.mount_id`, `rig.guide_telescope_id` and `rig.guide_camera_id` are set to null when the referenced item is deleted. The rig stays and is reported as incomplete.

### 10. Rig rules checked by `RigValidator`

A rig consists at minimum of a mount, a telescope and a camera. `mount_id` is nullable in the database only so that a rig can survive the deletion of its mount.

When a rig is saved the validator checks:

a. The chain starts with exactly one telescope and ends with exactly one camera.
b. Neighbouring chain items share a thread size with opposite genders. A mismatch produces a warning. It does not block the save.
c. Each filter fits its holder: the holder has an `inside` thread of the same thread size and opposite gender as the filter's thread, or the holder's `accepts_disc_diameter_mm` equals the filter's `disc_diameter_mm`.
d. A holder does not contain more filters than its `positions`.

### 11. API

One route family for all equipment, whatever its type:

- `/equipment`: create, read, update, delete. The request body carries the common fields, the `type`, a type-specific specs object, and the item's threads.
- `/equipment` accepts optional filters on type and on thread size, so that all equipment having a given thread size can be listed. The filters are passed by the service to the repository, which applies them in the database query.

Other route families:

- `/thread-sizes`: create, read, update, delete.
- `/rigs`: create, read, update, delete. A rig is saved whole in one request, chain items and filters included.
- `/auth/google` (sign in), `/auth/logout`, `/auth/me`.

Validation: request bodies are validated with the zod schemas from `apps/shared`, through a `ZodValidationPipe` in `apps/api/src/common/`, not with NestJS's decorator-based validation. The allowed specs fields depend on `type`; the zod schema expresses that with a discriminated union on `type`.

### 12. Decided 2026-10-23

These were listed as "Not decided" and have since been answered.

- **Database engine:** PostgreSQL.
- **UUIDs:** generated by the application before saving (`@PrimaryColumn('uuid') id = randomUUID()`), so children saved by cascade can reference the id immediately.
- **Environment variables:** `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `ALLOWED_GOOGLE_EMAIL`, `WEB_ORIGIN` (the CORS origin), `PORT`.
- **Session token hash:** SHA-256 of a random 32-byte token. The token is high-entropy, so a slow password hash is not needed.
- **`apps/shared` compilation:** built first with `tsc` into `apps/shared/dist`; the API and web depend on it as the package `@sterenn/shared`.
- **`rig_filter.holder_id`** is set to null when the holder is deleted.
- **Deleting a thread size** that an `equipment_thread` still uses is refused by the database (`ON DELETE RESTRICT`). The API answers 409.
- **Decimal columns:** `numeric(10,3)`. **Text columns:** `varchar(255)`, except `notes` which is `text`.
- **`thread_size`** starts empty. No pre-filled rows.
- **Migrations:** generated by TypeORM from the entities (`migration:generate`), reviewed and committed, and applied at API startup (`migrationsRun: true`).
- **Routes.** Bodies are `snake_case`. Every route except `POST /auth/google` requires a session.

  | Route | Behaviour |
  |---|---|
  | `POST /auth/google` `{ id_token }` | Sign in, set the cookie, return `{ id, email }` |
  | `POST /auth/logout` | Delete the session, clear the cookie, 204 |
  | `GET /auth/me` | `{ id, email }`, or 401 |
  | `GET /equipment?type=&thread_size_id=` | List, both filters optional |
  | `GET /equipment/:id` | One item, with `specs` and `threads` |
  | `POST /equipment` | Create, 201 |
  | `PUT /equipment/:id` | Replace whole item (common fields, `specs`, `threads`). Changing `type` is a 400 |
  | `DELETE /equipment/:id` | 204 |
  | `GET /thread-sizes`, `GET/POST/PUT/DELETE /thread-sizes[/:id]` | Same pattern |
  | `GET /rigs`, `GET/POST/PUT/DELETE /rigs[/:id]` | The owner's rigs only. Saved whole, chain items and filters included |

- **Rig problems.** A save that breaks rule a, c or d, or lacks a mount, telescope or camera, is refused with a 400 listing the errors. Every rig response carries `problems: { errors, warnings }`, recomputed by `RigValidator` on read. Rule b mismatches are warnings. A rig made incomplete by a deletion shows as `errors.length > 0`.

### 13. Decided 2026-10-24

- **Hosting provider:** Vercel, one project with two services declared in the root `vercel.json`: `web` (the static Vite build, with an `index.html` fallback for client routes) and `api` (NestJS as a Vercel Function). Domain: `sterenn-astro.bzh`. GitHub Pages is dropped, so the Vite base is `/`.
- **Same domain for web and API:** `/api/*` is routed to the API and everything else to the web. Vercel passes the path through unchanged, so the API sets the global prefix `api` and every route in section 12 is served under `/api` (locally too: `http://localhost:3000/api`). The session cookie is `SameSite=Lax`; serving the API on the web app's own domain keeps it first-party. Production builds read `VITE_API_URL=/api` from `apps/web/.env.production`.
- **Database:** Neon PostgreSQL, Frankfurt, free plan, added through the Vercel Marketplace, which sets `DATABASE_URL` (the pooled connection string). Preview deployments get their own database branch, so a migration on a branch never reaches the production database. The functions region is Frankfurt (`fra1`), next to the database.
- **Entities and migrations are listed explicitly** in `config/data-source.ts`, not found by a file glob. Vercel ships only the files the entrypoint imports, so globbed files would be missing from the function. A new entity or migration must be added to these lists.
- **`WEB_ORIGIN`** is `https://sterenn-astro.bzh`. The Google OAuth client lists that origin, so sign-in works on the production domain only, not on preview URLs.

## Out of scope

Do not build or design any of these as part of this module:

- Screens and UI layout. They will be designed after the backend exists. (Done afterwards as separate work, see "Implementation notes".)
- Calculations: focal ratio, image scale, sensor size, field of view.
- Backfocus arithmetic along the chain.
- Checking equipment weight against the mount's payload capacity. Only the columns exist.
- Which filter is in which numbered slot of a filter wheel.
- A label or nickname on equipment. `notes` covers it.
- Observing sites or locations. They are not equipment.
- Multiple users, roles, sign-up, password login, password reset.
- Importing equipment specifications from an external database.
- Renaming existing code to the new naming conventions.

## Not decided

No answer exists for these yet. Ask before choosing.

- Nothing at the moment. The hosting provider was decided on 2026-10-24 (section 13).

## To verify during implementation

- ~~Whether TypeORM's migration generator detects a change in an existing CHECK constraint's expression when an enum changes.~~ **Verified 2026-10-23 (TypeORM 1.1.2, PostgreSQL 17): it does.** Adding a value to `MountType` generated a migration that drops the old CHECK and adds the new one; the constraint name is a hash of the expression. With no change, the generator reports no changes, so PostgreSQL's rewritten form of the stored expression does not cause false diffs.
- Whether Vercel installs from the repo root when it builds one service. Both services' build commands `cd ../..` to build `apps/shared` first, which assumes the whole workspace is installed. Also unverified: whether Vercel's NestJS build still compiles `src/main.ts` when the service sets its own `buildCommand`. Check both on the first deploy.
- TypeORM returns `decimal` columns as strings on some databases (PostgreSQL and MySQL among them). Each decimal column uses `decimal_column` from `common/decimal.transformer.ts`, which converts to and from `number`.

## Implementation notes (2026-10-23)

What the built code adds to, or chooses within, the decisions above.

- **Rig rules live in `apps/shared/src/rules/validate-rig.ts`** as the pure function `validateRig`. `RigValidator` (in `apps/api/src/equipment/rules/`, as section 4 requires) adapts entities to it and calls it; the web rig editor calls the same function to show checks live. One implementation, so the editor can never disagree with the API.
- **Rule b is applied literally:** any thread of one chain part with any thread of the next, same size, opposite gender. The design mock matched rear → front only; switching would change `matingThreadSize` only.
- **Additional checks in the validator:** the mount, guide telescope and guide camera must exist and be of the right type; a filter's holder must be in the chain; a filter must be a filter. Without them a wrong id surfaces as a bare foreign-key error.
- **Response types are in `apps/shared/src/responses.ts`** (`EquipmentResponse`, `RigResponse`, `ThreadSizeResponse`, `UserResponse`), so the web consumes the API without an adapter.
- **Domain errors.** Services throw `NotFoundError` / `ValidationError` (`common/domain-errors.ts`); `DomainErrorFilter` (`common/domain-error.filter.ts`) maps them to 404 / 400, and SQLSTATE 23505 / 23503 to 409. These two files are additions to the section 4 layout.
- **The session guard is global** (`APP_GUARD` in `AuthModule`); `POST /auth/google` opts out with `@Public()`. `@CurrentUserId()` gives other modules the user id only. The guard re-sends the cookie on each request so its browser expiry slides with the session. Cookie: `sterenn_session`, HttpOnly, Secure, `SameSite=Lax`.
- **`rig.owner_id`** references `app_user` through a relation named by string (`'User'`), so `EquipmentModule` imports no auth entity.
- **Module format.** `apps/shared` is ESM, built with `tsc` to `dist/`; `apps/api` is CommonJS and loads it through Node's `require(esm)`. `verbatimModuleSyntax` is off in `apps/api` because it forbids `import` syntax in CommonJS files.
- **Local development database:** `apps/api/docker-compose.yml` (PostgreSQL 17). Migrations are generated against the compiled data source (`dist/src/config/data-source.js`), so no `ts-node` is needed.
- **No client secret.** Sign-in verifies the Google ID token against Google's public keys and the client ID; the OAuth client secret is not used anywhere.
- **Frontend** (`apps/web/src/features/equipment`, `data/sterennApi`): built from the Claude Design kit `ui_kits/equipment/index.html` (inventory, editor, dialogs) and `rigs-visual.html` (Rigs tab). The web needs `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` in `apps/web/.env.local`.
- **`camera.sensor_chip`** (optional text) was added on 2026-10-23, migration `CameraSensorChip`.
- **Sensor size is derived, not stored:** width and height are pixel size × resolution (`apps/web/src/core/optics/sensorSize.ts`), shown in the camera's details and in the dialog. This display was asked for after this ADR listed sensor size among out-of-scope calculations; no other optics calculation is in scope.
- **Full well is entered and shown in ke⁻** in the UI; `full_well_e` still stores electrons.
- **Not done:** automated tests for shared, API and the equipment feature; a passband editor in the UI.

## Rejected alternatives

- **Drizzle instead of TypeORM.** Its table definitions, connection and migration config are specific to one database engine, and the engine is not known. Its main query API also mirrors SQL, which is not wanted here.
- **One wide `equipment` table with columns for every type.** Nearly every column would have to be nullable, and the database could not enforce what each type requires.
- **One complete table per type with no shared table.** Nothing could reference "any piece of equipment" with a foreign key, and ids would collide across tables when listing everything.
- **A JSON blob for type-specific specs.** Rejected in favour of real columns.
- **Lookup tables for the fixed-choice lists.** Rejected in favour of shared enums with CHECK constraints.
- **Constant arrays for the fixed-choice lists.** Replaced by enums.
- **Integer primary keys.** Not needed today, but changing to UUIDs later would be painful, so UUIDs from the start.
- **Password login.** Replaced by Google sign-in, so no password is stored.
- **Access and refresh tokens.** Replaced by a single session cookie backed by the `session` table.
- **A pointer to the current rig on the user row.** Rejected in favour of a flag on the rig, because several rigs can be current.
- **Putting thread diameter and pitch directly on `equipment_thread`.** Rejected in favour of a separate `thread_size` table, so a size has one row and one common name.
- **Separate domain classes with mappers to TypeORM entities.** Rejected; the TypeORM entities are the domain model.
- **A separate `RigsModule`.** Rigs and equipment are used together almost everywhere; rigs stay in `EquipmentModule`.
- **One class per use case.** Replaced by one service per repository, with one method per action.
- **CQRS.** Not needed: reads and writes have the same shape and the load is one person.
- **Value objects** (for example a `Backfocus` class). No real benefit here; plain properties.
- **An ESLint rule enforcing the naming conventions.** Not wanted.
- **Folder names `domain/`, `application/`, `infrastructure/`, `presentation/`.** Replaced by `controllers/`, `services/`, `entities/`, `rules/`, `repositories/`.
