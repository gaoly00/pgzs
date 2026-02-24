'use client';

/**
 * /admin — 系统管理主页
 * 仅 admin/manager/reviewer 可见
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, FileSpreadsheet, Users, ArrowRight, Database } from 'lucide-react';
import { RequireRole, useCurrentUser } from '@/components/auth/require-role';

function AdminHubContent() {
    const { user } = useCurrentUser();

    const adminCards = [
        {
            href: '/admin/templates',
            title: '模板管理',
            description: '管理 Excel 工作簿模板和 Word 报告模板',
            icon: FileSpreadsheet,
            gradient: 'from-purple-500 to-pink-500',
            hoverBorder: 'hover:border-purple-500',
            iconBg: 'bg-purple-50 dark:bg-purple-950',
            iconColor: 'text-purple-600',
            hoverText: 'group-hover:text-purple-600',
        },
        {
            href: '/admin/users',
            title: '用户管理',
            description: '查看所有用户、分配角色权限',
            icon: Users,
            gradient: 'from-blue-500 to-cyan-500',
            hoverBorder: 'hover:border-blue-500',
            iconBg: 'bg-blue-50 dark:bg-blue-950',
            iconColor: 'text-blue-600',
            hoverText: 'group-hover:text-blue-600',
        },
        {
            href: '/admin/migrate',
            title: '数据迁移',
            description: '一键将本地缓存项目迁移至服务端',
            icon: Database,
            gradient: 'from-orange-500 to-amber-500',
            hoverBorder: 'hover:border-orange-500',
            iconBg: 'bg-orange-50 dark:bg-orange-950',
            iconColor: 'text-orange-600',
            hoverText: 'group-hover:text-orange-600',
        },
    ];

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Shield className="h-6 w-6 text-blue-600" />
                    系统管理
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    管理系统模板、用户和权限 · 当前角色: <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">{user?.role || '...'}</code>
                </p>
            </div>

            {/* 功能卡片 */}
            <div className="grid gap-6 md:grid-cols-2">
                {adminCards.map((card) => (
                    <Link key={card.href} href={card.href}>
                        <Card className={`${card.hoverBorder} hover:shadow-lg transition-all cursor-pointer h-full group border-slate-200 dark:border-slate-800`}>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                                            <card.icon className={`h-6 w-6 ${card.iconColor}`} />
                                        </div>
                                        <div>
                                            <CardTitle className={`text-lg ${card.hoverText} transition-colors`}>{card.title}</CardTitle>
                                            <CardDescription>{card.description}</CardDescription>
                                        </div>
                                    </div>
                                    <ArrowRight className={`h-5 w-5 text-muted-foreground ${card.hoverText} group-hover:translate-x-1 transition-all`} />
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default function AdminPage() {
    return (
        <RequireRole allowedRoles={['admin', 'manager', 'reviewer']}>
            <AdminHubContent />
        </RequireRole>
    );
}
