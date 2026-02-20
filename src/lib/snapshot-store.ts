/**
 * 报告快照内存存储
 * 用于在 snapshot 创建和 PDF 导出之间共享锁定的数据快照。
 *
 * TODO: 后续迁移到持久化存储 (数据库/文件系统)
 */

import { v4 as uuidv4 } from 'uuid';

export interface ReportSnapshot {
    snapshotId: string;
    projectId: string;
    projectName: string;
    createdAt: string;           // ISO 8601
    extractedMetrics: Record<string, string | number | null>;
}

// 内存快照存储（服务端单例）
const snapshotStore = new Map<string, ReportSnapshot>();

/**
 * 创建并存储一个新快照
 */
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
    snapshotStore.set(snapshot.snapshotId, snapshot);
    return snapshot;
}

/**
 * 根据 snapshotId 获取快照
 */
export function getSnapshot(snapshotId: string): ReportSnapshot | undefined {
    return snapshotStore.get(snapshotId);
}
