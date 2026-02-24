/**
 * SQLite 建表 — CREATE TABLE IF NOT EXISTS
 *
 * 调用 initSchema() 确保所有表存在。
 */

import { getDb } from './index';

const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'valuer',
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    name TEXT NOT NULL,
    project_number TEXT,
    project_type TEXT NOT NULL DEFAULT 'real-estate',
    valuation_date TEXT NOT NULL,
    property_type TEXT NOT NULL DEFAULT '',
    gfa REAL,
    address TEXT NOT NULL DEFAULT '',
    valuation_methods TEXT NOT NULL DEFAULT '[]',
    sales_anchors TEXT NOT NULL DEFAULT '{}',
    sales_result TEXT NOT NULL DEFAULT '{}',
    extracted_metrics TEXT NOT NULL DEFAULT '{}',
    custom_fields TEXT NOT NULL DEFAULT '[]',
    template_id TEXT,
    report_content TEXT,
    status TEXT NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sheets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    method TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, project_id, method)
);

CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    extracted_metrics TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    ip TEXT,
    detail TEXT,
    target_id TEXT,
    target_type TEXT
);

CREATE TABLE IF NOT EXISTS word_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    placeholders TEXT NOT NULL DEFAULT '[]',
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    timestamps TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_failures (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    last_failure TEXT,
    locked_until TEXT
);
`;

export function initSchema(): void {
    const db = getDb();
    db.exec(TABLES_SQL);
}
