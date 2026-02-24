/**
 * Next.js Middleware — 路由保护 + HMAC 签名验证
 *
 * Edge Runtime 兼容：使用 Web Crypto API 验证 cookie 签名。
 * 这是第一道防线，API 层再做完整的会话查找。
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'sv_session';

function getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET 环境变量未设置');
    return secret;
}

// 受保护路径前缀
const PROTECTED_PREFIXES = ['/projects', '/settings', '/admin'];

// 公开路径（不需要认证）
const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/forgot-password'];

/** 将 hex 字符串转为 Uint8Array */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
}

/** 将 ArrayBuffer 转为 hex 字符串 */
function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/** 使用 Web Crypto API 进行 HMAC-SHA256 签名 */
async function hmacSign(data: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    return bufferToHex(sig);
}

/** 时间安全的字符串比较（防止时序攻击） */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const aBuf = hexToBytes(a);
    const bBuf = hexToBytes(b);
    if (aBuf.length !== bBuf.length) return false;
    let result = 0;
    for (let i = 0; i < aBuf.length; i++) {
        result |= aBuf[i] ^ bBuf[i];
    }
    return result === 0;
}

/** 验证 cookie 的 HMAC 签名 */
async function verifyCookieSignature(cookieValue: string): Promise<boolean> {
    const dotIndex = cookieValue.lastIndexOf('.');
    if (dotIndex === -1) return false;

    const token = cookieValue.slice(0, dotIndex);
    const sig = cookieValue.slice(dotIndex + 1);
    if (!token || !sig) return false;

    const expected = await hmacSign(token, getSessionSecret());
    return timingSafeEqual(sig, expected);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 检查是否是公开路径
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (isPublic) {
        return NextResponse.next();
    }

    // 检查是否是受保护路径
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isProtected) {
        return NextResponse.next();
    }

    // 检查 session cookie 是否存在
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value;
    if (!sessionCookie) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 验证 HMAC 签名（防止伪造 cookie）
    const valid = await verifyCookieSignature(sessionCookie);
    if (!valid) {
        // 签名无效，清除伪造的 cookie 并重定向
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete(COOKIE_NAME);
        return response;
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // 匹配所有路径，但排除静态资源和 API（由 API 自行处理）
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};
