/**
 * Word 模板 API
 * GET  /api/templates/word — 获取模板列表（元数据，不含 base64）
 * POST /api/templates/word — 上传新模板
 * 
 * 模板文件存储：data/templates/word/{id}.docx
 * 元数据存储：data/templates/word-templates.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const WORD_DIR = path.join(process.cwd(), 'data', 'templates', 'word');
const META_FILE = path.join(process.cwd(), 'data', 'templates', 'word-templates.json');

// 允许上传的角色
const UPLOAD_ROLES = ['admin', 'manager'];

// 模板元数据类型
interface WordTemplateMeta {
    id: string;
    name: string;
    fileName: string;
    placeholders: string[];
    fileSizeBytes: number;
    uploadedAt: string;
    updatedAt: string;
    uploadedBy: string;
}

// 读取元数据文件
async function readMetas(): Promise<WordTemplateMeta[]> {
    try {
        const raw = await readFile(META_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

// 写入元数据文件
async function writeMetas(metas: WordTemplateMeta[]): Promise<void> {
    await mkdir(path.dirname(META_FILE), { recursive: true });
    const tmp = META_FILE + '.tmp';
    await writeFile(tmp, JSON.stringify(metas, null, 2), 'utf-8');
    const fs = await import('fs');
    fs.renameSync(tmp, META_FILE);
}

/** GET — 获取 Word 模板列表 */
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const metas = await readMetas();
        return NextResponse.json({ templates: metas });
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

        // 限制 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: '文件过大，最大支持 10MB' }, { status: 400 });
        }

        // 确保目录存在
        await mkdir(WORD_DIR, { recursive: true });

        // 文件内容
        const buffer = Buffer.from(await file.arrayBuffer());
        const templateId = uuidv4();
        const filePath = path.join(WORD_DIR, `${templateId}.docx`);
        await writeFile(filePath, buffer);

        // 提取占位符（从 docx 转 HTML 再提取）
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

        // 保存 HTML 缓存（用于报告生成时快速读取）
        if (htmlContent) {
            await writeFile(
                path.join(WORD_DIR, `${templateId}.html`),
                htmlContent,
                'utf-8'
            );
        }

        // 更新元数据
        const metas = await readMetas();
        const meta: WordTemplateMeta = {
            id: templateId,
            name: file.name.replace('.docx', ''),
            fileName: file.name,
            placeholders,
            fileSizeBytes: file.size,
            uploadedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            uploadedBy: session.username,
        };
        metas.push(meta);
        await writeMetas(metas);

        console.log(`[word-templates] 上传成功: ${meta.name} (${placeholders.length} 个占位符), 操作者: ${session.username}`);

        return NextResponse.json({
            ok: true,
            template: meta,
        });
    } catch (error) {
        console.error('[word-templates POST] 错误:', error);
        return NextResponse.json({ error: '上传失败: ' + String(error) }, { status: 500 });
    }
}
