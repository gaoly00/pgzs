/**
 * POST /api/auth/register
 * 用户注册
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validateUsername, validatePassword } from '@/lib/auth/validators';
import { findUserByUsername, createUser } from '@/lib/auth/store';
import { hashPassword } from '@/lib/auth/password';
import { createUserSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // 验证用户名
        const usernameResult = validateUsername(username);
        if (!usernameResult.valid) {
            return NextResponse.json({ error: usernameResult.error }, { status: 400 });
        }

        // 验证密码
        const passwordResult = validatePassword(password);
        if (!passwordResult.valid) {
            return NextResponse.json({ error: passwordResult.error }, { status: 400 });
        }

        // 检查用户名是否已存在（大小写不敏感）
        const normalized = username.trim().toLowerCase();
        const existing = findUserByUsername(normalized);
        if (existing) {
            return NextResponse.json({ error: '该用户名已被注册' }, { status: 409 });
        }

        // 创建用户（用户名 'admin' 自动获得管理员角色）
        const passwordHash = await hashPassword(password);
        const userId = uuidv4();
        const role = normalized === 'admin' ? 'admin' : 'valuer';
        createUser({
            id: userId,
            username: normalized,
            passwordHash,
            role: role as any,
            createdAt: new Date().toISOString(),
        });

        // 创建会话
        await createUserSession(userId);

        return NextResponse.json({
            userId,
            username: normalized,
            message: '注册成功',
        });
    } catch (error) {
        console.error('[register] 注册失败:', error);
        return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }
}
