-- Better Auth Foundation Tables
-- Created: 2026-08-21
-- Description: Authentication tables for customer accounts
-- 
-- Tables:
--   auth_users - Customer account records
--   auth_sessions - Active login sessions
--   auth_accounts - Authentication credentials (passwords, OAuth tokens)
--   auth_verifications - Email verification and password reset tokens

-- ============================================================================
-- AUTH_USERS - Customer Accounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_idx ON auth_users(email);

-- ============================================================================
-- AUTH_SESSIONS - Login Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions(expires_at);

-- ============================================================================
-- AUTH_ACCOUNTS - Authentication Credentials
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_provider_account_idx ON auth_accounts(provider_id, account_id);

-- ============================================================================
-- AUTH_VERIFICATIONS - Tokens for Email Verification & Password Reset
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_verifications_identifier_idx ON auth_verifications(identifier);
CREATE INDEX IF NOT EXISTS auth_verifications_expires_at_idx ON auth_verifications(expires_at);
