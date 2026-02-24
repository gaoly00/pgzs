'use client';

/**
 * /admin/users — 用户管理
 * admin 可修改角色，manager 只读
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Users,
    Shield,
    Loader2,
    Crown,
    Briefcase,
    Search as SearchIcon,
    UserCheck,
    User as UserIcon,
} from 'lucide-react';
import { RequireRole, useCurrentUser, type UserRole } from '@/components/auth/require-role';

// 角色配置
const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
    admin: { label: '系统管理员', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/50', icon: Crown },
    manager: { label: '公司管理/领导', color: 'text-purple-700 dark:text-purple-300', bgColor: 'bg-purple-100 dark:bg-purple-900/50', icon: Briefcase },
    reviewer: { label: '审核人员', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-100 dark:bg-blue-900/50', icon: SearchIcon },
    valuer: { label: '估价师', color: 'text-slate-700 dark:text-slate-300', bgColor: 'bg-slate-100 dark:bg-slate-800', icon: UserIcon },
};

const ALL_ROLES: UserRole[] = ['admin', 'manager', 'reviewer', 'valuer'];

interface UserItem {
    id: string;
    username: string;
    role: UserRole;
    createdAt: string;
}

function UserManagementContent() {
    const { user: currentUser } = useCurrentUser();
    const isAdmin = currentUser?.role === 'admin';

    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // 加载用户列表
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users');
            if (!res.ok) throw new Error('获取失败');
            const data = await res.json();
            setUsers(data.users || []);
        } catch {
            toast.error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // 修改角色
    const handleChangeRole = async (userId: string, newRole: UserRole) => {
        if (!isAdmin) {
            toast.error('仅 admin 可修改用户角色');
            return;
        }
        if (userId === currentUser?.userId) {
            toast.error('不能修改自己的角色');
            return;
        }

        setUpdatingId(userId);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || '修改失败');
                return;
            }
            toast.success(data.message);
            // 更新本地状态
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch {
            toast.error('网络错误');
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div className="flex items-center gap-3">
                <Link href="/admin">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        用户管理
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        共 {users.length} 个用户 · {isAdmin ? '可编辑角色' : '只读模式'}
                    </p>
                </div>
            </div>

            {/* 角色说明 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ALL_ROLES.map((role) => {
                    const config = ROLE_CONFIG[role];
                    const count = users.filter(u => u.role === role).length;
                    return (
                        <div key={role} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${config.bgColor}`}>
                            <config.icon className={`h-4 w-4 ${config.color}`} />
                            <div className="min-w-0">
                                <p className={`text-xs font-semibold ${config.color}`}>{config.label}</p>
                                <p className="text-[10px] text-muted-foreground">{count} 人</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 用户列表 */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />

                    {/* 表头 */}
                    <div className="grid grid-cols-[1fr_160px_100px_100px] gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>用户名</span>
                        <span>角色</span>
                        <span>注册时间</span>
                        <span className="text-center">操作</span>
                    </div>

                    {/* 用户行 */}
                    {users.map((u) => {
                        const config = ROLE_CONFIG[u.role] || ROLE_CONFIG.valuer;
                        const isSelf = u.id === currentUser?.userId;
                        const isUpdating = updatingId === u.id;

                        return (
                            <div key={u.id} className="grid grid-cols-[1fr_160px_100px_100px] gap-3 px-5 py-3 border-b last:border-b-0 items-center hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                {/* 用户名 */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${config.bgColor} shrink-0`}>
                                        <config.icon className={`h-4 w-4 ${config.color}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate">
                                            {u.username}
                                            {isSelf && <span className="text-[10px] ml-1 text-blue-500">(我)</span>}
                                        </p>
                                    </div>
                                </div>

                                {/* 角色选择 */}
                                <div>
                                    {isAdmin && !isSelf ? (
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleChangeRole(u.id, e.target.value as UserRole)}
                                            disabled={isUpdating}
                                            className={`w-full text-xs px-2 py-1.5 rounded-lg border ${config.bgColor} ${config.color} font-semibold cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        >
                                            {ALL_ROLES.map((r) => (
                                                <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${config.bgColor} ${config.color} font-semibold`}>
                                            {config.label}
                                        </span>
                                    )}
                                </div>

                                {/* 注册时间 */}
                                <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>

                                {/* 状态 */}
                                <div className="text-center">
                                    {isUpdating ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 mx-auto" />
                                    ) : isSelf ? (
                                        <span className="text-[10px] text-muted-foreground">当前用户</span>
                                    ) : isAdmin ? (
                                        <UserCheck className="h-4 w-4 text-emerald-500 mx-auto" />
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground">只读</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function AdminUsersPage() {
    return (
        <RequireRole allowedRoles={['admin', 'manager']}>
            <UserManagementContent />
        </RequireRole>
    );
}
