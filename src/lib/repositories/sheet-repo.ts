/**
 * 工作簿 Sheet Repository — SQLite
 *
 * UNIQUE(tenant_id, project_id, method) 保证每个方法只有一条记录。
 */

import { getDb } from '@/lib/db/index';

export function getSheetData(tenantId: string, projectId: string, method: string): any | null {
    const db = getDb();
    const row = db.prepare(
        'SELECT data FROM sheets WHERE tenant_id = ? AND project_id = ? AND method = ?'
    ).get(tenantId, projectId, method) as any;
    if (!row) return null;
    try {
        return JSON.parse(row.data);
    } catch {
        return null;
    }
}

export function saveSheetData(tenantId: string, projectId: string, method: string, data: any): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
        `INSERT INTO sheets (tenant_id, project_id, method, data, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id, project_id, method)
         DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).run(tenantId, projectId, method, JSON.stringify(data), now);
}

export function deleteAllSheets(tenantId: string, projectId: string): void {
    const db = getDb();
    db.prepare('DELETE FROM sheets WHERE tenant_id = ? AND project_id = ?').run(tenantId, projectId);
}
