/**
 * Next.js Middleware — 路由保护
 *
 * 检查受保护路径是否携带 sv_session Cookie。
 * 注意：Middleware 运行在 Edge Runtime，无法直接读取 fs。
 * Cookie 存在性检查作为第一道防线，真正的会话验证在 API/页面层完成。
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 受保护路径前缀
const PROTECTED_PREFIXES = ['/projects', '/settings'];

// 公开路径（不需要认证）
const PUBLIC_PATHS = ['/login', '/register', '/api/auth', '/forgot-password', '/admin'];

export function middleware(request: NextRequest) {
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
    const sessionToken = request.cookies.get('sv_session')?.value;
    if (!sessionToken) {
        // 重定向到登录页
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // 匹配所有路径，但排除静态资源和 API（由 API 自行处理）
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};
