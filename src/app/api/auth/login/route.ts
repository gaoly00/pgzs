/**
 * POST /api/auth/login
 * 用户登录
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUsername, validatePassword } from '@/lib/auth/validators';
import { findUserByUsername } from '@/lib/auth/store';
import { verifyPassword } from '@/lib/auth/password';
import { createUserSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // 基本验证
        const usernameResult = validateUsername(username);
        if (!usernameResult.valid) {
            return NextResponse.json({ error: usernameResult.error }, { status: 400 });
        }

        const passwordResult = validatePassword(password);
        if (!passwordResult.valid) {
            return NextResponse.json({ error: passwordResult.error }, { status: 400 });
        }

        // 查找用户
        const normalized = username.trim().toLowerCase();
        const user = findUserByUsername(normalized);
        if (!user) {
            return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
        }

        // 验证密码
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
        }

        // 创建会话
        await createUserSession(user.id);

        return NextResponse.json({
            userId: user.id,
            username: user.username,
            role: user.role,
            tenantId: user.tenantId,
            message: '登录成功',
        });
    } catch (error) {
        console.error('[login] 登录失败:', error);
        return NextResponse.json({ error: '登录失败' }, { status: 500 });
    }
}
