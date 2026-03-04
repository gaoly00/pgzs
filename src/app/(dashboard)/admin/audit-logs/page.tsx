'use client';

/**
 * /admin/audit-logs — 审计日志查询
 * 仅 admin 可访问
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api-client';
import {
    ArrowLeft,
    FileText,
    Loader2,
    LogIn,
    LogOut,
    UserPlus,
    FileEdit,
    Trash2,
    Upload,
    Key,
    Shield,
    FileDown,
    Camera,
} from 'lucide-react';
import { RequireRole } from '@/components/auth/require-role';

interface AuditLog {
    timestamp: string;
    action: string;
    userId: string;
    username: string;
    tenantId: string;
    targetId?: string;
    targetType?: string;
    details?: string;
    ip?: string;
}

// 操作类型配置
const ACTION_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
    'user.login': { label: '登录', color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-950/50', icon: LogIn },
    'user.logout': { label: '登出', color: 'text-slate-700 dark:text-slate-300', bgColor: 'bg-slate-50 dark:bg-slate-800', icon: LogOut },
    'user.register': { label: '注册', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-950/50', icon: UserPlus },
    'user.password_change': { label: '修改密码', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-50 dark:bg-amber-950/50', icon: Key },
    'user.password_reset': { label: '重置密码', color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-50 dark:bg-orange-950/50', icon: Key },
    'user.role_change': { label: '角色变更', color: 'text-purple-700 dark:text-purple-300', bgColor: 'bg-purple-50 dark:bg-purple-950/50', icon: Shield },
    'project.create': { label: '创建项目', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-50 dark:bg-green-950/50', icon: FileEdit },
    'project.update': { label: '更新项目', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-950/50', icon: FileEdit },
    'project.delete': { label: '删除项目', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-950/50', icon: Trash2 },
    'template.upload': { label: '上传模板', color: 'text-indigo-700 dark:text-indigo-300', bgColor: 'bg-indigo-50 dark:bg-indigo-950/50', icon: Upload },
    'template.delete': { label: '删除模板', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-950/50', icon: Trash2 },
    'report.export': { label: '导出报告', color: 'text-cyan-700 dark:text-cyan-300', bgColor: 'bg-cyan-50 dark:bg-cyan-950/50', icon: FileDown },
    'snapshot.create': { label: '创建快照', color: 'text-teal-700 dark:text-teal-300', bgColor: 'bg-teal-50 dark:bg-teal-950/50', icon: Camera },
};

const DEFAULT_ACTION_CONFIG = {
    label: '其他操作',
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-50 dark:bg-slate-800',
    icon: FileText,
};

function AuditLogsContent() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [limit, setLimit] = useState(100);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiGet<{ logs: AuditLog[]; total: number }>(`/api/admin/audit-logs?limit=${limit}`);
            if (!result.ok) throw new Error(result.error);
            setLogs(result.data.logs || []);
        } catch {
            toast.error('获取审计日志失败');
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const formatTimestamp = (iso: string) => {
        const date = new Date(iso);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    const getActionConfig = (action: string) => {
        return ACTION_CONFIG[action] || DEFAULT_ACTION_CONFIG;
    };

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/admin">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            审计日志
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            显示最近 {limit} 条记录 · 共 {logs.length} 条
                        </p>
                    </div>
                </div>

                {/* 限制选择 */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">显示条数:</span>
                    <select
                        value={limit}
                        onChange={(e) => setLimit(Number(e.target.value))}
                        className="h-8 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 text-xs"
                    >
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                    </select>
                    <Button onClick={fetchLogs} size="sm" variant="outline">
                        刷新
                    </Button>
                </div>
            </div>

            {/* 日志表格 */}
            <Card className="border-slate-200 dark:border-slate-800">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                        <p className="text-sm text-muted-foreground">暂无审计日志</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">时间</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">操作</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">用户</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">租户ID</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">目标</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">详情</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {logs.map((log, idx) => {
                                    const config = getActionConfig(log.action);
                                    const Icon = config.icon;
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {formatTimestamp(log.timestamp)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.bgColor}`}>
                                                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                                                    <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">{log.username}</span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">{log.userId.slice(0, 8)}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{log.tenantId.slice(0, 8)}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.targetType && log.targetId ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-slate-700 dark:text-slate-300">{log.targetType}</span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-mono">{log.targetId.slice(0, 8)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                {log.details ? (
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{log.details}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.ip ? (
                                                    <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{log.ip}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}

export default function AuditLogsPage() {
    return (
        <RequireRole allowedRoles={['admin']}>
            <AuditLogsContent />
        </RequireRole>
    );
}
