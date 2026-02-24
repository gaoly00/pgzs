/**
 * POST /api/admin/migrate
 * 
 * 接收前端 localStorage 的旧数据（projectsByUser 和 reportTemplates），
 * 迁移至服务端持久化存 JSON 文件，并统一绑定到当前用户的 tenantId。
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { createProject, getProject } from '@/lib/repositories/project-repo';
import { saveSheetData } from '@/lib/repositories/sheet-repo';
import { writeAuditLog, AuditAction } from '@/lib/audit-logger';
import { migrateUsersLegacyFields } from '@/lib/auth/store';
import { getDb } from '@/lib/db/index';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// 简易判断，如果有 docxBase64 则提取并存入 WORD_DIR
const WORD_DIR = path.join(process.cwd(), 'data', 'templates', 'word');

export async function POST(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });

        // 仅限 admin/manager 进行整体迁移
        if (!['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: '仅管理员可执行数据迁移' }, { status: 403 });
        }

        const body = await request.json();
        const { projects, templates } = body;

        let migratedProjectsCount = 0;
        let migratedTemplatesCount = 0;

        // --- 0. 迁移旧用户数据（补全 role/tenantId，确保租户记录） ---
        const userMigration = migrateUsersLegacyFields();

        // --- 1. 迁移项目数据 ---
        if (Array.isArray(projects)) {
            for (const p of projects) {
                // 如果服务端已存在同名或同 id 的项目，这里为防冲突可以直接按新项目建，或者跳过
                // 稳妥起见，直接覆盖迁移（保留原 id）
                const existing = getProject(session.tenantId, p.id);
                if (!existing) {
                    const serverProject = {
                        ...p,
                        tenantId: session.tenantId,
                        // 补齐字段
                        salesAnchors: p.salesAnchors || {},
                        salesResult: p.salesResult || { unitPrice: null, totalValue: null },
                        extractedMetrics: p.extractedMetrics || {},
                        customFields: p.customFields || [],
                        status: p.status || { isDirty: false, reportGeneratedAt: null },
                        createdBy: session.userId,
                    };
                    createProject(session.tenantId, serverProject);

                    // 如果存在 sheetData，则拆分存入 sheet 库
                    if (p.sheetData) {
                        for (const [method, data] of Object.entries(p.sheetData)) {
                            saveSheetData(session.tenantId, p.id, method, data);
                        }
                    }
                    if (p.salesSheetData) {
                        saveSheetData(session.tenantId, p.id, 'sales-comp', p.salesSheetData);
                    }
                    migratedProjectsCount++;
                }
            }
        }

        // --- 2. 迁移 Word 模板数据 ---
        // 尝试迁移包含 docxBase64 的本地旧模板
        if (Array.isArray(templates)) {
            if (!fs.existsSync(WORD_DIR)) fs.mkdirSync(WORD_DIR, { recursive: true });

            const db = getDb();

            for (const t of templates) {
                if (t.docxBase64 && t.id) {
                    // 仅迁移尚未在服务端存在的模板
                    const existing = db.prepare('SELECT id FROM word_templates WHERE id = ?').get(t.id);
                    if (!existing) {
                        const buffer = Buffer.from(t.docxBase64, 'base64');
                        fs.writeFileSync(path.join(WORD_DIR, `${t.id}.docx`), buffer);

                        if (t.html) {
                            fs.writeFileSync(path.join(WORD_DIR, `${t.id}.html`), t.html, 'utf-8');
                        }

                        db.prepare(
                            `INSERT OR IGNORE INTO word_templates (id, name, original_name, size, placeholders, uploaded_by, uploaded_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`
                        ).run(
                            t.id,
                            t.name || 'Migrated Template',
                            t.fileName || `${t.name || 'template'}.docx`,
                            buffer.length,
                            JSON.stringify(t.placeholders || []),
                            session.username,
                            new Date().toISOString(),
                        );
                        migratedTemplatesCount++;
                    }
                }
            }
        }

        // 审计日志
        writeAuditLog({
            action: 'sys.migrate',
            userId: session.userId,
            username: session.username,
            tenantId: session.tenantId,
            details: `迁移完成：导入 ${migratedProjectsCount} 个项目，${migratedTemplatesCount} 个模板，${userMigration.migrated} 个用户字段补全`,
        });

        return NextResponse.json({
            ok: true,
            message: `成功迁移 ${migratedProjectsCount} 个项目和 ${migratedTemplatesCount} 个模板`,
            migratedProjectsCount,
            migratedTemplatesCount
        });

    } catch (error) {
        console.error('[migrate] 数据迁移失败:', error);
        return NextResponse.json({ error: '数据迁移失败' }, { status: 500 });
    }
}
