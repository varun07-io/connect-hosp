# Connect Hospital — POC

A two-sided hospital discovery & booking platform: a public patient-facing site (search, compare, book) plus
five operational dashboards (Hospital Admin, Doctor, Verification, Support, Super Admin). See
`Connect Hospital Scope.pdf` for the full requirements this traces to.

This is the **foundations** build: auth, roles, the full data model, and a real (if intentionally thin) shell
for all 6 experiences. Every external integration (Firebase, notifications, file storage) has a working
local/mock fallback, so the whole app runs with **zero cloud accounts**. See the plan this was built from in
`../.claude/plans` if you have it, or ask your assistant to re-summarize scope.

## Stack

React + Vite + TS + Tailwind + shadcn-style components (web) · Node + Fastify + Prisma (api) · PostgreSQL ·
Firebase Auth · Cloudflare R2 (storage, Phase 2) · MSG91 + Resend (notifications, Phase 2) · Render (hosting).

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- Docker Desktop (for local Postgres via `infra/docker-compose.yml`) — **not required** for anything else

## Local setup

```bash
npm install

# 1. Start Postgres
docker compose -f infra/docker-compose.yml up -d

# 2. Configure env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Defaults work as-is: DEV_AUTH_BYPASS=true means no Firebase project is needed yet.

# 3. Create the schema + demo data
npm run db:migrate --workspace apps/api   # first run: creates prisma/migrations, prompts for a migration name
npm run db:seed --workspace apps/api      # prints a table of dev login accounts

# 4. Run both apps
npm run dev:api    # http://localhost:4000
npm run dev:web    # http://localhost:5173
```

Open http://localhost:5173, click **Log in**, and pick any seeded account — a patient, a hospital admin, a
doctor, verification/support/super-admin staff — to explore that role's dashboard with real (seeded) data.
No Firebase project is required for this; the dev switcher only works because `DEV_AUTH_BYPASS=true`.

## Turning on real integrations (do these independently, any time)

Nothing below is required to run or demo the app. Each is a drop-in swap behind an existing interface.

| Integration | Where | What changes when you add it |
|---|---|---|
| Firebase Auth | `apps/api/.env` (`FIREBASE_*`), `apps/web/.env.local` (`VITE_FIREBASE_*`), then set `DEV_AUTH_BYPASS=false` | Real mobile-OTP (patients) and email/password (staff) login replaces the dev switcher. Create a Firebase project → Authentication → enable Phone and Email/Password providers → Project Settings → generate a service account key (for the API) and copy the web app config (for the frontend). |
| Notifications (SMS/WhatsApp/Email) | `apps/api/.env` (`MSG91_AUTH_KEY`, `RESEND_API_KEY`) | `src/lib/notifications` currently only ships a logging `MockNotificationProvider`; wiring a real MSG91/Resend adapter behind the same `NotificationProvider` interface is a Phase 2 task, not just an env var — see that folder's comments. |
| File storage | `apps/api/.env` (`R2_*`) | Same story as notifications — `src/lib/storage` ships `LocalDiskStorageProvider`; an R2 adapter behind `StorageProvider` is a Phase 2 task. |

## Sharing a temporary preview link (client demos)

Exposes the app running **on this machine** over a public HTTPS URL via Cloudflare quick tunnels. Good for a
live walkthrough; not a deployment (see Render below for that).

⚠️ **The preview URL is unauthenticated by design.** `DEV_AUTH_BYPASS=true` means anyone with the link can use
the dev switcher to sign in as *any* role, including Super Admin. That's fine for a POC demo against seeded
fake data — never point a tunnel at an environment holding real patient data.

⚠️ **Quick tunnels are not reliable enough to depend on.** Measured on this setup: requests intermittently
stall for 30-60s and then recover, with no pattern. Fine for a screenshare you're driving yourself; use the
Render deploy below for anything a client opens unattended.

Only **one** tunnel is needed: `vite preview` proxies `/api`, `/health` and `/files` to the API
(`vite.config.ts`), so the frontend calls the API same-origin. That means no CORS and half the moving parts.

```bash
# 1. Keep VITE_API_URL empty so API calls are relative (same-origin, via the proxy)
#    apps/web/.env.local :  VITE_API_URL=

# 2. One tunnel for the whole app — prints a https://<random>.trycloudflare.com URL
cloudflared tunnel --url http://localhost:5173

# 3. Point the API's absolute-URL settings at that tunnel URL, then restart it
#    apps/api/.env :  WEB_ORIGIN=<tunnel URL>
#                     API_PUBLIC_URL=<tunnel URL>   (used for vault download links)
npm run dev:api

# 4. Serve a production build, NOT the dev server. The dev server ships ~1800
#    unbundled modules — over a tunnel that's a 15-25s first paint. The build is
#    4 files and loads in ~1s.
npm run build:web
cd apps/web && npx vite preview --port 5173 --host
```

Notes:
- Quick-tunnel URLs are **random and change every restart**, so redo steps 2-4 each session.
- `vite.config.ts` allow-lists `.trycloudflare.com` under both `server` and `preview` — without it Vite rejects
  the tunnel's `Host` header with a 403 (its DNS-rebinding protection).
- The link dies when this machine sleeps or the tunnel stops.

## Deploying to Render

See `infra/render.yaml` (a Blueprint) and the manual-wiring steps documented at the top of that file — Render
can't generate cross-service secrets for you from a blueprint alone (e.g. pointing the API's `DATABASE_URL` at
the self-managed Postgres service's generated password). In the Render dashboard: **New +** → **Blueprint** →
point at this repo.

Database: self-managed PostgreSQL on a Render persistent disk (per the original cost plan), **not** Render's
managed Postgres add-on — meaning there's no automatic backup safety net. Schedule your own `pg_dump` before
anything you can't afford to lose, once real pilot data exists.

## Repo layout

```
apps/web        React app — public site + all 5 dashboards
apps/api         Fastify API — RBAC, Prisma, provider adapters
packages/shared  Zod schemas, enums, TS types shared by both
infra/           docker-compose.yml (local Postgres), render.yaml (deploy blueprint)
```

## What's built vs. deferred

Built: auth + role-based access control, the full data model, public discovery (search/compare/hospital
profile with map), and a real, role-scoped shell for every dashboard reading live seeded data.

Deferred to the next build pass (see requirement IDs in the scope doc): booking + doctor-callback engine
end-to-end, hospital dashboard CRUD (profile/doctors/prices), doctor callback logging, verification
approve/reject actions, support ticket actions, super-admin management screens, real notification delivery,
the hospital API, and vault file upload.
