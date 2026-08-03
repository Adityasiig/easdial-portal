# Deploying EaseDial to Coolify

This repository deploys as one Docker Compose resource with three services:
Postgres, the Fastify backend, and the React frontend.

## Domains

Assign the public domains to these services:

- Frontend: `https://easdial.crownitsolution.com` → container port `80`
- Backend: `https://easdial-backend.crownitsolution.com` → container port `4000`

## Required environment variables

Set these on the Coolify Compose resource before deploying:

| Variable | Value |
|---|---|
| `JWT_SECRET` | A long, randomly generated secret |
| `POSTGRES_PASSWORD` | A strong database password |
| `EASDIAL_ADMIN_EMAIL` | The EaseDial administrator email |
| `EASDIAL_ADMIN_PASSWORD` | A strong administrator password |
| `VITE_API_BASE_URL` | `https://easdial-backend.crownitsolution.com` |
| `CORS_ORIGIN` | `https://easdial.crownitsolution.com` |

`VITE_API_BASE_URL` is compiled into the frontend bundle, so changing it requires
a rebuild/redeploy.

## Select the Peeredge data source

Never leave production on `PEEREDGE_SOURCE=mock`; that mode intentionally returns
generated demo records.

For one carrier relationship using its portal login:

```env
PEEREDGE_SOURCE=relationship
PEEREDGE_BASE_URL=https://api-dialphone.peeredge.com
PEEREDGE_RELATIONSHIP_USERNAME=replace_in_coolify
PEEREDGE_RELATIONSHIP_PASSWORD=replace_in_coolify
PEEREDGE_RELATIONSHIP_NAME=ED- Tru Telco
```

For the full switch and multiple customer relationships, use a dedicated switch
administrator/service account:

```env
PEEREDGE_SOURCE=rest
PEEREDGE_BASE_URL=https://api-dialphone.peeredge.com
PEEREDGE_ADMIN_EMAIL=replace_in_coolify
PEEREDGE_ADMIN_PASSWORD=replace_in_coolify
PEEREDGE_ADMIN_LOGIN_PATH=/api/v2/login
PEEREDGE_BRAND_PREFIX=ED
```

This is the recommended configuration for EaseDial. It was verified against the
live DialPhone switch with carrier, dashboard, performance, CDR, numbering,
rate, invoice, transaction, and live-call reads. All customer requests remain
scoped to the relationship allocated in the EaseDial admin portal.

Keep every real credential in Coolify secrets. Never add it to `.env`, Git, a
commit, or a pull request.

## Deploy and verify

1. Deploy the Compose resource from branch `main`.
2. Confirm `https://easdial-backend.crownitsolution.com/health` returns `status: ok`.
3. Confirm `/health/upstream` reports `relationship` or `rest`, not `mock`.
4. Sign in as the configured EaseDial administrator.
5. Create a temporary customer, allocate the intended relationship, and verify
   Dashboard, Reporting, Call Diagnostic, Numbering, and Accounting.
6. Delete the temporary customer from the admin portal.

Portal accounts are stored in Postgres and survive backend restarts. The backend
also creates the `portal_accounts` table at startup so an existing Coolify volume
is upgraded even though Docker's initialization scripts only run on a new volume.
