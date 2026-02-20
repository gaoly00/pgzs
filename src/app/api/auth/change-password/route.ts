/**
 * POST /api/auth/change-password
 * 用户自助修改密码（需验证旧密码）
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { findUserById, updateUserPassword } from '@/lib/auth/store';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { validatePassword } from '@/lib/auth/validators';

export async function POST(request: NextRequest) {
    try {
        // 验证登录状态
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }

        const body = await request.json();
        const { oldPassword, newPassword } = body;

        // 验证必填字段
        if (!oldPassword || typeof oldPassword !== 'string') {
            return NextResponse.json({ error: '请输入当前密码' }, { status: 400 });
        }

        // 验证新密码格式
        const pwResult = validatePassword(newPassword);
        if (!pwResult.valid) {
            return NextResponse.json({ error: pwResult.error }, { status: 400 });
        }

        // 读取用户记录
        const user = findUserById(session.userId);
        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        // 验证旧密码
        const oldMatch = await verifyPassword(oldPassword, user.passwordHash);
        if (!oldMatch) {
            return NextResponse.json({ error: '当前密码错误' }, { status: 403 });
        }

        // 哈希新密码并更新
        const newHash = await hashPassword(newPassword);
        const updated = updateUserPassword(session.userId, newHash);
        if (!updated) {
            return NextResponse.json({ error: '密码更新失败' }, { status: 500 });
        }

        console.log(`[change-password] 用户 ${user.username} (${user.id}) 已修改密码 @ ${new Date().toISOString()}`);

        return NextResponse.json({ ok: true, message: '密码修改成功' });
    } catch (error) {
        console.error('[change-password] 错误:', error);
        return NextResponse.json({ error: '密码修改失败' }, { status: 500 });
    }
}
