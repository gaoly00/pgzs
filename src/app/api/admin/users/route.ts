/**
 * GET  /api/admin/users — 获取所有用户列表（脱敏）
 * PATCH /api/admin/users — 修改用户角色
 * 
 * 仅 admin 可修改角色，manager 可查看列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { readUsers, findUserById, type UserRole } from '@/lib/auth/store';
import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data', 'users.json');
const VALID_ROLES: UserRole[] = ['admin', 'manager', 'reviewer', 'valuer'];
const VIEW_ROLES = ['admin', 'manager']; // 可以查看用户列表的角色
const EDIT_ROLES = ['admin'];            // 可以修改角色的角色

/** GET — 获取用户列表 */
export async function GET() {
    try {
        const session = await verifySession();
        if (!session) {
            return NextResponse.json({ error: '未登录' }, { status: 401 });
        }
        if (!VIEW_ROLES.includes(session.role)) {
            return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        const users = readUsers().map((u) => ({
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

/** PATCH — 修改用户角色 */
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

        // 不能修改自己的角色（防止 admin 把自己降级）
        if (userId === session.userId) {
            return NextResponse.json({ error: '不能修改自己的角色' }, { status: 400 });
        }

        const users = readUsers();
        const idx = users.findIndex((u) => u.id === userId);
        if (idx === -1) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }

        const oldRole = users[idx].role || 'valuer';
        users[idx].role = role;

        // 原子写入
        const tmp = USERS_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf-8');
        fs.renameSync(tmp, USERS_FILE);

        console.log(`[admin/users PATCH] 用户 ${users[idx].username} 角色: ${oldRole} → ${role}，操作者: ${session.username}`);

        return NextResponse.json({
            ok: true,
            message: `用户 ${users[idx].username} 角色已更新为 ${role}`,
            user: {
                id: users[idx].id,
                username: users[idx].username,
                role: users[idx].role,
            },
        });
    } catch (error) {
        console.error('[admin/users PATCH] 错误:', error);
        return NextResponse.json({ error: '修改角色失败' }, { status: 500 });
    }
}
