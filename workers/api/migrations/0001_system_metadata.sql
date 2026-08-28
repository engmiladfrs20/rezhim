CREATE TABLE IF NOT EXISTS system_metadata (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Seed initial phase 2 tracking record
INSERT INTO system_metadata (id, key, value, updated_at) 
VALUES ('sys-01', 'schema_version', '0001_system_metadata', CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
