/**
 * 工作簿 Sheet Repository — 按租户/项目/方法隔离存储
 *
 * 存储路径：data/projects/{tenantId}/{projectId}/sheets/{method}.json
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

function sheetDir(tenantId: string, projectId: string): string {
    return path.join(DATA_DIR, 'projects', tenantId, projectId, 'sheets');
}

function sheetFile(tenantId: string, projectId: string, method: string): string {
    // 安全化方法名，防止路径穿越
    const safeMethod = method.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(sheetDir(tenantId, projectId), `${safeMethod}.json`);
}

/** 读取工作簿数据 */
export function getSheetData(tenantId: string, projectId: string, method: string): any | null {
    const file = sheetFile(tenantId, projectId, method);
    if (!fs.existsSync(file)) return null;
    try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** 保存工作簿数据 */
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
