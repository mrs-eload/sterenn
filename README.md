# sterenn

A personal astrophotography web app: tonight's conditions (the longest
contiguous clear block, not "any clear hour"), and your equipment and rigs.

Live at <https://sterenn-astro.bzh>.

- `apps/web`: React 19 + Vite + MUI
- `apps/api`: NestJS + TypeORM + PostgreSQL, Google sign-in
- `apps/shared`: enums, zod schemas, response types and rig rules used by both

Project state: [docs/STATUS.md](docs/STATUS.md). Plan: [docs/ROADMAP.md](docs/ROADMAP.md).
Decisions: [docs/adr/](docs/adr/). Working rules: [CLAUDE.md](CLAUDE.md).

## Run it locally

Needs Node 24 and Docker.

```bash
npm install

# database
cd apps/api && docker compose up -d && cd ../..

# configuration (both files are gitignored)
cp apps/api/.env.example apps/api/.env          # set GOOGLE_CLIENT_ID and ALLOWED_GOOGLE_EMAIL
cp apps/web/.env.example apps/web/.env.local    # set VITE_GOOGLE_CLIENT_ID (same client ID)

# two terminals
npm run dev:api   # http://localhost:3000/api, applies pending migrations at startup
npm run dev       # http://localhost:5173/
```

The conditions pages work without the API. The equipment page needs it and a
Google sign-in.

### Google client ID

Free, no billing account. In the Google Cloud Console → Google Auth Platform:
create a project, set up the consent screen (External, add yourself as a test
user), then **Clients → Create client → Web application** with
`http://localhost:5173` under *Authorized JavaScript origins*. Copy the client
ID into both env files. There is no client secret to configure: the API only
verifies Google's ID token.

Only the account in `ALLOWED_GOOGLE_EMAIL` can sign in; its first sign-in
creates the single user.

## Database migrations

```bash
npm run migration:generate -w @sterenn/api -- migrations/<Name>   # after changing an entity
npm run migration:run -w @sterenn/api
```

A new migration (or entity) must also be added to the lists in
`apps/api/src/config/data-source.ts`: they are imported explicitly so the
deployed function ships them.

## Deployment

Vercel, one project with two services (`vercel.json`): `web` serves the static
app and `api` runs the NestJS API as a function under `/api` on the same domain,
which keeps the session cookie first-party. Every push to `main` deploys.

- Domain: `sterenn-astro.bzh`, added under Project → Settings → Domains.
- Database: Neon Postgres (Frankfurt) from the Vercel Marketplace; it sets
  `DATABASE_URL`. Preview deployments get their own database branch.
- Environment variables, all set in Vercel (no env file is committed):
  `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` (same value),
  `ALLOWED_GOOGLE_EMAIL`, `WEB_ORIGIN=https://sterenn-astro.bzh`,
  `VITE_API_URL=/api`.
- Functions region: Frankfurt (`fra1`), next to the database.
- Google sign-in works on `https://sterenn-astro.bzh` only: it is the
  production origin listed in the OAuth client.
