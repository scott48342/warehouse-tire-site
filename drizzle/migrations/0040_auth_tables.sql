-- Better Auth Tables
-- Authentication infrastructure for customer accounts
-- Created: 2026-08-20
--
-- Tables:
-- - auth_users: Customer accounts
-- - auth_sessions: Login sessions (database-stored, not JWT)
-- - auth_accounts: Authentication credentials (passwords, OAuth tokens)
-- - auth_verifications: Email verification and password reset tokens
--
-- These tables are SEPARATE from existing WTD business tables.
-- All prefixed with "auth_" to avoid naming conflicts.

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

-- Index for email lookups (login, registration checks)
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_idx ON auth_users (email);

COMMENT ON TABLE auth_users IS 'Customer accounts for WTD. Passwords stored in auth_accounts.';
COMMENT ON COLUMN auth_users.email_verified IS 'True after customer clicks email verification link';

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

-- Index for session lookups
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_idx ON auth_sessions (token);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);

COMMENT ON TABLE auth_sessions IS 'Active login sessions. Each device/browser gets separate session.';
COMMENT ON COLUMN auth_sessions.token IS 'Hashed session token stored in cookie';
COMMENT ON COLUMN auth_sessions.ip_address IS 'Client IP for security auditing';

-- ============================================================================
-- AUTH_ACCOUNTS - Authentication Credentials
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    issuer TEXT NOT NULL, -- Better Auth 1.7+ requirement
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at TIMESTAMPTZ,
    refresh_token_expires_at TIMESTAMPTZ,
    scope TEXT,
    password TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (issuer, account_id) -- Better Auth 1.7+ compound index
);

-- Indexes
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);
-- Better Auth 1.7+ uses issuer+accountId for unique identity
CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_issuer_account_id_idx 
    ON auth_accounts (issuer, account_id);

COMMENT ON TABLE auth_accounts IS 'Authentication credentials. Supports multiple providers per user.';
COMMENT ON COLUMN auth_accounts.provider_id IS 'For email/password: "credential". For OAuth: provider name.';
COMMENT ON COLUMN auth_accounts.password IS 'Hashed password (scrypt). Only for credential auth.';

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

-- Indexes
CREATE INDEX IF NOT EXISTS auth_verifications_identifier_idx ON auth_verifications (identifier);
CREATE INDEX IF NOT EXISTS auth_verifications_expires_at_idx ON auth_verifications (expires_at);

COMMENT ON TABLE auth_verifications IS 'Tokens for email verification and password reset. Single-use.';
COMMENT ON COLUMN auth_verifications.identifier IS 'The email address being verified';
COMMENT ON COLUMN auth_verifications.value IS 'Hashed token value';
COMMENT ON COLUMN auth_verifications.expires_at IS 'Verification: 24h, Password reset: 1h';
