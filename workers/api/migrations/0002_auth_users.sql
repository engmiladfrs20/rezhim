-- Migration: Auth and Users Foundation

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_algorithm TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
    status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    locale TEXT NOT NULL CHECK (locale IN ('fa', 'en')),
    email_verified_at TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
    email_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    window_start TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    PRIMARY KEY(email_hash, ip_hash)
);

-- Seed initial phase 3 tracking record
UPDATE system_metadata SET value = '0002_auth_users', updated_at = CURRENT_TIMESTAMP WHERE key = 'schema_version';
