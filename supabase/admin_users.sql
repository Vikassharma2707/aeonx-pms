-- Admin Users table — controls admin panel access
-- Passwords are bcrypt-hashed; verification happens server-side via the API route.
-- Run in Supabase SQL Editor (requires pgcrypto extension for initial seed).

-- Enable pgcrypto for password hashing in SQL seed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT        UNIQUE NOT NULL,
  password_hash  TEXT        NOT NULL,
  full_name      TEXT,
  employee_id    TEXT        REFERENCES employees(employee_id) ON DELETE SET NULL,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only service-role key (used server-side in API routes) can read/write this table.
-- Anon and authenticated roles have NO access — passwords are never exposed to the client.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
-- (No permissive policies — service role bypasses RLS by default in Supabase)

-- Index for fast username lookups on login
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ── Seed initial admin users ──────────────────────────────────────────────────
-- Default password: Aeonx@12345
-- crypt() with blowfish produces a bcrypt $2a$ hash that bcryptjs can verify.
-- Change passwords via the Admin Users page after first login.

INSERT INTO admin_users (username, password_hash, full_name, is_active)
VALUES
  ('Administrator', crypt('Aeonx@12345', gen_salt('bf', 10)), 'System Administrator', true),
  ('Aeonxhr',       crypt('Aeonx@12345', gen_salt('bf', 10)), 'HR Administrator',     true)
ON CONFLICT (username) DO NOTHING;
