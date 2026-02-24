/**
 * SQLite 存储 — 用户与会话
 *
 * 所有读写通过 better-sqlite3 prepared statements。
 */

import { getDb } from '@/lib/db/index';

// ============================================================
// 类型定义
// ============================================================

export type UserRole = 'admin' | 'manager' | 'reviewer' | 'valuer';

export interface UserRecord {
    id: string;
    username: string;
    passwordHash: string;
    role: UserRole;
    tenantId: string;
    createdAt: string;
}

export interface SessionRecord {
    tokenHash: string;
    userId: string;
    expiresAt: string;
}

// ============================================================
// 用户操作
// ============================================================

export function readUsers(): UserRecord[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM users').all() as any[];
    return rows.map(r => ({
        id: r.id,
        username: r.username,
        passwordHash: r.password_hash,
        role: r.role as UserRole,
        tenantId: r.tenant_id,
        createdAt: r.created_at,
    }));
}

export function findUserByUsername(username: string): UserRecord | undefined {
    const db = getDb();
    const normalized = username.toLowerCase();
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(normalized) as any;
    if (!row) return undefined;
    return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role as UserRole,
        tenantId: row.tenant_id,
        createdAt: row.created_at,
    };
}

export function findUserById(userId: string): UserRecord | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!row) return undefined;
    return {
        id: row.id,
        username: row.username,
        passwordHash: row.password_hash,
        role: row.role as UserRole,
        tenantId: row.tenant_id,
        createdAt: row.created_at,
    };
}

export function createUser(user: UserRecord): void {
    const db = getDb();
    db.prepare(
        `INSERT INTO users (id, username, password_hash, role, tenant_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(user.id, user.username, user.passwordHash, user.role, user.tenantId, user.createdAt);
}

export function updateUserPassword(userId: string, newPasswordHash: string): boolean {
    const db = getDb();
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
    return result.changes > 0;
}

export function updateUserRole(userId: string, role: UserRole): boolean {
    const db = getDb();
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    return result.changes > 0;
}

// ============================================================
// 会话操作
// ============================================================

export function readSessions(): SessionRecord[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sessions').all() as any[];
    return rows.map(r => ({
        tokenHash: r.token_hash,
        userId: r.user_id,
        expiresAt: r.expires_at,
    }));
}

export function createSession(session: SessionRecord): void {
    const db = getDb();
    // 清理过期会话
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
    db.prepare(
        `INSERT OR REPLACE INTO sessions (token_hash, user_id, expires_at)
         VALUES (?, ?, ?)`
    ).run(session.tokenHash, session.userId, session.expiresAt);
}

export function findSession(tokenHash: string): SessionRecord | undefined {
    const db = getDb();
    const now = new Date().toISOString();
    const row = db.prepare(
        'SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?'
    ).get(tokenHash, now) as any;
    if (!row) return undefined;
    return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        expiresAt: row.expires_at,
    };
}

export function deleteSession(tokenHash: string): void {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

// ============================================================
// 迁移兼容（no-op，数据已在 SQLite 中）
// ============================================================

export function migrateUsersLegacyFields(): { migrated: number } {
    return { migrated: 0 };
}
