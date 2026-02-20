/**
 * POST /api/auth/logout
 * 用户登出
 */

import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST() {
    try {
        await destroySession();
        return NextResponse.json({ message: '已登出' });
    } catch (error) {
        console.error('[logout] 登出失败:', error);
        return NextResponse.json({ error: '登出失败' }, { status: 500 });
    }
}
