-- EasDial Carrier Portal — initial schema
-- Safe to run repeatedly (IF NOT EXISTS).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE,                 -- falls back to TEXT if citext missing (see note)
    relationship_id TEXT        NOT NULL,          -- Peeredge relationship this carrier maps to
    brand           TEXT        NOT NULL DEFAULT 'easdial',
    role            TEXT        NOT NULL DEFAULT 'carrier',   -- carrier | admin
    password_hash   TEXT,                          -- null until password set
    status          TEXT        NOT NULL DEFAULT 'invited',   -- invited | active | disabled
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,                      -- sha-256 of the raw token; raw never stored
    purpose     TEXT NOT NULL,                      -- invite | reset
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);

-- Phase 2: persisted metrics from the ingestion worker.
CREATE TABLE IF NOT EXISTS metric_snapshots (
    relationship_id TEXT        NOT NULL,
    metric          TEXT        NOT NULL,           -- termination_minutes | attempts | prv | ...
    granularity     TEXT        NOT NULL,           -- 5m | hour | day
    ts              TIMESTAMPTZ NOT NULL,
    value           DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (relationship_id, metric, granularity, ts)
);
CREATE INDEX IF NOT EXISTS idx_metric_snapshots_lookup
    ON metric_snapshots(relationship_id, metric, ts);
