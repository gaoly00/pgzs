'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { ValuationWorkbookPage } from '@/components/excel/ValuationWorkbookPage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    Download,
    AlertTriangle,
    FileSpreadsheet,
    Loader2,
    Upload,
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api-client';

/**
 * 比较法页面 — 统一使用 ValuationWorkbookPage，data 隔离到 sheetData['sales-comp']
 * 新增：工作簿状态检测 + 下载按钮 + 模板缺失提示
 */
export default function SalesCompPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    const [workbookStatus, setWorkbookStatus] = useState<{
        exists: boolean;
        loading: boolean;
    }>({ exists: true, loading: true });

    // 检查项目工作簿状态
    const checkWorkbookStatus = useCallback(async () => {
        try {
            const result = await apiGet<{ exists: boolean }>(`/api/projects/${id}/sales-comp/status`);
            if (result.ok) {
                setWorkbookStatus({ exists: result.data.exists, loading: false });
            } else {
                setWorkbookStatus({ exists: false, loading: false });
            }
        } catch {
            setWorkbookStatus({ exists: false, loading: false });
        }
    }, [id]);

    useEffect(() => {
        checkWorkbookStatus();
    }, [checkWorkbookStatus]);

    // 下载工作簿
    const handleDownload = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/sales-comp/download`);
            if (!res.ok) {
                const data = await res.json();
                toast.error('下载失败', { description: data.error });
                return;
            }

            // 将响应转为 Blob 并触发浏览器下载
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-comp-${id}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('工作簿下载成功');
        } catch {
            toast.error('下载失败', { description: '网络错误' });
        }
    };

    // 尝试从模板复制工作簿
    const handleCopyTemplate = async () => {
        try {
            const result = await apiPost<{ ok: boolean; templateMissing?: boolean; error?: string }>(`/api/projects/${id}/sales-comp/copy-template`);
            if (result.ok && result.data.ok) {
                toast.success('工作簿创建成功', { description: '已从母板模板复制' });
                setWorkbookStatus({ exists: true, loading: false });
            } else if (result.ok && result.data.templateMissing) {
                toast.error('母板模板未上传', {
                    description: '请管理员先到模板管理页面上传比较法模板',
                });
            } else {
                toast.error('创建失败', { description: result.ok ? result.data.error : result.error });
            }
        } catch {
            toast.error('请求失败', { description: '网络错误' });
        }
    };

    // 工作簿不存在时的空状态
    if (!workbookStatus.loading && !workbookStatus.exists) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100dvh-56px)] w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
                <div className="max-w-md text-center space-y-6 p-8">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 mx-auto">
                        <AlertTriangle className="h-10 w-10 text-amber-500" />
                    </div>

                    <div>
                        <h2 className="text-xl font-bold mb-2">比较法工作簿未创建</h2>
                        <p className="text-sm text-muted-foreground">
                            该项目尚未创建比较法工作簿副本。这通常是因为项目创建时母板模板尚未上传。
                        </p>
                    </div>

                    <div className="space-y-3">
                        <Button
                            onClick={handleCopyTemplate}
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                        >
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            从模板创建工作簿
                        </Button>

                        <Link href="/admin/templates" className="block">
                            <Button variant="outline" className="w-full">
                                <Upload className="h-4 w-4 mr-2" />
                                前往模板管理页面
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // 加载中
    if (workbookStatus.loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100dvh-56px)]">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-muted-foreground">检查工作簿状态...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-56px)] w-full max-w-full min-w-0 overflow-hidden">
            {/* 下载工具栏 */}
            <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-b bg-slate-50 dark:bg-slate-900 shrink-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="h-7 text-xs gap-1.5"
                >
                    <Download className="h-3.5 w-3.5" />
                    Download Excel (Sales Comp)
                </Button>
            </div>

            {/* FortuneSheet 工作区 */}
            <div className="flex-1 min-h-0 w-full min-w-0 overflow-hidden">
                <ValuationWorkbookPage projectId={id} method="sales-comp" />
            </div>
        </div>
    );
}
