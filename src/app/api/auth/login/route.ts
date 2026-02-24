/**
 * POST /api/auth/login
 * 用户登录（含速率限制 + 失败锁定）
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUsername, validatePassword } from '@/lib/auth/validators';
import { findUserByUsername } from '@/lib/auth/store';
import { verifyPassword } from '@/lib/auth/password';
import { createUserSession } from '@/lib/auth/session';
import { writeAuditLog, AuditAction } from '@/lib/audit-logger';
import {
    checkRateLimit,
    checkLockout,
    recordFailure,
    resetFailures,
} from '@/lib/auth/rate-limiter';

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

        // 1. IP 级速率限制：每分钟最多 10 次登录尝试
        const rateResult = checkRateLimit(`login:${clientIp}`, 10, 60_000);
        if (!rateResult.allowed) {
            const retryAfterSec = Math.ceil(rateResult.retryAfterMs / 1000);
            return NextResponse.json(
                { error: `请求过于频繁，请 ${retryAfterSec} 秒后重试` },
                {
                    status: 429,
                    headers: { 'Retry-After': String(retryAfterSec) },
                },
            );
        }

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

        const normalized = username.trim().toLowerCase();

        // 2. 账户级锁定检查
        const lockout = checkLockout(`user:${normalized}`);
        if (lockout.locked) {
            const remainMin = Math.ceil(lockout.remainingMs / 60_000);
            return NextResponse.json(
                { error: `账户已锁定，请 ${remainMin} 分钟后重试` },
                { status: 423 },
            );
        }

        // 查找用户
        const user = findUserByUsername(normalized);
        if (!user) {
            recordFailure(`user:${normalized}`);
            return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
        }

        // 验证密码
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            const result = recordFailure(`user:${normalized}`);
            const msg = result.locked
                ? '密码错误次数过多，账户已锁定 15 分钟'
                : `用户名或密码错误（还可尝试 ${5 - result.failureCount} 次）`;
            return NextResponse.json({ error: msg }, { status: 401 });
        }

        // 登录成功：重置失败计数
        resetFailures(`user:${normalized}`);

        // 创建会话
        await createUserSession(user.id);

        // 审计日志
        writeAuditLog({
            action: AuditAction.USER_LOGIN,
            userId: user.id,
            username: user.username,
            tenantId: user.tenantId,
            details: `登录成功 (IP: ${clientIp})`,
        });

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
