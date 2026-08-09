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
  id          SERIAL       PRIMARY KEY,
  week        VARCHAR(10)  UNIQUE NOT NULL REFERENCES weeks(week) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ,
  notes       TEXT         DEFAULT '',
  exercises   JSONB        NOT NULL DEFAULT '{}',
  athletes    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Safe to re-run against a pre-existing database (e.g. Railway prod) where the
-- weeks table already existed before program_md was added.
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS program_md TEXT;
