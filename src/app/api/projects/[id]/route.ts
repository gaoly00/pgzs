/**
 * 单项目 API
 * GET    /api/projects/[id] — 获取项目详情
 * PATCH  /api/projects/[id] — 更新项目（部分更新）
 * DELETE /api/projects/[id] — 删除项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import {
    getProject,
    updateProject,
    deleteProject,
} from '@/lib/repositories/project-repo';
import { writeAuditLog, AuditAction } from '@/lib/audit-logger';

/** GET — 获取项目详情 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id: projectId } = await params;
        const project = getProject(session.tenantId, projectId);

        if (!project) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        return NextResponse.json({ project });
    } catch (error) {
        console.error('[project GET] 错误:', error);
        return NextResponse.json({ error: '获取项目失败' }, { status: 500 });
    }
}

/** PATCH — 部分更新项目 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const { id: projectId } = await params;
        const body = await request.json();

        // 安全字段白名单（不允许修改 id/tenantId/createdAt/createdBy）
        const allowedFields = [
            'name', 'projectNumber', 'projectType', 'valuationDate',
            'propertyType', 'gfa', 'address', 'valuationMethods',
            'salesAnchors', 'salesResult', 'extractedMetrics',
            'customFields', 'templateId', 'reportContent', 'status',
        ];

        const patch: Record<string, any> = {};
        for (const key of allowedFields) {
            if (key in body) {
                patch[key] = body[key];
            }
        }

        const updated = updateProject(session.tenantId, projectId, patch);
        if (!updated) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, project: updated });
    } catch (error) {
        console.error('[project PATCH] 错误:', error);
        return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
    }
}

/** DELETE — 删除项目 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        // 仅 admin/manager 可删除项目
        if (!['admin', 'manager'].includes(session.role)) {
            return NextResponse.json({ error: '权限不足：仅管理员可删除项目' }, { status: 403 });
        }

        const { id: projectId } = await params;
        const success = deleteProject(session.tenantId, projectId);

        if (!success) {
            return NextResponse.json({ error: '项目不存在' }, { status: 404 });
        }

        // 审计日志
        writeAuditLog({
            action: AuditAction.PROJECT_DELETE,
            userId: session.userId,
            username: session.username,
            tenantId: session.tenantId,
            targetId: projectId,
            targetType: 'project',
            details: `删除项目: ${projectId}`,
        });

        return NextResponse.json({ ok: true, message: '项目已删除' });
    } catch (error) {
        console.error('[project DELETE] 错误:', error);
        return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
    }
}
