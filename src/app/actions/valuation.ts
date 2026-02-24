'use server';

/**
 * @deprecated 该文件已废弃！
 *
 * 工作簿读写已迁移到 /api/projects/[id]/sheets/[method] API，
 * 前端通过 fetch 调用，带有 verifySession 鉴权和 tenantId 租户隔离。
 *
 * 旧的 Server Action 没有任何鉴权，存在安全漏洞。
 * 请勿在新代码中引用此文件。
 *
 * 保留此文件仅用于向后兼容迁移期间可能的回退。
 * 计划于下一个版本彻底删除。
 */

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import path from 'path';
import { unstable_noStore as noStore } from 'next/cache';

// Define the root data directory (ensure this exists or is created)
const DATA_DIR = path.join(process.cwd(), 'data', 'projects');

interface ValuationRecord {
    projectId: string;
    sheetType: string;
    version: number;
    data: any; // The sheet data (e.g., FortuneSheet JSON)
    updatedAt: string;
}

/**
 * Saves valuation sheet data to a persistent JSON file with UPSERT logic.
 * Ensures strict uniqueness for (projectId, sheetType).
 */
export async function saveValuationSheet(
    projectId: string,
    sheetType: string,
    data: any
): Promise<{ success: boolean; error?: string; path?: string }> {
    try {
        // Ensure directory exists
        await mkdir(DATA_DIR, { recursive: true });

        const fileName = `${projectId}_${sheetType}.json`;
        const filePath = path.join(DATA_DIR, fileName);
        const timestamp = new Date().toISOString();

        let record: ValuationRecord;
        let pVersion = 1;

        // 1. UPSERT Check: Try to read existing file first
        try {
            const existingContent = await readFile(filePath, 'utf-8');
            if (existingContent) {
                const existingRecord = JSON.parse(existingContent) as ValuationRecord;
                // Validate matching ID to prevent corruption
                if (existingRecord.projectId === projectId && existingRecord.sheetType === sheetType) {
                    pVersion = (existingRecord.version || 0) + 1;
                }
            }
        } catch (readError) {
            // File doesn't exist or is corrupt; treat as new insert
        }

        // 2. Construct New/Updated Record
        record = {
            projectId,
            sheetType,
            version: pVersion,
            data,
            updatedAt: timestamp,
        };

        // 3. Atomic Write (Overwrites existing file, effectively handling UPDATE)
        await writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');

        console.log(`[Server] Saved valuation sheet (v${pVersion}) to ${filePath}`);
        return { success: true, path: filePath };
    } catch (error) {
        console.error("[Server] Save Error:", error);
        return { success: false, error: String(error) };
    }
}

/**
 * Retrieves valuation sheet data from the persistent JSON file.
 * Returns the latest data for the given projectId and sheetType.
 */
export async function getValuationSheet(
    projectId: string,
    sheetType: string
): Promise<{ success: boolean; data?: any; error?: string }> {
    noStore(); // CRITICAL: Disable Next.js Cache to ensure we always read disk

    try {
        const fileName = `${projectId}_${sheetType}.json`;
        const filePath = path.join(DATA_DIR, fileName);

        // Check if file exists
        try {
            await readFile(filePath);
        } catch {
            return { success: true, data: null };
        }

        const content = await readFile(filePath, 'utf-8');
        if (!content) return { success: true, data: null };

        const record = JSON.parse(content) as ValuationRecord;

        // Strict Validation
        if (record.projectId !== projectId) {
            console.warn(`[Server] ID mismatch via file access: ${record.projectId} vs requested ${projectId}`);
            // If ID mismatched (rare via filename), treat as not found to be safe
            return { success: true, data: null };
        }

        return { success: true, data: record.data };
    } catch (error) {
        console.error("[Server] Load Error:", error);
        return { success: false, error: String(error) };
    }
}
