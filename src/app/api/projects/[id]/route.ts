/**
 * 单项目 API
 * GET    /api/projects/[id] — 获取项目详情
 * PATCH  /api/projects/[id] — 更新项目（部分更新）
 * DELETE /api/projects/[id] — 删除项目
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import {
    getProject,
    updateProject,
    deleteProject,
} from '@/lib/repositories/project-repo';
import { writeAuditLog, AuditAction } from '@/lib/audit-logger';

/** GET — 获取项目详情 */
export const GET = withAuth(async (
    _request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
) => {
    const { id: projectId } = await params;
    const project = getProject(session.tenantId, projectId);

    if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    return NextResponse.json({ project });
});

/** PATCH — 部分更新项目 */
export const PATCH = withAuth(async (
    request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
) => {
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
});

/** DELETE — 删除项目 */
export const DELETE = withAuth(async (
    _request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
) => {
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
}, ['admin', 'manager']);
