'use client';

/**
 * /admin/templates — 系统管理 / 模板管理
 * 仅 admin/manager 可上传，reviewer 只读
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiGet, apiPostForm, apiDelete } from '@/lib/api-client';
import {
    ArrowLeft,
    Upload,
    FileSpreadsheet,
    FileText,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    RefreshCw,
    Trash2,
    Shield,
    Info,
} from 'lucide-react';
import { RequireRole, useCurrentUser, type UserRole } from '@/components/auth/require-role';

// Excel 模板状态
interface ExcelTemplateStatus {
    exists: boolean;
    size: number;
    updatedAt: string | null;
}

// 权限检查：是否可以上传
function canUpload(role: UserRole | undefined): boolean {
    return role === 'admin' || role === 'manager';
}

function TemplateManagementContent() {
    const { user } = useCurrentUser();
    const userCanUpload = canUpload(user?.role);

    // ============================================================
    // Excel 模板
    // ============================================================
    const [excelStatus, setExcelStatus] = useState<ExcelTemplateStatus | null>(null);
    const [excelLoading, setExcelLoading] = useState(true);
    const [excelUploading, setExcelUploading] = useState(false);

    const fetchExcelStatus = useCallback(async () => {
        setExcelLoading(true);
        try {
            const result = await apiGet<ExcelTemplateStatus>('/api/templates/sales-comp/status');
            if (result.ok) {
                setExcelStatus(result.data);
            } else {
                toast.error('无法获取 Excel 模板状态');
            }
        } catch {
            toast.error('无法获取 Excel 模板状态');
        } finally {
            setExcelLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExcelStatus();
    }, [fetchExcelStatus]);

    const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!userCanUpload) {
            toast.error('权限不足：仅管理员可上传模板');
            return;
        }
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'xlsx' && ext !== 'xlsm') {
            toast.error('仅支持 .xlsx 或 .xlsm 格式');
            return;
        }

        setExcelUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await apiPostForm<{ ok: boolean; error?: string }>('/api/templates/sales-comp/upload', formData);
            if (result.ok && result.data.ok) {
                toast.success('Excel 模板上传成功', {
                    description: `文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
                });
                fetchExcelStatus();
            } else {
                toast.error('上传失败', { description: result.ok ? result.data.error : result.error });
            }
        } catch {
            toast.error('网络错误');
        } finally {
            setExcelUploading(false);
            e.target.value = '';
        }
    };

    // ============================================================
    // Word 模板（通过服务端 API 管理）
    // ============================================================
    interface WordTemplateMeta {
        id: string;
        name: string;
        fileName: string;
        placeholders: string[];
        fileSizeBytes: number;
        uploadedAt: string;
        updatedAt: string;
        uploadedBy: string;
    }

    const [wordTemplates, setWordTemplates] = useState<WordTemplateMeta[]>([]);
    const [wordLoading, setWordLoading] = useState(true);
    const [wordUploading, setWordUploading] = useState(false);

    const fetchWordTemplates = useCallback(async () => {
        setWordLoading(true);
        try {
            const result = await apiGet<{ templates: WordTemplateMeta[] }>('/api/templates/word');
            if (result.ok) {
                setWordTemplates(result.data.templates || []);
            }
        } catch {
            // 静默
        } finally {
            setWordLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWordTemplates();
    }, [fetchWordTemplates]);

    const handleWordUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!userCanUpload) {
            toast.error('权限不足：仅管理员可上传模板');
            return;
        }
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.docx')) {
            toast.error('请上传 .docx 格式的 Word 文件');
            return;
        }
        setWordUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await apiPostForm<{ ok: boolean; template: WordTemplateMeta; error?: string }>('/api/templates/word', formData);
            if (result.ok && result.data.ok) {
                toast.success(`Word 模板「${result.data.template.name}」上传成功，发现 ${result.data.template.placeholders.length} 个占位符`);
                fetchWordTemplates();
            } else {
                toast.error(result.ok ? (result.data.error || '上传失败') : result.error);
            }
        } catch (err) {
            console.error('Word 模板上传失败:', err);
            toast.error('模板上传失败，请确认文件格式正确');
        } finally {
            setWordUploading(false);
            e.target.value = '';
        }
    }, [userCanUpload, fetchWordTemplates]);

    const handleDeleteWord = useCallback(async (templateId: string) => {
        if (!userCanUpload) {
            toast.error('权限不足：仅管理员可删除模板');
            return;
        }
        try {
            const result = await apiDelete<{ ok: boolean; message?: string; error?: string }>(`/api/templates/word/${templateId}`);
            if (result.ok && result.data.ok) {
                toast.success(result.data.message || 'Word 模板已删除');
                fetchWordTemplates();
            } else {
                toast.error(result.ok ? (result.data.error || '删除失败') : result.error);
            }
        } catch {
            toast.error('网络错误');
        }
    }, [userCanUpload, fetchWordTemplates]);

    // 辅助格式化
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };
    const formatDate = (iso: string | null) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <Link href="/projects">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        系统管理 / 模板管理
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        管理 Excel 和 Word 模板 · 当前角色: <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-mono">{user?.role || '...'}</code>
                    </p>
                </div>
            </div>

            {/* 权限提示 */}
            {!userCanUpload && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">只读模式</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            您的角色为 <strong>{user?.role}</strong>，仅可查看模板信息。上传/删除操作需要 admin 或 manager 权限。
                        </p>
                    </div>
                </div>
            )}

            {/* 注意事项 */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">重要说明</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        上传新模板仅影响<strong>未来创建</strong>的项目。已有项目保留各自的工作簿/报告副本，不受影响。
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ============================================================ */}
                {/* Excel 模板卡片 */}
                {/* ============================================================ */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20">
                                <FileSpreadsheet className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold">Excel 工作簿模板</h2>
                                <p className="text-[11px] text-muted-foreground">比较法 Sales Comp 母板模板</p>
                            </div>
                        </div>

                        {/* Excel 状态 */}
                        <div className="mb-5">
                            {excelLoading ? (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    <span className="text-sm text-muted-foreground">检查状态...</span>
                                </div>
                            ) : excelStatus?.exists ? (
                                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">已上传</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                                        <span>大小: {formatSize(excelStatus.size)}</span>
                                        <span>更新: {formatDate(excelStatus.updatedAt)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <span className="text-sm font-semibold text-red-800 dark:text-red-200">未上传</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Excel 操作 */}
                        <div className="flex items-center gap-2">
                            <label className="flex-1">
                                <input
                                    type="file"
                                    accept=".xlsx,.xlsm"
                                    onChange={handleExcelUpload}
                                    className="hidden"
                                    disabled={excelUploading || !userCanUpload}
                                />
                                <Button
                                    asChild
                                    className="w-full h-10 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white shadow-md cursor-pointer disabled:opacity-50"
                                    disabled={excelUploading || !userCanUpload}
                                >
                                    <span>
                                        {excelUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                        {excelStatus?.exists ? '替换模板' : '上传模板'}
                                    </span>
                                </Button>
                            </label>
                            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={fetchExcelStatus} disabled={excelLoading}>
                                <RefreshCw className={`h-4 w-4 ${excelLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                        {!userCanUpload && (
                            <p className="text-[10px] text-muted-foreground mt-2 text-center">仅 admin / manager 可上传</p>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* Word 模板卡片 */}
                {/* ============================================================ */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold">Word 报告模板</h2>
                                <p className="text-[11px] text-muted-foreground">估价报告 .docx 模板（含占位符）</p>
                            </div>
                        </div>

                        {/* Word 模板列表 */}
                        <div className="mb-5">
                            {wordTemplates.length === 0 ? (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800">
                                    <div className="flex items-center gap-2">
                                        <XCircle className="h-4 w-4 text-red-600" />
                                        <span className="text-sm font-semibold text-red-800 dark:text-red-200">未上传</span>
                                    </div>
                                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                        请上传一个含 {'{{field_name}}'} 占位符的 .docx 模板。
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {wordTemplates.map((tpl) => (
                                        <div key={tpl.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 truncate">{tpl.name}</p>
                                                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                    {tpl.placeholders.length} 个占位符 · {formatDate(tpl.updatedAt)}
                                                </p>
                                                {tpl.placeholders.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {tpl.placeholders.slice(0, 6).map((p) => (
                                                            <span key={p} className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 px-1 py-0.5 rounded">
                                                                {`{{${p}}}`}
                                                            </span>
                                                        ))}
                                                        {tpl.placeholders.length > 6 && (
                                                            <span className="text-[9px] text-muted-foreground">+{tpl.placeholders.length - 6}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {userCanUpload && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
                                                    onClick={() => handleDeleteWord(tpl.id)} title="删除模板">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Word 操作 */}
                        <div className="flex items-center gap-2">
                            <label className="flex-1">
                                <input
                                    type="file"
                                    accept=".docx"
                                    onChange={handleWordUpload}
                                    className="hidden"
                                    disabled={wordUploading || !userCanUpload}
                                />
                                <Button
                                    asChild
                                    className="w-full h-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md cursor-pointer disabled:opacity-50"
                                    disabled={wordUploading || !userCanUpload}
                                >
                                    <span>
                                        {wordUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                        上传 Word 模板
                                    </span>
                                </Button>
                            </label>
                        </div>
                        {!userCanUpload && (
                            <p className="text-[10px] text-muted-foreground mt-2 text-center">仅 admin / manager 可上传</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// 包裹 RequireRole 守卫
export default function AdminTemplatesPage() {
    return (
        <RequireRole allowedRoles={['admin', 'manager', 'reviewer']}>
            <TemplateManagementContent />
        </RequireRole>
    );
}
