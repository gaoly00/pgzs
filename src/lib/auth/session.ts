/**
 * 会话管理 — Token 生成、Cookie 设置、验证
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createSession, findSession, deleteSession, findUserById } from './store';

const COOKIE_NAME = 'sv_session';
const SESSION_TTL_DAYS = 7;

/** 对 token 进行 SHA-256 哈希（数据库中只存哈希，不存明文） */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** 创建会话并设置 Cookie，返回 userId */
export async function createUserSession(userId: string): Promise<void> {
    // 生成随机 token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

    // 存储会话记录
    createSession({
        tokenHash,
        userId,
        expiresAt: expiresAt.toISOString(),
    });

    // 设置 httpOnly Cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: expiresAt,
    });
}

/** 从 Cookie 验证会话，返回 userId/username/role 或 null */
export async function verifySession(): Promise<{ userId: string; username: string; role: string } | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = findSession(tokenHash);
    if (!session) return null;

    const user = findUserById(session.userId);
    if (!user) return null;

    return { userId: user.id, username: user.username, role: user.role || 'valuer' };
}

/** 登出：清除 Cookie + 删除会话记录 */
export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (token) {
        const tokenHash = hashToken(token);
        deleteSession(tokenHash);
    }

    cookieStore.delete(COOKIE_NAME);
}

/** 仅用于 middleware — 同步验证（不依赖 next/headers） */
export function verifyTokenSync(token: string): string | null {
    const tokenHash = hashToken(token);
    const session = findSession(tokenHash);
    return session?.userId ?? null;
}
