/**
 * POST /api/projects/[id]/report/snapshot
 *
 * 创建报告快照 — 锁定当前 extractedMetrics 并返回 snapshotId。
 * 前端将 extractedMetrics + projectName 作为 JSON body 传入，
 * 因为数据目前存储在客户端 Zustand store 中。
 *
 * Request Body:
 *   { extractedMetrics: Record<string, string|number|null>, projectName?: string }
 *
 * Response:
 *   { snapshotId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSnapshot } from '@/lib/snapshot-store';
import { verifySession } from '@/lib/auth/session';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id: projectId } = await params;

    try {
        // 鉴权
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
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
            projectName || 'Untitled Project',
            extractedMetrics,
        );

        return NextResponse.json({ snapshotId: snapshot.snapshotId });
    } catch (error) {
        console.error('[snapshot] 创建快照失败:', error);
        return NextResponse.json(
            { error: '创建快照失败' },
            { status: 500 },
        );
    }
}
