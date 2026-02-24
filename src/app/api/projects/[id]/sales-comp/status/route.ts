import { NextRequest, NextResponse } from 'next/server';
import { stat } from 'fs/promises';
import path from 'path';
import { verifySession } from '@/lib/auth/session';
import { getProject } from '@/lib/repositories/project-repo';

const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');
const PROJECT_WORKBOOK_FILENAME = 'sales_comp.xlsx';

/**
 * GET /api/projects/[id]/sales-comp/status
 * 查询项目的比较法工作簿状态（租户隔离）
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    if (!projectId) {
        return NextResponse.json({ error: '缺少项目 ID' }, { status: 400 });
    }

    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        // 租户隔离：验证项目归属
        const project = getProject(session.tenantId, projectId);
        if (!project) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        // 使用租户隔离路径
        const workbookPath = path.join(PROJECTS_DIR, session.tenantId, projectId, PROJECT_WORKBOOK_FILENAME);
        const fileStat = await stat(workbookPath);

        return NextResponse.json({
            exists: true,
            size: fileStat.size,
            updatedAt: fileStat.mtime.toISOString(),
        });
    } catch {
        return NextResponse.json({
            exists: false,
            size: 0,
            updatedAt: null,
        });
    }
}
