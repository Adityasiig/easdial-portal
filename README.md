# EasDial Carrier Portal

An independent, EasDial-branded carrier reporting portal with a clean white-and-blue interface. It mirrors the useful workflows of the reference carrier portal while keeping EasDial authentication, authorization, and deployment under your control.

## Current capabilities

- Secure EasDial login and tenant-scoped access tokens.
- Dashboard KPIs and origination/termination overview charts.
- Relationship performance and numbering reports.
- Termination/origination CDR diagnostics, live calls, and export history.
- Rates, invoices, carrier transactions, and PayPal history.
- Responsive white interface using the bundled Inter variable font.
- Three data-source modes: `mock`, switch-admin `rest`, and verified single-carrier `relationship`.

## Quick start

```powershell
# Backend
cd backend
Copy-Item .env.example .env
npm install
npm run dev

# Frontend (a second terminal)
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`; the backend defaults to `http://localhost:4000`. The mock-mode demo login is printed by the backend at startup.

## Live relationship mode

Set these values only in `backend/.env`; never commit the real credentials:

```dotenv
PEEREDGE_SOURCE=relationship
PEEREDGE_BASE_URL=https://api-dialphone.peeredge.com
PEEREDGE_SLUG=carrier-dialphone
PEEREDGE_RELATIONSHIP_USERNAME=your_username
PEEREDGE_RELATIONSHIP_PASSWORD=your_password
PEEREDGE_RELATIONSHIP_NAME=Your Relationship Name
PEEREDGE_RELATIONSHIP_LOGIN_PATH=/login
```

The backend logs in server-side, keeps the upstream token in memory, refreshes it after expiry or authorization failure, and returns only normalized portal data to the browser. See [PEEREDGE_API.md](PEEREDGE_API.md) for the audited endpoint mapping.

## Production checks

```powershell
cd backend
npm run build

cd ..\frontend
npm run build
```

Use a strong `JWT_SECRET`, replace the seeded admin password, keep all `.env` files out of Git, and serve both applications over HTTPS. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and security checklist.
