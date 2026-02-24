/**
 * GET /api/admin/audit-logs — 获取审计日志（仅 admin 可访问）
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { readRecentAuditLogs } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (session.role !== 'admin') {
            return NextResponse.json({ error: '仅管理员可查看审计日志' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

        const logs = readRecentAuditLogs(limit);

        // 倒序返回（最新在前）
        return NextResponse.json({ logs: logs.reverse(), total: logs.length });
    } catch (error) {
        console.error('[audit-logs] 错误:', error);
        return NextResponse.json({ error: '获取审计日志失败' }, { status: 500 });
    }
}
