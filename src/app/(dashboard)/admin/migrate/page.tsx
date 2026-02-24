'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { RequireRole, useCurrentUser } from '@/components/auth/require-role';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { apiPost } from '@/lib/api-client';

function MigrateContent() {
    const { user } = useCurrentUser();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

    // 假设 localStorage 存的是 smartval.store.v2
    const handleMigrate = async () => {
        if (!confirm('确定要将当前浏览器缓存的所有数据强行合并到该租户的服务端吗？\n（这可能导致部分数据被覆盖）')) {
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const raw = localStorage.getItem('smartval.store.v2');
            if (!raw) {
                setResult({ ok: false, msg: '本地未发现可以迁移的数据记录 (smartval.store.v2)！' });
                return;
            }

            const parsed = JSON.parse(raw);
            const state = parsed.state || {}; // Zustand persist state wrappers

            // 提取所有的 projects
            const projectsByUser = state.projectsByUser || {};
            const localProjects = state.projects || []; // v2 / v3 差异

            // 考虑到不同版本的兼容性，合并所有 user 空间下的 projects
            const allProjects = [...localProjects];
            for (const uid in projectsByUser) {
                allProjects.push(...projectsByUser[uid]);
            }

            // 去重
            const uniqueProjectsMap = new Map();
            for (const p of allProjects) {
                if (!uniqueProjectsMap.has(p.id)) {
                    uniqueProjectsMap.set(p.id, p);
                }
            }
            const projectsToMigrate = Array.from(uniqueProjectsMap.values());

            const templatesToMigrate = state.reportTemplates || [];

            if (projectsToMigrate.length === 0 && templatesToMigrate.length === 0) {
                setResult({ ok: false, msg: '本地数据为空，无法迁移。' });
                return;
            }

            const result = await apiPost<{ message: string }>('/api/admin/migrate', {
                projects: projectsToMigrate,
                templates: templatesToMigrate
            });

            if (!result.ok) {
                throw new Error(result.error || '迁移失败');
            }

            setResult({ ok: true, msg: result.data.message });

            // 迁移成功后强制刷新状态库
            useSmartValStore.getState().loadProjectsFromServer();

        } catch (error: any) {
            setResult({ ok: false, msg: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="h-6 w-6 text-blue-600" />
                        数据迁移工具
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        将浏览器缓存 (localStorage) 中的存量数据导入服务端
                    </p>
                </div>
            </div>

            <Card className="border-orange-200">
                <CardHeader className="bg-orange-50/50 dark:bg-orange-950/20">
                    <CardTitle className="text-orange-800 dark:text-orange-400 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        迁移须知
                    </CardTitle>
                    <CardDescription className="text-orange-700/80 dark:text-orange-400/80">
                        系统架构现已升级为多租户服务端持久化。旧版本产生的项目和模板仍存储在当前浏览器的本地缓存中。
                        执行此操作会将这台电脑上暂存的旧数据，强制写入到您当前所在租户的基础库中。
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">

                    <div className="rounded-lg border bg-slate-50 dark:bg-slate-900 p-4">
                        <h4 className="text-sm font-semibold mb-2">执行环境确认：</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>当前用户: <span className="font-medium text-foreground">{user?.username}</span></li>
                            <li>当前角色: <span className="font-medium text-foreground">{user?.role}</span></li>
                            <li>当前租户ID: <span className="font-medium text-foreground">{user?.tenantId}</span></li>
                        </ul>
                    </div>

                    {result && (
                        <div className={`p-4 rounded-md flex items-start gap-3 ${result.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                            {result.ok ? <CheckCircle2 className="h-5 w-5 mt-0.5" /> : <AlertTriangle className="h-5 w-5 mt-0.5" />}
                            <div>
                                <h4 className="font-medium">{result.ok ? '迁移成功' : '迁移异常'}</h4>
                                <p className="text-sm opacity-90">{result.msg}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <Button
                            onClick={handleMigrate}
                            disabled={loading}
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                                    执行迁移中...
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    开始一键迁移
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function MigratePage() {
    return (
        <RequireRole allowedRoles={['admin', 'manager']}>
            <MigrateContent />
        </RequireRole>
    );
}
