import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { verifySession } from '@/lib/auth/session';
import { getProject } from '@/lib/repositories/project-repo';

const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');
const PROJECT_WORKBOOK_FILENAME = 'sales_comp.xlsx';

/**
 * GET /api/projects/[id]/sales-comp/download
 * 下载项目的比较法工作簿副本（租户隔离）
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

        try {
            await stat(workbookPath);
        } catch {
            return NextResponse.json(
                { error: '项目工作簿未找到。请确保母板模板已上传且项目已正确创建。' },
                { status: 404 }
            );
        }

        const fileBuffer = await readFile(workbookPath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="sales-comp-${projectId}.xlsx"`,
                'Content-Length': String(fileBuffer.length),
            },
        });
    } catch (error) {
        console.error('[工作簿下载] 错误:', error);
        return NextResponse.json({ error: '下载失败' }, { status: 500 });
    }
}
