/**
 * POST /api/auth/register
 * 用户注册（含速率限制）
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { validateUsername, validatePassword } from '@/lib/auth/validators';
import { findUserByUsername, createUser } from '@/lib/auth/store';
import { hashPassword } from '@/lib/auth/password';
import { createUserSession } from '@/lib/auth/session';
import { ensureTenantExists } from '@/lib/repositories/tenant-repo';
import { checkRateLimit } from '@/lib/auth/rate-limiter';

/** 从请求中提取客户端 IP */
function getClientIp(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

export async function POST(request: NextRequest) {
    try {
        const clientIp = getClientIp(request);

        // IP 级速率限制：每小时最多 5 次注册
        const rateResult = checkRateLimit(`register:${clientIp}`, 5, 3600_000);
        if (!rateResult.allowed) {
            const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
            return NextResponse.json(
                { error: `注册请求过于频繁，请稍后重试` },
                {
                    status: 429,
                    headers: { 'Retry-After': String(retryAfterSec) },
                },
            );
        }

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

        // 创建用户
        const passwordHash = await hashPassword(password);
        const userId = uuidv4();
        const tenantId = `tenant_${uuidv4().slice(0, 8)}`;
        const role = normalized === 'admin' ? 'admin' : 'valuer';
        createUser({
            id: userId,
            username: normalized,
            passwordHash,
            role: role as any,
            tenantId,
            createdAt: new Date().toISOString(),
        });

        // 确保租户记录存在
        ensureTenantExists(tenantId, `${normalized}的租户`);

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
