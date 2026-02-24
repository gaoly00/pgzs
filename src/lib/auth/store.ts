/**
 * JSON 文件存储 — 用户与会话
 * 
 * 开发阶段使用本地 JSON 文件替代数据库。
 * 所有读写操作通过此模块统一管理，后续可替换为 Prisma/DB。
 */

import fs from 'fs';
import path from 'path';
import { ensureTenantExists } from '@/lib/repositories/tenant-repo';

// ============================================================
// 类型定义
// ============================================================

/** 用户角色 */
export type UserRole = 'admin' | 'manager' | 'reviewer' | 'valuer';

export interface UserRecord {
    id: string;
    username: string;       // 存储为小写
    passwordHash: string;
    role: UserRole;         // 用户角色
    tenantId: string;       // 所属公司/租户
    createdAt: string;      // ISO 8601
}

export interface SessionRecord {
    tokenHash: string;
    userId: string;
    expiresAt: string;      // ISO 8601
}

// ============================================================
// 文件路径
// ============================================================
const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

/** 确保 data 目录和文件存在 */
function ensureFile(filePath: string, defaultContent: string = '[]') {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, defaultContent, 'utf-8');
    }
}

// ============================================================
// 用户操作
// ============================================================

/** 读取所有用户（含旧数据迁移兼容） */
export function readUsers(): UserRecord[] {
    ensureFile(USERS_FILE);
    try {
        const raw = fs.readFileSync(USERS_FILE, 'utf-8');
        const users = JSON.parse(raw) as UserRecord[];
        // 旧数据迁移：补充 role 和 tenantId
        return users.map((u) => {
            const role = u.role || (u.username === 'admin' ? 'admin' : 'valuer');
            const tenantId = u.tenantId || `tenant_${u.id.slice(0, 8)}`;

            // 向下兼容：自动生成对应的公司/实体模型 
            ensureTenantExists(tenantId, `${u.username}的租户`);

            return { ...u, role, tenantId };
        });
    } catch {
        return [];
    }
}

/** 写入所有用户 */
function writeUsers(users: UserRecord[]) {
    ensureFile(USERS_FILE);
    // 原子写入：先写临时文件再重命名
    const tmp = USERS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tmp, USERS_FILE);
}

/** 根据用户名查找用户（大小写不敏感） */
export function findUserByUsername(username: string): UserRecord | undefined {
    const normalized = username.toLowerCase();
    return readUsers().find((u) => u.username === normalized);
}

/** 根据 ID 查找用户 */
export function findUserById(userId: string): UserRecord | undefined {
    return readUsers().find((u) => u.id === userId);
}

/** 创建用户 */
export function createUser(user: UserRecord): void {
    const users = readUsers();
    users.push(user);
    writeUsers(users);
}

/** 更新用户密码哈希 */
export function updateUserPassword(userId: string, newPasswordHash: string): boolean {
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return false;
    users[idx].passwordHash = newPasswordHash;
    writeUsers(users);
    return true;
}

// ============================================================
// 会话操作
// ============================================================

/** 读取所有会话 */
export function readSessions(): SessionRecord[] {
    ensureFile(SESSIONS_FILE);
    try {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

/** 写入所有会话 */
function writeSessions(sessions: SessionRecord[]) {
    ensureFile(SESSIONS_FILE);
    const tmp = SESSIONS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf-8');
    fs.renameSync(tmp, SESSIONS_FILE);
}

/** 创建会话 */
export function createSession(session: SessionRecord): void {
    const sessions = readSessions();
    // 清理已过期的会话
    const now = new Date().toISOString();
    const valid = sessions.filter((s) => s.expiresAt > now);
    valid.push(session);
    writeSessions(valid);
}

/** 根据 tokenHash 查找会话 */
export function findSession(tokenHash: string): SessionRecord | undefined {
    const now = new Date().toISOString();
    return readSessions().find(
        (s) => s.tokenHash === tokenHash && s.expiresAt > now,
    );
}

/** 删除会话（登出） */
export function deleteSession(tokenHash: string): void {
    const sessions = readSessions().filter((s) => s.tokenHash !== tokenHash);
    writeSessions(sessions);
}
