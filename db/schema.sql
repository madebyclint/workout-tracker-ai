-- Workout Tracker — PostgreSQL Schema
-- Run once on a fresh database, then run seed.js to load existing data.

CREATE TABLE IF NOT EXISTS config (
  key         VARCHAR(100) PRIMARY KEY,
  value       JSONB        NOT NULL,
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weeks (
  id           SERIAL       PRIMARY KEY,
  week         VARCHAR(10)  UNIQUE NOT NULL,   -- e.g. "2026-W17"
  date         DATE         NOT NULL,
  cycle        CHAR(1)      NOT NULL,           -- A | B | C | D
  label        VARCHAR(200) NOT NULL,
  program_file VARCHAR(200),                    -- relative path to .md file (legacy weeks)
  program_md   TEXT,                            -- program markdown stored directly (MCP-created weeks)
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS session_logs (
  id           SERIAL       PRIMARY KEY,
  week         VARCHAR(10)  UNIQUE NOT NULL REFERENCES weeks(week) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ,
  notes        TEXT         DEFAULT '',
  exercises    JSONB        NOT NULL DEFAULT '{}',
  exercise_ids JSONB        NOT NULL DEFAULT '{}',  -- exercise name -> exercises.id, when program_md tagged it
  athletes     JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Safe to re-run against a pre-existing database where session_logs already
-- existed before exercise_ids was added.
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS exercise_ids JSONB NOT NULL DEFAULT '{}';

-- Safe to re-run against a pre-existing database (e.g. Railway prod) where the
-- weeks table already existed before program_md was added.
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS program_md TEXT;

-- Structured exercise reference — replaces name-text keyword inference with a
-- canonical id/category/subtag per exercise. See mcp/server.js's exercise_id
-- lookup in program_md parsing.
CREATE TABLE IF NOT EXISTS exercises (
  id            VARCHAR(100) PRIMARY KEY,   -- stable slug, e.g. "single_arm_db_row"
  name          VARCHAR(200) NOT NULL,
  category      VARCHAR(20)  NOT NULL,       -- push | pull | legs | core | full_body
  subtag        VARCHAR(50),                 -- e.g. "Back", "Anti-Rot", "Glute"
  cues          TEXT,
  video_url     TEXT,
  thumbnail_url TEXT,
  favorite      BOOLEAN      DEFAULT FALSE,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exercises_category_idx ON exercises (category);

-- ─────────────────────────────────────
--  MCP OAuth (mcp/auth.js) — persisted so a redeploy doesn't force claude.ai
--  to re-register/re-authorize. Access/refresh tokens are stored as SHA-256
--  hashes, never plaintext; client_secret is stored as-is because the SDK's
--  own client auth middleware compares it directly (client_secret_post).
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id                  VARCHAR(100) PRIMARY KEY,
  client_secret              TEXT,
  redirect_uris              JSONB        NOT NULL,
  grant_types                JSONB,
  response_types             JSONB,
  token_endpoint_auth_method VARCHAR(50),
  client_name                VARCHAR(200),
  client_id_issued_at        BIGINT,
  client_secret_expires_at   BIGINT,
  created_at                 TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code            VARCHAR(64) PRIMARY KEY,
  client_id       VARCHAR(100) NOT NULL,
  code_challenge  VARCHAR(200) NOT NULL,
  redirect_uri    TEXT         NOT NULL,
  scopes          JSONB        NOT NULL DEFAULT '[]',
  resource        TEXT,
  expires_at      TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash  VARCHAR(64) PRIMARY KEY,  -- sha256 hex digest of the actual token
  token_type  VARCHAR(10)  NOT NULL,    -- 'access' | 'refresh'
  client_id   VARCHAR(100) NOT NULL,
  scopes      JSONB        NOT NULL DEFAULT '[]',
  resource    TEXT,
  expires_at  TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_tokens_expires_at_idx ON oauth_tokens (expires_at);
