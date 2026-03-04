/**
 * DELETE /api/templates/word/[id] — 删除 Word 模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

const WORD_DIR = path.join(process.cwd(), 'data', 'templates', 'word');
const META_FILE = path.join(process.cwd(), 'data', 'templates', 'word-templates.json');

export const DELETE = withAuth(async (
    _request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id: templateId } = await params;

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
}, ['admin', 'manager']);
