/**
 * GET /api/admin/audit-logs — 获取审计日志（仅 admin 可访问）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { readRecentAuditLogs } from '@/lib/audit-logger';

export const GET = withAuth(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

    const logs = readRecentAuditLogs(limit);

    // 倒序返回（最新在前）
    return NextResponse.json({ logs: logs.reverse(), total: logs.length });
}, ['admin']);
