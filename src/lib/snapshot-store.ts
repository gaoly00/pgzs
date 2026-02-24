/**
 * 报告快照持久化存储
 *
 * 快照数据存储在 data/snapshots/ 目录下，每个快照一个 JSON 文件。
 * 同时保持内存缓存以提高读取性能。
 *
 * 存储路径：data/snapshots/{snapshotId}.json
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const SNAPSHOTS_DIR = path.join(process.cwd(), 'data', 'snapshots');

export interface ReportSnapshot {
    snapshotId: string;
    projectId: string;
    projectName: string;
    createdAt: string;           // ISO 8601
    extractedMetrics: Record<string, string | number | null>;
}

// 内存缓存（加速读取）
const memoryCache = new Map<string, ReportSnapshot>();

/** 确保快照目录存在 */
function ensureDir(): void {
    if (!fs.existsSync(SNAPSHOTS_DIR)) {
        fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
    }
}

/** 快照文件路径 */
function snapshotFile(snapshotId: string): string {
    // 安全化 ID，防止路径穿越
    const safeId = snapshotId.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(SNAPSHOTS_DIR, `${safeId}.json`);
}

/**
 * 创建并持久化一个新快照
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

    // 持久化到文件
    ensureDir();
    const file = snapshotFile(snapshot.snapshotId);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2), 'utf-8');
    fs.renameSync(tmp, file);

    // 更新内存缓存
    memoryCache.set(snapshot.snapshotId, snapshot);

    return snapshot;
}

/**
 * 根据 snapshotId 获取快照
 * 先查内存缓存，未命中则从文件加载
 */
export function getSnapshot(snapshotId: string): ReportSnapshot | undefined {
    // 内存缓存命中
    if (memoryCache.has(snapshotId)) {
        return memoryCache.get(snapshotId);
    }

    // 从文件加载
    const file = snapshotFile(snapshotId);
    if (!fs.existsSync(file)) return undefined;

    try {
        const raw = fs.readFileSync(file, 'utf-8');
        const snapshot = JSON.parse(raw) as ReportSnapshot;
        // 放入缓存
        memoryCache.set(snapshotId, snapshot);
        return snapshot;
    } catch {
        return undefined;
    }
}

/**
 * 列出所有快照（用于管理界面）
 */
export function listSnapshots(): ReportSnapshot[] {
    ensureDir();
    try {
        const files = fs.readdirSync(SNAPSHOTS_DIR).filter(f => f.endsWith('.json'));
        return files.map(f => {
            try {
                const raw = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf-8');
                return JSON.parse(raw) as ReportSnapshot;
            } catch {
                return null;
            }
        }).filter(Boolean) as ReportSnapshot[];
    } catch {
        return [];
    }
}
