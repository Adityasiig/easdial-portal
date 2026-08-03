-- Durable accounts used by the EaseDial admin/customer portal.
CREATE TABLE IF NOT EXISTS portal_accounts (
    id                UUID PRIMARY KEY,
    email             TEXT        NOT NULL UNIQUE,
    password_hash     TEXT        NOT NULL,
    role              TEXT        NOT NULL CHECK (role IN ('admin', 'user')),
    relationship_id   TEXT,
    relationship_name TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_accounts_created_at
    ON portal_accounts(created_at);
