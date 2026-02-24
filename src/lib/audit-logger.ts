/**
 * 审计日志 — 最小可用版
 *
 * 记录关键操作（登录、项目创建/删除、模板管理、权限变更等）
 * 存储到 data/audit/audit.log（JSONL 格式，每行一条记录）
 *
 * 后续可替换为专业日志服务（ELK、Loki 等）。
 */

import fs from 'fs';
import path from 'path';

const AUDIT_DIR = path.join(process.cwd(), 'data', 'audit');
const AUDIT_FILE = path.join(AUDIT_DIR, 'audit.log');

/** 审计日志条目 */
export interface AuditEntry {
    timestamp: string;  // ISO 8601
    action: string;     // 操作类型（如 'project.create'、'user.login'）
    userId: string;
    username: string;
    tenantId: string;
    targetId?: string;  // 被操作对象的 ID
    targetType?: string; // 被操作对象类型（'project'、'template'、'user'）
    details?: string;   // 补充描述
    ip?: string;        // 客户端 IP
}

/** 审计日志操作类型常量 */
export const AuditAction = {
    // 认证
    USER_LOGIN: 'user.login',
    USER_LOGOUT: 'user.logout',
    USER_REGISTER: 'user.register',
    PASSWORD_CHANGE: 'user.password_change',
    PASSWORD_RESET: 'user.password_reset',

    // 项目
    PROJECT_CREATE: 'project.create',
    PROJECT_UPDATE: 'project.update',
    PROJECT_DELETE: 'project.delete',

    // 模板
    TEMPLATE_UPLOAD: 'template.upload',
    TEMPLATE_DELETE: 'template.delete',

    // 用户管理
    USER_ROLE_CHANGE: 'user.role_change',

    // 报告
    REPORT_EXPORT: 'report.export',
    SNAPSHOT_CREATE: 'snapshot.create',
} as const;

/**
 * 写入审计日志
 * 使用 JSONL 格式（每行一条 JSON），高效追加写入
 */
export function writeAuditLog(entry: Omit<AuditEntry, 'timestamp'>): void {
    try {
        if (!fs.existsSync(AUDIT_DIR)) {
            fs.mkdirSync(AUDIT_DIR, { recursive: true });
        }

        const fullEntry: AuditEntry = {
            timestamp: new Date().toISOString(),
            ...entry,
        };

        const line = JSON.stringify(fullEntry) + '\n';
        fs.appendFileSync(AUDIT_FILE, line, 'utf-8');
    } catch (err) {
        // 审计日志写入失败不应影响业务流程
        console.error('[audit] 写入审计日志失败:', err);
    }
}

/**
 * 读取最近 N 条审计日志（用于管理界面）
 */
export function readRecentAuditLogs(limit: number = 100): AuditEntry[] {
    if (!fs.existsSync(AUDIT_FILE)) return [];

    try {
        const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        // 取最后 N 行
        const recent = lines.slice(-limit);

        return recent.map(line => {
            try {
                return JSON.parse(line) as AuditEntry;
            } catch {
                return null;
            }
        }).filter(Boolean) as AuditEntry[];
    } catch {
        return [];
    }
}
