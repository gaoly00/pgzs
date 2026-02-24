/**
 * 租户 (Tenant) Repository
 *
 * 管理 data/tenants.json，用于存储公司/租户级别的基础信息。
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants.json');

export interface Tenant {
    id: string;
    name: string;           // 公司/团队名称
    createdAt: string;      // ISO 8601
}

function ensureFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TENANTS_FILE)) {
        fs.writeFileSync(TENANTS_FILE, '[]', 'utf-8');
    }
}

/** 获取所有租户 */
export function listTenants(): Tenant[] {
    ensureFile();
    try {
        const raw = fs.readFileSync(TENANTS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/** 根据 ID 获取特定租户 */
export function getTenant(id: string): Tenant | null {
    const tenants = listTenants();
    return tenants.find(t => t.id === id) ?? null;
}

/** 创建新租户 */
export function createTenant(tenant: Tenant): void {
    const tenants = listTenants();
    tenants.push(tenant);

    // 原子写入
    const tmp = TENANTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(tenants, null, 2), 'utf-8');
    fs.renameSync(tmp, TENANTS_FILE);
}

/** 确保默认租户存在（用于向下兼容现已被分配 tenant_xxx 的用户） */
export function ensureTenantExists(id: string, defaultName: string) {
    if (!getTenant(id)) {
        createTenant({
            id,
            name: defaultName,
            createdAt: new Date().toISOString()
        });
    }
}
