/**
 * DELETE /api/templates/word/[id] — 删除 Word 模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const WORD_DIR = path.join(process.cwd(), 'data', 'templates', 'word');
const META_FILE = path.join(process.cwd(), 'data', 'templates', 'word-templates.json');
const DELETE_ROLES = ['admin', 'manager'];

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: templateId } = await params;
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (!DELETE_ROLES.includes(session.role)) {
            return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        // 读取元数据
        let metas: any[] = [];
        try {
            const raw = await readFile(META_FILE, 'utf-8');
            metas = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: '模板不存在' }, { status: 404 });
        }

        const idx = metas.findIndex((m: any) => m.id === templateId);
        if (idx === -1) {
            return NextResponse.json({ error: '模板不存在' }, { status: 404 });
        }

        const removed = metas.splice(idx, 1)[0];

        // 删除文件
        try { await unlink(path.join(WORD_DIR, `${templateId}.docx`)); } catch { /* 忽略 */ }
        try { await unlink(path.join(WORD_DIR, `${templateId}.html`)); } catch { /* 忽略 */ }

        // 更新元数据
        await mkdir(path.dirname(META_FILE), { recursive: true });
        await writeFile(META_FILE, JSON.stringify(metas, null, 2), 'utf-8');

        console.log(`[word-templates] 删除: ${removed.name}, 操作者: ${session.username}`);

        return NextResponse.json({ ok: true, message: `模板「${removed.name}」已删除` });
    } catch (error) {
        console.error('[word-templates DELETE] 错误:', error);
        return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }
}
