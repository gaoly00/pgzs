/**
 * POST /api/projects/[id]/report/snapshot
 *
 * 创建报告快照 — 锁定当前 extractedMetrics 并返回 snapshotId。
 * 包含租户隔离校验。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSnapshot } from '@/lib/snapshot-store';
import { withAuth } from '@/lib/auth/with-auth';
import { getProject } from '@/lib/repositories/project-repo';

export const POST = withAuth(async (
    request: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id: projectId } = await params;

    // 租户隔离：验证项目归属
    const project = getProject(session.tenantId, projectId);
    if (!project) {
        return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { extractedMetrics, projectName } = body;

    if (!extractedMetrics || typeof extractedMetrics !== 'object') {
        return NextResponse.json(
            { error: '缺少 extractedMetrics 参数' },
            { status: 400 },
        );
    }

    const snapshot = createSnapshot(
        projectId,
        projectName || project.name,
        extractedMetrics,
    );

    return NextResponse.json({ snapshotId: snapshot.snapshotId });
});
