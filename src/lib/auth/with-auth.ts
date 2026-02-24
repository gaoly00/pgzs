/**
 * 统一 API 鉴权中间件
 *
 * 封装 verifySession 检查，减少每个 API 路由的重复代码。
 * 支持角色白名单校验。
 *
 * 用法：
 *   export const GET = withAuth(async (req, session) => { ... });
 *   export const POST = withAuth(async (req, session) => { ... }, ['admin', 'manager']);
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

/** 鉴权后的会话信息 */
export interface AuthSession {
    userId: string;
    username: string;
    role: string;
    tenantId: string;
}

/** 鉴权后的请求处理函数 */
type AuthHandler = (
    request: NextRequest,
    session: AuthSession,
    context?: any,
) => Promise<NextResponse | Response>;

/**
 * 统一鉴权包装器
 * @param handler - 鉴权通过后执行的处理函数
 * @param allowedRoles - 可选，允许的角色列表，为空则所有已登录用户可访问
 */
export function withAuth(handler: AuthHandler, allowedRoles?: string[]) {
    return async (request: NextRequest, context?: any) => {
        try {
            const session = await verifySession();

            if (!session) {
                return NextResponse.json(
                    { error: '未登录，请先登录' },
                    { status: 401 },
                );
            }

            // 角色校验
            if (allowedRoles && allowedRoles.length > 0) {
                if (!allowedRoles.includes(session.role)) {
                    return NextResponse.json(
                        { error: `权限不足：需要 ${allowedRoles.join('/')} 角色` },
                        { status: 403 },
                    );
                }
            }

            return await handler(request, session, context);
        } catch (error) {
            console.error('[withAuth] 未预期错误:', error);
            return NextResponse.json(
                { error: '服务器内部错误' },
                { status: 500 },
            );
        }
    };
}
