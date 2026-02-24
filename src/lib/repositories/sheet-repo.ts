/**
 * 工作簿 Sheet Repository — 按租户/项目/方法隔离存储
 *
 * 新路径：data/projects/{tenantId}/{projectId}/sheets/{method}.json
 * 旧路径：data/projects/{projectId}_{method}.json（向下兼容读取 + 自动迁移）
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function sheetDir(tenantId: string, projectId: string): string {
    return path.join(DATA_DIR, 'projects', tenantId, projectId, 'sheets');
}

function sheetFile(tenantId: string, projectId: string, method: string): string {
    const safeMethod = method.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(sheetDir(tenantId, projectId), `${safeMethod}.json`);
}

/** 旧版扁平路径（valuation.ts 曾使用的格式） */
function legacySheetFile(projectId: string, method: string): string {
    const safeMethod = method.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(DATA_DIR, 'projects', `${projectId}_${safeMethod}.json`);
}

/**
 * 读取工作簿数据
 * 优先从新路径读取；如果新路径不存在，尝试旧路径并自动迁移
 */
export function getSheetData(tenantId: string, projectId: string, method: string): any | null {
    const newFile = sheetFile(tenantId, projectId, method);

    // 1. 优先读取新路径
    if (fs.existsSync(newFile)) {
        try {
            const raw = fs.readFileSync(newFile, 'utf-8');
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    // 2. 回退到旧路径
    const oldFile = legacySheetFile(projectId, method);
    if (fs.existsSync(oldFile)) {
        try {
            const raw = fs.readFileSync(oldFile, 'utf-8');
            const parsed = JSON.parse(raw);

            // 旧格式是 ValuationRecord { projectId, sheetType, version, data, updatedAt }
            // 新格式直接存 data 数组
            const actualData = parsed.data ?? parsed;

            // 自动迁移：写入新路径
            console.log(`[sheet-repo] 自动迁移旧数据: ${oldFile} → ${newFile}`);
            saveSheetData(tenantId, projectId, method, actualData);

            return actualData;
        } catch (err) {
            console.warn('[sheet-repo] 读取旧格式失败:', err);
            return null;
        }
    }

    return null;
}

/** 保存工作簿数据（始终写入新路径） */
export function saveSheetData(tenantId: string, projectId: string, method: string, data: any): void {
    const dir = sheetDir(tenantId, projectId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const file = sheetFile(tenantId, projectId, method);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
    fs.renameSync(tmp, file);
}

/** 删除某项目的所有工作簿 */
export function deleteAllSheets(tenantId: string, projectId: string): void {
    const dir = sheetDir(tenantId, projectId);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}
