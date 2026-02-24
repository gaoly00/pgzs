/**
 * GET /api/auth/me
 * 返回当前登录用户信息
 */

import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

export async function GET() {
    try {
        const user = await verifySession();
        if (!user) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        return NextResponse.json({
            userId: user.userId,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
        });
    } catch (error) {
        console.error('[me] 获取用户信息失败:', error);
        return NextResponse.json({ error: '获取用户信息失败' }, { status: 500 });
    }
}
