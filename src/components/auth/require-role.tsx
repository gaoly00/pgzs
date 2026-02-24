'use client';

/**
 * RequireRole — 前端路由级权限守卫
 * 
 * 用法：
 * <RequireRole allowedRoles={['admin', 'manager']}>
 *   <AdminContent />
 * </RequireRole>
 */

import { useEffect, useState } from 'react';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { apiGet } from '@/lib/api-client';

export type UserRole = 'admin' | 'manager' | 'reviewer' | 'valuer';

interface CurrentUser {
    userId: string;
    username: string;
    role: UserRole;
    tenantId: string;
}

interface RequireRoleProps {
    allowedRoles: UserRole[];
    children: React.ReactNode;
    /** 可选：传入当前用户数据，避免重复请求 */
    currentUser?: CurrentUser | null;
}

export function RequireRole({ allowedRoles, children, currentUser: externalUser }: RequireRoleProps) {
    const [user, setUser] = useState<CurrentUser | null>(externalUser ?? null);
    const [status, setStatus] = useState<'loading' | 'authorized' | 'forbidden' | 'unauthenticated'>(
        externalUser ? (allowedRoles.includes(externalUser.role) ? 'authorized' : 'forbidden') : 'loading'
    );

    useEffect(() => {
        if (externalUser) return; // 外部已传入用户数据

        apiGet<CurrentUser>('/api/auth/me')
            .then((result) => {
                if (!result.ok) {
                    // api-client already redirects to /login on 401
                    setStatus('unauthenticated');
                    return;
                }
                setUser(result.data);
                if (allowedRoles.includes(result.data.role)) {
                    setStatus('authorized');
                } else {
                    setStatus('forbidden');
                }
            })
            .catch((err) => {
                console.error('权限校验失败:', err);
                setStatus('forbidden');
            });
    }, [allowedRoles, externalUser]);

    if (status === 'loading') {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">验证权限中...</p>
                </div>
            </div>
        );
    }

    if (status === 'forbidden') {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4 max-w-md text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/50">
                        <ShieldX className="h-10 w-10 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold">403 — 权限不足</h2>
                    <p className="text-sm text-muted-foreground">
                        您的角色 <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">{user?.role || 'unknown'}</code> 无权访问此页面。
                        <br />需要角色：{allowedRoles.join(' / ')}
                    </p>
                    <Link href="/projects">
                        <Button variant="outline">返回项目列表</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return null; // 正在跳转登录页
    }

    return <>{children}</>;
}

/** Hook：获取当前用户信息（含 role） */
export function useCurrentUser() {
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiGet<CurrentUser>('/api/auth/me')
            .then((result) => {
                if (result.ok) {
                    setUser(result.data);
                }
            })
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    return { user, loading };
}
