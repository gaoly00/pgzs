/**
 * GET /api/auth/me
 * 返回当前登录用户信息
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';

export const GET = withAuth(async (_request, session) => {
    return NextResponse.json({
        userId: session.userId,
        username: session.username,
        role: session.role,
        tenantId: session.tenantId,
    });
});
