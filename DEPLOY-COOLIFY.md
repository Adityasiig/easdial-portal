# Deploying to Coolify

This app deploys as a **Docker Compose** resource. You need **two domains** (or
subdomains), because the browser talks to both the frontend and the backend:

- `app.easdial.com`  → the **frontend** (React dashboard)
- `api.easdial.com`  → the **backend** (API)

(You can use any names — Coolify subdomains work too. The two-domain split is what
matters, because `VITE_API_BASE_URL` and `CORS_ORIGIN` must be real public URLs.)

## Steps

1. In Coolify: **+ New → Resource → Docker Compose**, and point it at your GitHub
   repo `Adityasiig/easdial-portal`, branch `main`, compose file `docker-compose.yml`.
2. **Assign domains** to the services:
   - `frontend` → `https://app.easdial.com` (container port **80**)
   - `backend`  → `https://api.easdial.com` (container port **4000**)
3. **Set environment variables** (Coolify → this resource → Environment Variables):

   | Variable | Value | Notes |
   |---|---|---|
   | `JWT_SECRET` | a long random string | **required** — Coolify can generate one |
   | `VITE_API_BASE_URL` | `https://api.easdial.com` | build-time; the frontend calls this |
   | `CORS_ORIGIN` | `https://app.easdial.com` | backend only accepts this origin |
   | `PORTAL_BASE_URL` | `https://app.easdial.com` | used in invite/reset email links |
   | `POSTGRES_PASSWORD` | a strong password | |
   | `PEEREDGE_SOURCE` | `mock` to start, `rest` for live data | |
   | `PEEREDGE_SESSION_COOKIE` | (only if `rest` + cookie mode) | a live session cookie |

4. **Deploy.** Coolify builds all three services (db, backend, frontend), runs the DB
   migration on first boot, and puts Traefik + HTTPS in front.
5. Open `https://app.easdial.com` and sign in with the seeded demo account —
   **but note:** demo seeding only runs when `NODE_ENV` is not `production`. In prod,
   create your first user via the invite flow (see "Known limitations").

## After it's up

- Switch `PEEREDGE_SOURCE=rest` and add `PEEREDGE_SESSION_COOKIE` (or login creds) to
  pull live PeerEdge data. Re-deploy so the backend picks up the new env.
- If you change `VITE_API_BASE_URL`, you must **rebuild** the frontend (it's baked at
  build time), which Coolify does on the next deploy.

## Known limitations (before real carrier traffic)

- **User store is in-memory** (Phase 1). Users are lost on backend restart. For
  production, wire the Postgres-backed user store (the schema is already in
  `db/migrations/001_init.sql` and the `UserStore` interface is ready).
- **PeerEdge auth is a session cookie**, which expires. For unattended production use,
  switch to `PEEREDGE_AUTH_MODE=login` once the login endpoint is confirmed, or move to
  an official 46 Labs API token.
- Chart field mappings are still `// ASSUMED` until the busy-hours capture (see
  `PEEREDGE_API.md`).

## Single-domain alternative (advanced)

To avoid CORS entirely, serve the API under the frontend domain by proxying
`/api` → backend in `frontend/nginx.conf`, then set `VITE_API_BASE_URL=/api` and drop
`CORS_ORIGIN`. Cleaner, but requires the nginx proxy block — ask if you want this wired.
