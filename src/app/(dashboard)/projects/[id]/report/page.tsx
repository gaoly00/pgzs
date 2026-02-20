'use client';

import { use, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft,
    Building2,
    FileText,
    FileType,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Eye,
    ShieldCheck,
    Sparkles,
    Download,
    Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// 验证引擎类型定义
// ============================================================
type Severity = 'error' | 'warning' | 'info';

interface ValidationItem {
    id: string;
    severity: Severity;
    title: string;
    message: string;
    reason: string;
    actionLabel?: string;
    href?: string;
}

// ============================================================
// 辅助：判断提取字段是否有效
// ============================================================
function hasValue(val: string | number | null | undefined): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    return true;
}

// ============================================================
// 验证引擎：根据提取数据生成验证项目列表
// ============================================================
function runValidation(
    projectId: string,
    extracted: Record<string, string | number | null>,
): ValidationItem[] {
    const items: ValidationItem[] = [];

    // ---- Rule A: 阻断性问题 — 缺少法定必填基础信息 ----
    const missingBasics: string[] = [];
    if (!hasValue(extracted['valuation_date'])) missingBasics.push('估价时点 (Valuation Date)');
    if (!hasValue(extracted['property_address'])) missingBasics.push('坐落 (Property Address)');

    if (missingBasics.length > 0) {
        items.push({
            id: 'missing-basics',
            severity: 'error',
            title: '缺少必填基础信息',
            message: missingBasics.join('、') + ' 未填写',
            reason: '报告合规性要求：估价时点和坐落为报告必填项。',
            actionLabel: '前往填写',
            href: `/projects/${projectId}/basic-info`,
        });
    }

    // ---- Rule B: 警告 — 估价结果未提取 ----
    const hasUnitPrice = hasValue(extracted['subject_value_unit']);
    const hasTotalValue = hasValue(extracted['subject_value_total']);

    if (!hasUnitPrice && !hasTotalValue) {
        items.push({
            id: 'missing-result',
            severity: 'warning',
            title: '估价结果未提取',
            message: '单价和总价均未在提取指标中找到。',
            reason: '可能已开始录入但尚未完成最终结果输出，请确认工作表中的计算结果是否已通过 Field Manager 绑定。',
            actionLabel: '前往检查',
            href: `/projects/${projectId}/sales-comp`,
        });
    } else if (!hasUnitPrice || !hasTotalValue) {
        items.push({
            id: 'partial-result',
            severity: 'warning',
            title: '估价结果不完整',
            message: `${!hasUnitPrice ? '单价' : '总价'} 未提取`,
            reason: '建议同时绑定单价和总价字段以确保报告数据完整性。',
            actionLabel: '前往补充',
            href: `/projects/${projectId}/sales-comp`,
        });
    }

    // ---- Rule C: 就绪信息 ----
    const hasErrors = items.some((i) => i.severity === 'error');
    if (!hasErrors) {
        items.push({
            id: 'ready',
            severity: 'info',
            title: '已就绪，可导出报告',
            message: '所有必填字段均已填写，可以导出 PDF 报告。',
            reason: '导出将创建锁定快照并生成可下载的报告文件。',
        });
    }

    return items;
}

// ============================================================
// 严重程度样式映射
// ============================================================
const SEVERITY_CONFIG: Record<
    Severity,
    {
        icon: typeof AlertCircle;
        bgClass: string;
        borderClass: string;
        iconClass: string;
        titleClass: string;
        badgeClass: string;
        badgeLabel: string;
    }
> = {
    error: {
        icon: AlertCircle,
        bgClass: 'bg-red-50 dark:bg-red-950/30',
        borderClass: 'border-red-200 dark:border-red-900',
        iconClass: 'text-red-500',
        titleClass: 'text-red-800 dark:text-red-300',
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
        badgeLabel: 'BLOCKER',
    },
    warning: {
        icon: AlertTriangle,
        bgClass: 'bg-amber-50 dark:bg-amber-950/30',
        borderClass: 'border-amber-200 dark:border-amber-900',
        iconClass: 'text-amber-500',
        titleClass: 'text-amber-800 dark:text-amber-300',
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
        badgeLabel: 'WARNING',
    },
    info: {
        icon: CheckCircle2,
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderClass: 'border-emerald-200 dark:border-emerald-900',
        iconClass: 'text-emerald-500',
        titleClass: 'text-emerald-800 dark:text-emerald-300',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
        badgeLabel: 'READY',
    },
};

// ============================================================
// 页面组件
// ============================================================
export default function ReportPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));

    // 导出状态：null = 空闲，'pdf' | 'docx' = 正在导出的格式
    const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);

    // 提取指标
    const extracted = useMemo(() => project?.extractedMetrics ?? {}, [project?.extractedMetrics]);

    // 执行验证
    const validationItems = useMemo(() => runValidation(id, extracted), [id, extracted]);

    // 分类
    const errors = validationItems.filter((i) => i.severity === 'error');
    const warnings = validationItems.filter((i) => i.severity === 'warning');
    const infos = validationItems.filter((i) => i.severity === 'info');

    // 是否允许导出（无阻断性问题）
    const canExport = errors.length === 0;

    // ---- 通用导出逻辑 ----
    const handleExport = useCallback(async (format: 'pdf' | 'docx') => {
        if (!project || !canExport) return;

        setExportingFormat(format);
        const formatLabel = format === 'docx' ? 'Word' : 'PDF';

        try {
            // Step 1: 创建快照
            const snapshotRes = await fetch(`/api/projects/${id}/report/snapshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    extractedMetrics: extracted,
                    projectName: project.name,
                }),
            });

            if (!snapshotRes.ok) {
                const errData = await snapshotRes.json().catch(() => ({}));
                throw new Error(errData.error || `快照创建失败 (${snapshotRes.status})`);
            }

            const { snapshotId } = await snapshotRes.json();

            // Step 2: 导出报告
            const exportRes = await fetch(`/api/reports/${snapshotId}/export?format=${format}`, {
                method: 'POST',
            });

            if (!exportRes.ok) {
                const errData = await exportRes.json().catch(() => ({}));
                throw new Error(errData.error || `导出失败 (${exportRes.status})`);
            }

            // Step 3: 触发浏览器下载
            const blob = await exportRes.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const disposition = exportRes.headers.get('content-disposition');
            const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
            a.download = filenameMatch?.[1] || `report-${id}.${format === 'docx' ? 'docx' : 'html'}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`${formatLabel} 导出成功`, {
                description: '快照已锁定，报告文件已开始下载。',
            });
        } catch (error: any) {
            console.error(`[Export ${formatLabel}]`, error);
            toast.error('导出失败', {
                description: error.message || '请稍后重试',
            });
        } finally {
            setExportingFormat(null);
        }
    }, [project, canExport, id, extracted]);

    // ---- 空状态 ----
    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 mb-6">
                    <Building2 className="h-10 w-10 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
                <p className="text-muted-foreground mb-6">该项目不存在或已被删除</p>
                <Link href="/projects">
                    <Button>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        返回项目列表
                    </Button>
                </Link>
            </div>
        );
    }

    // ---- 验证项卡片渲染 ----
    const renderValidationCard = (item: ValidationItem) => {
        const config = SEVERITY_CONFIG[item.severity];
        const Icon = config.icon;

        return (
            <div
                key={item.id}
                className={`rounded-lg border p-4 transition-all ${config.bgClass} ${config.borderClass}`}
            >
                {/* 头部：图标 + 标题 + Badge */}
                <div className="flex items-start gap-3">
                    <div className={`mt-0.5 shrink-0 ${config.iconClass}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${config.titleClass}`}>
                                {item.title}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${config.badgeClass}`}>
                                {config.badgeLabel}
                            </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                            {item.message}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                            {item.reason}
                        </p>

                        {/* 操作按钮 */}
                        {item.actionLabel && (
                            <div className="mt-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => item.href ? router.push(item.href) : null}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {item.actionLabel}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ---- 主布局 ----
    return (
        <div className="flex flex-col h-[calc(100dvh-56px)] w-full overflow-hidden">
            {/* 顶部导航栏 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-white dark:bg-slate-950 shrink-0">
                <Link href={`/projects/${id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold tracking-tight truncate">
                        Report Center
                    </h1>
                    <p className="text-xs text-muted-foreground truncate">
                        {project.name} — 报告中心
                    </p>
                </div>
                {/* 验证状态摘要 + 导出按钮 */}
                <div className="flex items-center gap-2 shrink-0">
                    {errors.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            {errors.length} 阻断
                        </span>
                    )}
                    {warnings.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            {warnings.length} 警告
                        </span>
                    )}
                    {errors.length === 0 && warnings.length === 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            就绪
                        </span>
                    )}

                    {/* 导出 PDF 按钮 */}
                    <Button
                        size="sm"
                        className={
                            canExport
                                ? 'h-8 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md shadow-orange-500/20 gap-1.5'
                                : 'h-8 gap-1.5'
                        }
                        disabled={!canExport || exportingFormat !== null}
                        onClick={() => handleExport('pdf')}
                        title={!canExport ? '请先修复阻断性问题' : '导出 PDF 报告'}
                    >
                        {exportingFormat === 'pdf' ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                导出中...
                            </>
                        ) : (
                            <>
                                <Download className="h-3.5 w-3.5" />
                                Export PDF
                            </>
                        )}
                    </Button>

                    {/* 导出 Word 按钮 */}
                    <Button
                        size="sm"
                        className={
                            canExport
                                ? 'h-8 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md shadow-blue-500/20 gap-1.5'
                                : 'h-8 gap-1.5'
                        }
                        disabled={!canExport || exportingFormat !== null}
                        onClick={() => handleExport('docx')}
                        title={!canExport ? '请先修复阻断性问题' : '导出 Word 文档'}
                    >
                        {exportingFormat === 'docx' ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                导出中...
                            </>
                        ) : (
                            <>
                                <FileType className="h-3.5 w-3.5" />
                                Export Word
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* 双面板工作区 */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* ---- 左面板：报告预览 (60%) ---- */}
                <div className="w-[60%] border-r bg-slate-100 dark:bg-slate-900/50 p-6 overflow-auto">
                    <div className="max-w-2xl mx-auto">
                        {/* 仿纸张卡片 */}
                        <div className="bg-white dark:bg-slate-950 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                            {/* 纸张头部装饰 */}
                            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-red-400 to-purple-500" />

                            <div className="p-8 space-y-8">
                                {/* 标题区域 */}
                                <div className="text-center space-y-3 pb-6 border-b border-dashed border-slate-200 dark:border-slate-800">
                                    <div className="flex justify-center">
                                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                            <FileText className="h-7 w-7 text-white" />
                                        </div>
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                                        Report Preview
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Coming Soon — 将从锁定快照渲染报告预览
                                    </p>
                                </div>

                                {/* 模拟报告结构 */}
                                <div className="space-y-6">
                                    {/* 模拟标题行 */}
                                    <div className="space-y-2">
                                        <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                        <div className="h-3 w-4/5 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                    </div>

                                    {/* 模拟表格 */}
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3">
                                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                                        </div>
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className="flex gap-4 p-3 border-t border-slate-100 dark:border-slate-800"
                                            >
                                                <div className="h-3 w-24 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                                <div className="h-3 flex-1 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                            </div>
                                        ))}
                                    </div>

                                    {/* 模拟段落 */}
                                    <div className="space-y-2">
                                        <div className="h-5 w-36 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                        <div className="h-3 w-full bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                        <div className="h-3 w-3/5 bg-slate-100 dark:bg-slate-900 rounded animate-pulse" />
                                    </div>

                                    {/* 模拟结果 */}
                                    <div className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
                                        <div className="h-4 w-28 bg-violet-200 dark:bg-violet-800 rounded animate-pulse mb-3" />
                                        <div className="flex gap-8">
                                            <div className="space-y-1">
                                                <div className="h-3 w-16 bg-violet-100 dark:bg-violet-900 rounded animate-pulse" />
                                                <div className="h-6 w-28 bg-violet-200 dark:bg-violet-800 rounded animate-pulse" />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="h-3 w-16 bg-violet-100 dark:bg-violet-900 rounded animate-pulse" />
                                                <div className="h-6 w-32 bg-violet-200 dark:bg-violet-800 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 底部说明 */}
                                <div className="flex items-center gap-2 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800">
                                    <Eye className="h-4 w-4 text-slate-400" />
                                    <p className="text-xs text-slate-400">
                                        报告预览功能开发中，此处将渲染完整的估价报告文档。目前可点击右上角「Export PDF」导出 HTML 报告。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ---- 右面板：验证与可追溯 (40%) ---- */}
                <div className="w-[40%] flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
                    {/* 右面板头部 */}
                    <div className="px-5 py-4 border-b shrink-0">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                Validation & Traceability
                            </h2>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            智能校验清单 — 确保报告数据完整、合规
                        </p>
                    </div>

                    {/* 验证项列表（可滚动） */}
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                        {/* 阻断性问题 */}
                        {errors.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                                    <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
                                        Blocking Issues ({errors.length})
                                    </span>
                                </div>
                                {errors.map(renderValidationCard)}
                            </div>
                        )}

                        {/* 警告 */}
                        {warnings.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                                        Warnings ({warnings.length})
                                    </span>
                                </div>
                                {warnings.map(renderValidationCard)}
                            </div>
                        )}

                        {/* 就绪 */}
                        {infos.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                                        Ready ({infos.length})
                                    </span>
                                </div>
                                {infos.map(renderValidationCard)}
                            </div>
                        )}
                    </div>

                    {/* 底部：可追溯占位 */}
                    <div className="px-5 py-4 border-t bg-slate-50 dark:bg-slate-900/50 shrink-0">
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                                    Traceability (Coming Soon)
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                    点击预览中的数字可查看其语义来源及最后更新时间，实现全链路可追溯。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
