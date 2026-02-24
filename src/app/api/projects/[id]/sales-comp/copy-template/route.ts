import { NextRequest, NextResponse } from 'next/server';
import { mkdir, copyFile, stat } from 'fs/promises';
import path from 'path';
import { verifySession } from '@/lib/auth/session';
import { getProject } from '@/lib/repositories/project-repo';

// 路径常量
const TEMPLATES_DIR = path.join(process.cwd(), 'data', 'templates');
const PROJECTS_DIR = path.join(process.cwd(), 'data', 'projects');
const TEMPLATE_FILENAME = 'sales_comp_template.xlsx';
const PROJECT_WORKBOOK_FILENAME = 'sales_comp.xlsx';

/**
 * POST /api/projects/[id]/sales-comp/copy-template
 * 将母板模板复制到项目工作簿目录（租户隔离）
 */
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    if (!projectId) {
        return NextResponse.json(
            { ok: false, error: '缺少项目 ID' },
            { status: 400 }
        );
    }

    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 });
        }

        // 租户隔离：验证项目归属
        const project = getProject(session.tenantId, projectId);
        if (!project) {
            return NextResponse.json({ ok: false, error: '项目不存在' }, { status: 404 });
        }

        const templatePath = path.join(TEMPLATES_DIR, TEMPLATE_FILENAME);

        // 检查母板模板是否存在
        try {
            await stat(templatePath);
        } catch {
            return NextResponse.json({
                ok: false,
                templateMissing: true,
                error: '母板模板尚未上传，请管理员先上传比较法模板',
            });
        }

        // 创建项目工作簿目录（租户隔离路径）
        const projectDir = path.join(PROJECTS_DIR, session.tenantId, projectId);
        await mkdir(projectDir, { recursive: true });

        // 复制母板到项目目录
        const workbookPath = path.join(projectDir, PROJECT_WORKBOOK_FILENAME);
        await copyFile(templatePath, workbookPath);

        console.log(`[模板复制] 已将母板复制到项目 ${projectId}: ${workbookPath}`);

        return NextResponse.json({
            ok: true,
            message: '工作簿副本创建成功',
        });
    } catch (error) {
        console.error('[模板复制] 错误:', error);
        return NextResponse.json(
            { ok: false, error: '复制模板失败' },
            { status: 500 }
        );
    }
}
