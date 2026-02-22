'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react';

interface TemplateStatus {
    exists: boolean;
    size: number;
    updatedAt: string | null;
}

export default function AdminTemplatesPage() {
    const [status, setStatus] = useState<TemplateStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // 查询模板状态
    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/templates/sales-comp/status');
            const data = await res.json();
            setStatus(data);
        } catch {
            toast.error('无法获取模板状态');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // 上传模板
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 前端扩展名校验
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xlsm') {
            toast.error('仅支持 .xlsx 或 .xlsm 格式');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/templates/sales-comp/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (data.ok) {
                toast.success('模板上传成功', {
                    description: `文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
                });
                // 刷新状态
                fetchStatus();
            } else {
                toast.error('上传失败', { description: data.error });
            }
        } catch {
            toast.error('网络错误', { description: '请检查网络连接' });
        } finally {
            setUploading(false);
            // 重置 input，允许重复选择同一文件
            e.target.value = '';
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
            {/* 顶部导航 */}
            <div className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/projects">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-base font-bold">模板管理</h1>
                        <p className="text-xs text-muted-foreground">管理估价方法的母板模板文件</p>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-6 mt-8 space-y-6">
                {/* 说明提示 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                            重要说明
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            上传新模板仅影响<strong>未来创建</strong>的项目。已有项目保留各自的工作簿副本，不受影响。
                        </p>
                    </div>
                </div>

                {/* 比较法模板卡片 */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />

                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
                                <FileSpreadsheet className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">比较法 (Sales Comparison)</h2>
                                <p className="text-xs text-muted-foreground">
                                    母板模板: sales_comp_template.xlsx
                                </p>
                            </div>
                        </div>

                        {/* 状态显示 */}
                        <div className="mb-6">
                            {loading ? (
                                <div className="flex items-center gap-2 p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    <span className="text-sm text-muted-foreground">检查模板状态...</span>
                                </div>
                            ) : status?.exists ? (
                                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                                            模板已上传
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                                        <div>文件大小: {formatSize(status.size)}</div>
                                        <div>更新时间: {formatDate(status.updatedAt)}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <span className="text-sm font-semibold text-red-800 dark:text-red-200">
                                            未上传模板
                                        </span>
                                    </div>
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        新建项目时无法自动创建比较法工作簿，请先上传模板文件。
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-3">
                            <label className="flex-1">
                                <Input
                                    type="file"
                                    accept=".xlsx,.xlsm"
                                    onChange={handleUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                                <Button
                                    asChild
                                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md cursor-pointer"
                                    disabled={uploading}
                                >
                                    <span>
                                        {uploading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        {status?.exists ? '替换模板文件' : '上传模板文件'}
                                    </span>
                                </Button>
                            </label>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 shrink-0"
                                onClick={fetchStatus}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>

                        <p className="text-xs text-muted-foreground mt-3 text-center">
                            支持 .xlsx 格式，最大 50MB
                        </p>
                    </div>
                </div>

                {/* 工作流说明 */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-6">
                        <h3 className="text-sm font-semibold mb-4 text-slate-700 dark:text-slate-300">
                            📋 工作流说明
                        </h3>
                        <div className="space-y-3">
                            {[
                                { step: '1', text: '管理员上传一份母板模板 (.xlsx)', done: status?.exists },
                                { step: '2', text: '创建新项目时，系统自动复制母板到项目目录' },
                                { step: '3', text: 'Sales Comp 页面加载并编辑项目的独立副本' },
                                { step: '4', text: '导出下载始终返回项目副本，保留公式和链接' },
                            ].map(({ step, text, done }) => (
                                <div key={step} className="flex items-start gap-3">
                                    <div
                                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 ${done
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                            }`}
                                    >
                                        {step}
                                    </div>
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
