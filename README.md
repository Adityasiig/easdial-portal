# EaseDial Carrier Portal

An independent, EaseDial-branded carrier reporting portal with a clean white-and-blue interface. It mirrors the useful workflows of the reference carrier portal while keeping EaseDial authentication, authorization, and deployment under your control.

## Current capabilities

- Secure EaseDial login and tenant-scoped access tokens.
- Peeredge-style dashboard KPIs and functional minutes, attempts, ports, CPS, and profit graph tabs.
- Relationship performance and numbering reports.
- Termination/origination CDR diagnostics with a dual-month GMT calendar, independently validated customer/vendor trunk filters, advanced live filters, pagination, live calls, and scoped export history.
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

For multiple ED customer relationships, use the verified switch-admin mode:

```dotenv
PEEREDGE_SOURCE=rest
PEEREDGE_BASE_URL=https://api-dialphone.peeredge.com
PEEREDGE_ADMIN_EMAIL=your_service_account_email
PEEREDGE_ADMIN_PASSWORD=your_service_account_password
PEEREDGE_ADMIN_LOGIN_PATH=/api/v2/login
PEEREDGE_BRAND_PREFIX=ED
```

## Production checks

```powershell
cd backend
npm run build

cd ..\frontend
npm run build
```

Use a strong `JWT_SECRET`, replace the seeded admin password, keep all `.env` files out of Git, and serve both applications over HTTPS. See [ARCHITECTURE.md](ARCHITECTURE.md) for the system design and security checklist.
