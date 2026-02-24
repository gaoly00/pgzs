/**
 * 项目 Repository — 服务端项目数据持久化
 *
 * 按租户隔离存储：data/projects/{tenantId}/projects.json
 * 每个租户的所有项目元数据存储在一个 JSON 文件中。
 *
 * 后续可替换为数据库（Prisma/PostgreSQL）。
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// ============================================================
// 项目数据类型（与前端 Project 接口对齐）
// ============================================================

export interface ServerProject {
    id: string;
    tenantId: string;
    name: string;
    projectNumber?: string;
    projectType: 'real-estate' | 'land';
    valuationDate: string;
    propertyType: string;
    gfa: number | null;
    address: string;
    valuationMethods: string[];
    // FortuneSheet 数据不存这里，走独立的 sheet-repo
    salesAnchors: Record<string, any>;
    salesResult: { unitPrice: number | null; totalValue: number | null };
    extractedMetrics: Record<string, string | number | null>;
    customFields: Array<{ key: string; label: string; valueType: string; unit?: string }>;
    templateId?: string;
    reportContent?: string;
    status: {
        isDirty: boolean;
        reportGeneratedAt: string | null;
    };
    createdBy: string;  // userId
    createdAt: string;
    updatedAt: string;
}

// ============================================================
// 路径工具
// ============================================================

function tenantDir(tenantId: string): string {
    return path.join(DATA_DIR, 'projects', tenantId);
}

function projectsFile(tenantId: string): string {
    return path.join(tenantDir(tenantId), 'projects.json');
}

function ensureTenantDir(tenantId: string): void {
    const dir = tenantDir(tenantId);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ============================================================
// 原子写 JSON
// ============================================================

function writeJsonAtomic(filePath: string, data: any): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
}

// ============================================================
// CRUD 操作
// ============================================================

/** 读取租户的所有项目 */
export function listProjects(tenantId: string): ServerProject[] {
    const file = projectsFile(tenantId);
    if (!fs.existsSync(file)) return [];
    try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/** 根据 ID 获取单个项目 */
export function getProject(tenantId: string, projectId: string): ServerProject | null {
    const projects = listProjects(tenantId);
    return projects.find(p => p.id === projectId) ?? null;
}

/** 创建项目 */
export function createProject(tenantId: string, project: ServerProject): void {
    ensureTenantDir(tenantId);
    const projects = listProjects(tenantId);
    projects.push(project);
    writeJsonAtomic(projectsFile(tenantId), projects);
}

/** 更新项目（部分更新） */
export function updateProject(tenantId: string, projectId: string, patch: Partial<ServerProject>): ServerProject | null {
    const projects = listProjects(tenantId);
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx === -1) return null;

    projects[idx] = {
        ...projects[idx],
        ...patch,
        id: projects[idx].id,       // 不允许修改 id
        tenantId: projects[idx].tenantId, // 不允许修改 tenantId
        updatedAt: new Date().toISOString(),
    };

    writeJsonAtomic(projectsFile(tenantId), projects);
    return projects[idx];
}

/** 删除项目 */
export function deleteProject(tenantId: string, projectId: string): boolean {
    const projects = listProjects(tenantId);
    const filtered = projects.filter(p => p.id !== projectId);
    if (filtered.length === projects.length) return false; // 未找到
    writeJsonAtomic(projectsFile(tenantId), filtered);
    return true;
}
