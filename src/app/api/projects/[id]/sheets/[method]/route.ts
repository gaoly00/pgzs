/**
 * 工作簿 Sheet API
 * GET /api/projects/[id]/sheets/[method] — 获取工作簿数据
 * PUT /api/projects/[id]/sheets/[method] — 保存工作簿数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { getProject } from '@/lib/repositories/project-repo';
import { getSheetData, saveSheetData } from '@/lib/repositories/sheet-repo';

/** GET — 获取工作簿数据 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; method: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id: projectId, method } = await params;

        // 校验项目归属
        const project = getProject(session.tenantId, projectId);
        if (!project) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        const data = getSheetData(session.tenantId, projectId, method);
        return NextResponse.json({ data });
    } catch (error) {
        console.error('[sheet GET] 错误:', error);
        return NextResponse.json({ error: '获取工作簿失败' }, { status: 500 });
    }
}

/** PUT — 保存工作簿数据 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; method: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id: projectId, method } = await params;

        // 校验项目归属
        const project = getProject(session.tenantId, projectId);
        if (!project) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        const body = await request.json();
        const { data } = body;

        if (!data) {
            return NextResponse.json({ error: '缺少 data 字段' }, { status: 400 });
        }

        saveSheetData(session.tenantId, projectId, method, data);

        return NextResponse.json({ ok: true, message: '保存成功' });
    } catch (error) {
        console.error('[sheet PUT] 错误:', error);
        return NextResponse.json({ error: '保存工作簿失败' }, { status: 500 });
    }
}
