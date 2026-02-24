/**
 * Word 模板 API — SQLite 元数据
 * GET  /api/templates/word — 获取模板列表
 * POST /api/templates/word — 上传新模板
 *
 * 模板文件仍存储在磁盘：data/templates/word/{id}.docx
 * 元数据存储在 SQLite word_templates 表
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db/index';

const WORD_DIR = path.join(process.cwd(), 'data', 'templates', 'word');
const UPLOAD_ROLES = ['admin', 'manager'];

interface WordTemplateMeta {
    id: string;
    name: string;
    originalName: string;
    placeholders: string[];
    size: number;
    uploadedAt: string;
    uploadedBy: string;
}

function rowToMeta(r: any): WordTemplateMeta {
    return {
        id: r.id,
        name: r.name,
        originalName: r.original_name,
        placeholders: JSON.parse(r.placeholders || '[]'),
        size: r.size,
        uploadedAt: r.uploaded_at,
        uploadedBy: r.uploaded_by,
    };
}

/** GET — 获取 Word 模板列表 */
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const db = getDb();
        const rows = db.prepare('SELECT * FROM word_templates ORDER BY uploaded_at DESC').all() as any[];
        // 返回兼容旧格式的字段名
        const templates = rows.map(r => ({
            id: r.id,
            name: r.name,
            fileName: r.original_name,
            placeholders: JSON.parse(r.placeholders || '[]'),
            fileSizeBytes: r.size,
            uploadedAt: r.uploaded_at,
            updatedAt: r.uploaded_at,
            uploadedBy: r.uploaded_by,
        }));
        return NextResponse.json({ templates });
    } catch (error) {
        console.error('[word-templates GET] 错误:', error);
        return NextResponse.json({ error: '获取模板列表失败' }, { status: 500 });
    }
}

/** POST — 上传 Word 模板 */
export async function POST(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (!UPLOAD_ROLES.includes(session.role)) {
            return NextResponse.json(
                { error: `权限不足：角色 ${session.role} 无权上传模板` },
                { status: 403 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: '未提供文件' }, { status: 400 });
        }
        if (!file.name.endsWith('.docx')) {
            return NextResponse.json({ error: '仅支持 .docx 格式' }, { status: 400 });
        }
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: '文件过大，最大支持 10MB' }, { status: 400 });
        }

        await mkdir(WORD_DIR, { recursive: true });

        const buffer = Buffer.from(await file.arrayBuffer());
        const templateId = uuidv4();
        const filePath = path.join(WORD_DIR, `${templateId}.docx`);
        await writeFile(filePath, buffer);

        // 提取占位符
        let placeholders: string[] = [];
        let htmlContent = '';
        try {
            const mammoth = await import('mammoth');
            const result = await mammoth.default.convertToHtml({ buffer });
            htmlContent = result.value;
            const regex = /\{\{(\w+)\}\}/g;
            const found = new Set<string>();
            let match;
            while ((match = regex.exec(htmlContent)) !== null) {
                found.add(match[1]);
            }
            placeholders = Array.from(found);
        } catch (parseErr) {
            console.warn('[word-templates] 占位符提取失败，模板仍会保存:', parseErr);
        }

        // 保存 HTML 缓存
        if (htmlContent) {
            await writeFile(
                path.join(WORD_DIR, `${templateId}.html`),
                htmlContent,
                'utf-8'
            );
        }

        // 写入 SQLite
        const db = getDb();
        const now = new Date().toISOString();
        db.prepare(
            `INSERT INTO word_templates (id, name, original_name, size, placeholders, uploaded_by, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(templateId, file.name.replace('.docx', ''), file.name, file.size, JSON.stringify(placeholders), session.username, now);

        const meta = {
            id: templateId,
            name: file.name.replace('.docx', ''),
            fileName: file.name,
            placeholders,
            fileSizeBytes: file.size,
            uploadedAt: now,
            updatedAt: now,
            uploadedBy: session.username,
        };

        console.log(`[word-templates] 上传成功: ${meta.name} (${placeholders.length} 个占位符), 操作者: ${session.username}`);

        return NextResponse.json({ ok: true, template: meta });
    } catch (error) {
        console.error('[word-templates POST] 错误:', error);
        return NextResponse.json({ error: '上传失败: ' + String(error) }, { status: 500 });
    }
}