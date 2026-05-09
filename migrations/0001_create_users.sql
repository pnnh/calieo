-- Migration: 0001_create_users
-- Apply locally:     wrangler d1 execute calieo-portal --local --file=migrations/0001_create_users.sql
-- Apply production:  wrangler d1 execute calieo-portal --file=migrations/0001_create_users.sql

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL UNIQUE,
  sub          TEXT,
  name         TEXT,
  groups       TEXT,        -- JSON-encoded string array, e.g. '["admins","devs"]'
  country      TEXT,
  iss          TEXT,
  aud          TEXT,        -- JSON-encoded string or string array
  created_at   INTEGER NOT NULL,  -- Unix timestamp (seconds)
  last_seen_at INTEGER NOT NULL,  -- Unix timestamp (seconds)
  token_exp    INTEGER             -- Unix timestamp (seconds)
);
