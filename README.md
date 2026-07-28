# EasDial Carrier Portal

A carrier-facing reporting portal (termination / origination performance) for the
**EasDial** brand. It is an independent application you own and host — it consumes the
same underlying metrics as the Peeredge carrier portal through the **PeerEdge REST API**
(OAS v3), stores them in your own database, and serves a branded dashboard with its own
carrier invite → password-reset → login flow.

> **Why not `carrier-easdial.peeredge.com`?** `peeredge.com` is 46 Labs' domain; only they
> can create hostnames under it. This app is designed to run on **your own domain**, e.g.
> `carrier.easdial.com`. See `ARCHITECTURE.md`.

## Status: Phase 1 (foundation)

Runs **today** against a built-in mock data source that mirrors the metrics shown in the
Peeredge dashboard (daily minutes, attempts, PRV, ports, termination time-series). Swapping
in live Peeredge data is a **single adapter + env change** — no rewrites. See
`backend/src/adapters/peeredge/`.

## Quick start

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in secrets (never commit .env)
npm install
npm run dev                   # http://localhost:4000  (uses PEEREDGE_SOURCE=mock)

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173

# Or the whole stack (adds Postgres):
docker compose up --build
```

Default demo login is seeded by the mock auth store — see backend startup logs.

## What's implemented

- PeerEdge data **adapter** (interface + mock impl + REST stub) — swap via `PEEREDGE_SOURCE`.
- Backend REST API: health, auth (`invite` / `set-password` / `login`), tenant-scoped metrics.
- JWT auth (access token), bcrypt password hashing, Zod input validation, central error handling.
- React dashboard replicating the KPI tiles + Today/Yesterday/Last-week termination chart, EasDial-branded.
- Postgres schema + docker-compose for the full stack.

## What's next (Phase 2+)

- Wire `RestPeeredgeClient` to the real PeerEdge Swagger endpoints (needs API credentials from 46 Labs).
- Ingestion worker to poll/persist metrics on a schedule (or ingest CDRs over SFTP).
- Refresh-token rotation, email delivery provider, per-relationship RBAC, audit logging.

See `ARCHITECTURE.md` for the full design and the security checklist.
