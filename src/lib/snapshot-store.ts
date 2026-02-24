/**
 * 报告快照持久化存储 — SQLite
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db/index';

export interface ReportSnapshot {
    snapshotId: string;
    projectId: string;
    projectName: string;
    createdAt: string;
    extractedMetrics: Record<string, string | number | null>;
}

export function createSnapshot(
    projectId: string,
    projectName: string,
    extractedMetrics: Record<string, string | number | null>,
): ReportSnapshot {
    const snapshot: ReportSnapshot = {
        snapshotId: uuidv4(),
        projectId,
        projectName,
        createdAt: new Date().toISOString(),
        extractedMetrics,
    };

    const db = getDb();
    db.prepare(
        `INSERT INTO snapshots (snapshot_id, project_id, project_name, created_at, extracted_metrics)
         VALUES (?, ?, ?, ?, ?)`
    ).run(
        snapshot.snapshotId, snapshot.projectId, snapshot.projectName,
        snapshot.createdAt, JSON.stringify(snapshot.extractedMetrics),
    );

    return snapshot;
}

export function getSnapshot(snapshotId: string): ReportSnapshot | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM snapshots WHERE snapshot_id = ?').get(snapshotId) as any;
    if (!row) return undefined;
    return {
        snapshotId: row.snapshot_id,
        projectId: row.project_id,
        projectName: row.project_name,
        createdAt: row.created_at,
        extractedMetrics: JSON.parse(row.extracted_metrics || '{}'),
    };
}

export function listSnapshots(): ReportSnapshot[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM snapshots ORDER BY created_at DESC').all() as any[];
    return rows.map(row => ({
        snapshotId: row.snapshot_id,
        projectId: row.project_id,
        projectName: row.project_name,
        createdAt: row.created_at,
        extractedMetrics: JSON.parse(row.extracted_metrics || '{}'),
    }));
}
