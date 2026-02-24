/**
 * 审计日志 — SQLite
 */

import { getDb } from '@/lib/db/index';

export interface AuditEntry {
    timestamp: string;
    action: string;
    userId: string;
    username: string;
    tenantId: string;
    targetId?: string;
    targetType?: string;
    details?: string;
    ip?: string;
}

export const AuditAction = {
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_REGISTER: 'user.register',
    PASSWORD_CHANGE: 'user.password_change',
    PASSWORD_RESET: 'user.password_reset',
    PROJECT_CREATE: 'project.create',
    PROJECT_UPDATE: 'project.update',
    PROJECT_DELETE: 'project.delete',
    TEMPLATE_UPLOAD: 'template.upload',
    TEMPLATE_DELETE: 'template.delete',
    USER_ROLE_CHANGE: 'user.role_change',
    REPORT_EXPORT: 'report.export',
    SNAPSHOT_CREATE: 'snapshot.create',
} as const;

export function writeAuditLog(entry: Omit<AuditEntry, 'timestamp'>): void {
    try {
        const db = getDb();
        const timestamp = new Date().toISOString();
        db.prepare(
            `INSERT INTO audit_logs (timestamp, action, user_id, username, tenant_id, ip, detail, target_id, target_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            timestamp, entry.action, entry.userId, entry.username,
            entry.tenantId, entry.ip || null, entry.details || null,
            entry.targetId || null, entry.targetType || null,
        );
    } catch (err) {
        console.error('[audit] 写入审计日志失败:', err);
    }
}

export function readRecentAuditLogs(limit: number = 100): AuditEntry[] {
    const db = getDb();
    const rows = db.prepare(
        'SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?'
    ).all(limit) as any[];
    return rows.map(r => ({
        timestamp: r.timestamp,
        action: r.action,
        userId: r.user_id,
        username: r.username,
        tenantId: r.tenant_id,
        targetId: r.target_id || undefined,
        targetType: r.target_type || undefined,
        details: r.detail || undefined,
        ip: r.ip || undefined,
    }));
}
