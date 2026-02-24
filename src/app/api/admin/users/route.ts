/**
 * GET  /api/admin/users — 获取当前租户的用户列表（脱敏）
 * PATCH /api/admin/users — 修改用户角色（仅限同租户）
 *
 * 仅 admin 可修改角色，manager 可查看列表
 * 所有操作限定在当前用户所属租户范围内
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { readUsers, findUserById, updateUserRole, type UserRole } from '@/lib/auth/store';

const VALID_ROLES: UserRole[] = ['admin', 'manager', 'reviewer', 'valuer'];
const VIEW_ROLES = ['admin', 'manager'];
const EDIT_ROLES = ['admin'];

/** GET — 获取当前租户的用户列表 */
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (!VIEW_ROLES.includes(session.role)) {
            return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        const users = readUsers()
            .filter((u) => u.tenantId === session.tenantId)
            .map((u) => ({
                id: u.id,
                username: u.username,
                role: u.role || 'valuer',
                createdAt: u.createdAt,
            }));

        return NextResponse.json({ users });
    } catch (error) {
        console.error('[admin/users GET] 错误:', error);
        return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
    }
}

/** PATCH — 修改用户角色（仅限同租户） */
export async function PATCH(request: NextRequest) {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (!EDIT_ROLES.includes(session.role)) {
            return NextResponse.json({ error: '权限不足：仅 admin 可修改用户角色' }, { status: 403 });
        }

        const body = await request.json();
        const { userId, role } = body;

        if (!userId || !role) {
            return NextResponse.json({ error: '缺少 userId 或 role 参数' }, { status: 400 });
        }

        if (!VALID_ROLES.includes(role)) {
            return NextResponse.json({ error: `无效角色: ${role}` }, { status: 400 });
        }

        if (userId === session.userId) {
            return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
        }

        const user = findUserById(userId);
        if (!user || user.tenantId !== session.tenantId) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const oldRole = user.role || 'valuer';
        updateUserRole(userId, role);

        console.log(`[admin/users PATCH] 用户 ${user.username} 角色: ${oldRole} → ${role}，操作者: ${session.username}`);

        return NextResponse.json({
            ok: true,
            message: `用户 ${user.username} 角色已更新为 ${role}`,
            user: { id: user.id, username: user.username, role },
        });
    } catch (error) {
        console.error('[admin/users PATCH] 错误:', error);
        return NextResponse.json({ error: '修改角色失败' }, { status: 500 });
    }
}
