/**
 * 会话管理 — Token 生成、HMAC 签名、Cookie 设置、验证
 *
 * Cookie 格式: token.hmac_signature
 * - token: 32 字节随机值的 hex 编码
 * - hmac_signature: HMAC-SHA256(token, SESSION_SECRET) 的 hex 编码
 *
 * Middleware（Edge Runtime）可以仅通过 HMAC 验证 cookie 是否由服务端签发，
 * 无需访问文件系统。API 层再做完整的会话查找。
 */

import { cookies } from 'next/headers';
import crypto from 'crypto';
import { createSession, findSession, deleteSession, findUserById } from './store';

export const COOKIE_NAME = 'sv_session';
const SESSION_TTL_DAYS = 7;

/**
 * 会话签名密钥
 * 必须通过 SESSION_SECRET 环境变量设置。
 */
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('SESSION_SECRET 环境变量未设置');
export const SESSION_SECRET = secret;

/** 对 token 进行 SHA-256 哈希（存储层只存哈希，不存明文） */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/** 对 token 进行 HMAC-SHA256 签名 */
function signToken(token: string): string {
    return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

/** 组装 cookie 值: token.signature */
function packCookie(token: string): string {
    return `${token}.${signToken(token)}`;
}

/** 解析 cookie 值，验证签名，返回 token 或 null */
export function unpackCookie(cookieValue: string): string | null {
    const dotIndex = cookieValue.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const token = cookieValue.slice(0, dotIndex);
    const sig = cookieValue.slice(dotIndex + 1);

    if (!token || !sig) return null;

    // 使用 timingSafeEqual 防止时序攻击
    const expected = signToken(token);
    if (sig.length !== expected.length) return null;

    try {
        const sigBuf = Buffer.from(sig, 'hex');
        const expectedBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expectedBuf.length) return null;
        if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
    } catch {
        return null;
    }

    return token;
}

/** 创建会话并设置 Cookie */
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

    // 设置 httpOnly Cookie（带 HMAC 签名）
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, packCookie(token), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: expiresAt,
    });
}

/** 从 Cookie 验证会话，返回用户信息或 null */
export async function verifySession(): Promise<{
    userId: string;
    username: string;
    role: string;
    tenantId: string;
} | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return null;

    // 验证 HMAC 签名
    const token = unpackCookie(raw);
    if (!token) return null;

    const tokenHash = hashToken(token);
    const session = findSession(tokenHash);
    if (!session) return null;

    const user = findUserById(session.userId);
    if (!user) return null;

    return {
        userId: user.id,
        username: user.username,
        role: user.role || 'valuer',
        tenantId: user.tenantId || `tenant_${user.id.slice(0, 8)}`,
    };
}

/** 登出：清除 Cookie + 删除会话记录 */
export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;

    if (raw) {
        const token = unpackCookie(raw);
        if (token) {
            const tokenHash = hashToken(token);
            deleteSession(tokenHash);
        }
    }

    cookieStore.delete(COOKIE_NAME);
}
