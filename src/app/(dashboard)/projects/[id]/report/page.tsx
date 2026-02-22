'use client';

import React, { use, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { FontSize } from '@/components/editor/extensions/FontSize';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Building2,
    Save,
    Download,
    Bold,
    Italic,
    UnderlineIcon,
    Strikethrough,
    Superscript as SupIcon,
    Subscript as SubIcon,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Undo2,
    Redo2,
    Highlighter,
    Baseline,
    Minus,
    Loader2,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    ShieldCheck,
    ExternalLink,
    Sparkles,
    TableIcon,
    Quote,
    Code,
    Copy,
    RotateCcw,
    Printer,
} from 'lucide-react';
import { generateDefaultReportTemplate } from '@/lib/report-template';

// ============================================================
// 验证引擎
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

function hasValue(val: string | number | null | undefined): boolean {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    return true;
}

function runValidation(
    projectId: string,
    extracted: Record<string, string | number | null>,
): ValidationItem[] {
    const items: ValidationItem[] = [];

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

    const hasUnitPrice = hasValue(extracted['subject_value_unit']);
    const hasTotalValue = hasValue(extracted['subject_value_total']);

    if (!hasUnitPrice && !hasTotalValue) {
        items.push({
            id: 'missing-result',
            severity: 'warning',
            title: '估价结果未提取',
            message: '单价和总价均未在提取指标中找到。',
            reason: '请确认工作表中的计算结果是否已通过 Field Manager 绑定。',
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

    const hasErrors = items.some((i) => i.severity === 'error');
    if (!hasErrors) {
        items.push({
            id: 'ready',
            severity: 'info',
            title: '已就绪，可导出报告',
            message: '所有必填字段均已填写，可以导出 PDF 报告。',
            reason: '导出将生成可下载的报告文件。',
        });
    }

    return items;
}

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
    const saveReportContent = useSmartValStore((s) => s.saveReportContent);

    const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 提取指标
    const extracted = useMemo(() => project?.extractedMetrics ?? {}, [project?.extractedMetrics]);

    // 执行验证
    const validationItems = useMemo(() => runValidation(id, extracted), [id, extracted]);
    const errors = validationItems.filter((i) => i.severity === 'error');
    const warnings = validationItems.filter((i) => i.severity === 'warning');
    const infos = validationItems.filter((i) => i.severity === 'info');
    const canExport = errors.length === 0;

    // 生成初始内容
    const initialContent = useMemo(() => {
        if (project?.reportContent) return project.reportContent;
        if (!project) return '<h1>加载中...</h1>';
        return generateDefaultReportTemplate(project);
    }, [project?.reportContent, project]);

    // ============================================================
    // Tiptap 编辑器配置
    // ============================================================
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
            Highlight.configure({ multicolor: true }),
            Placeholder.configure({
                placeholder: '在此处编辑报告内容...',
            }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            Superscript,
            Subscript,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
        ],
        content: initialContent,
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[800px] px-2',
            },
        },
        onUpdate: ({ editor: ed }) => {
            // 自动保存 - debounce 3 秒
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
                saveReportContent(id, ed.getHTML());
                setLastSaved(new Date().toLocaleTimeString('zh-CN'));
            }, 3000);
        },
    });

    // 清理定时器
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, []);

    // ============================================================
    // 手动保存
    // ============================================================
    const handleSave = useCallback(() => {
        if (!editor) return;
        setIsSaving(true);
        saveReportContent(id, editor.getHTML());
        setLastSaved(new Date().toLocaleTimeString('zh-CN'));
        setTimeout(() => {
            setIsSaving(false);
            toast.success('报告已保存');
        }, 300);
    }, [editor, id, saveReportContent]);

    // ============================================================
    // 重新生成模板（重置内容）
    // ============================================================
    const handleRegenerate = useCallback(() => {
        if (!editor || !project) return;
        const newContent = generateDefaultReportTemplate(project);
        editor.commands.setContent(newContent);
        saveReportContent(id, newContent);
        toast.success('已根据最新数据重新生成报告模板');
    }, [editor, project, id, saveReportContent]);

    // ============================================================
    // PDF 导出 — 使用浏览器原生 print()
    // 彻底绕过 html2canvas 的 oklch/lab 颜色兼容性问题
    // ============================================================
    const exportPDF = useCallback(async () => {
        if (!editor) return;

        setExportingFormat('pdf');
        try {
            const htmlContent = editor.getHTML();

            // 构建独立的打印文档，使用标准 CSS 颜色
            const printDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8" />
    <title>估价报告 — ${project?.name || ''}</title>
    <style>
        @page {
            size: A4;
            margin: 25mm 20mm;
        }
        * { box-sizing: border-box; }
        body {
            font-family: "SimSun", "Noto Serif SC", "Songti SC", serif;
            font-size: 14px;
            line-height: 1.8;
            color: #000000;
            background: #ffffff;
            margin: 0;
            padding: 0;
        }
        h1 { font-size: 22pt; font-weight: bold; margin: 16px 0; }
        h2 { font-size: 16pt; font-weight: bold; margin: 14px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
        h3 { font-size: 14pt; font-weight: bold; margin: 12px 0; }
        p { margin: 8px 0; }
        ul, ol { margin: 8px 0; padding-left: 24px; }
        li { margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        td, th {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            text-align: left;
        }
        th { background: #f3f4f6; font-weight: 600; }
        hr { border: none; border-top: 1px solid #d1d5db; margin: 16px 0; }
        blockquote {
            border-left: 3px solid #d1d5db;
            margin: 12px 0;
            padding: 4px 16px;
            color: #4b5563;
        }
        sup { font-size: 0.75em; vertical-align: super; }
        sub { font-size: 0.75em; vertical-align: sub; }
        mark { background: #fef08a; padding: 0 2px; }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

            // 打开新窗口并触发打印
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                toast.error('弹窗被浏览器拦截', { description: '请允许弹出窗口后重试' });
                return;
            }

            printWindow.document.write(printDoc);
            printWindow.document.close();

            // 等待文档渲染完成后触发打印
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.print();
                }, 300);
            };

            // 兜底：如果 onload 不触发（某些浏览器）
            setTimeout(() => {
                try { printWindow.print(); } catch { /* 忽略 */ }
            }, 1500);

            toast.success('打印对话框已打开', {
                description: '选择「另存为 PDF」即可导出',
            });
        } catch (error) {
            console.error('[PDF Export]', error);
            toast.error('PDF 导出失败', { description: String(error) });
        } finally {
            setExportingFormat(null);
        }
    }, [editor, project]);

    // ============================================================
    // 空状态
    // ============================================================
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

    // ============================================================
    // 验证项卡片渲染
    // ============================================================
    const renderValidationCard = (item: ValidationItem) => {
        const config = SEVERITY_CONFIG[item.severity];
        const Icon = config.icon;

        return (
            <div
                key={item.id}
                className={`rounded-lg border p-3 transition-all ${config.bgClass} ${config.borderClass}`}
            >
                <div className="flex items-start gap-2">
                    <div className={`mt-0.5 shrink-0 ${config.iconClass}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-semibold text-xs ${config.titleClass}`}>
                                {item.title}
                            </span>
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider ${config.badgeClass}`}>
                                {config.badgeLabel}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {item.message}
                        </p>
                        {item.actionLabel && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] gap-1 mt-1.5"
                                onClick={() => item.href ? router.push(item.href) : null}
                            >
                                <ExternalLink className="h-2.5 w-2.5" />
                                {item.actionLabel}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ============================================================
    // 工具栏辅助组件
    // ============================================================
    const TBtn = ({
        onClick, active, disabled, children, title,
    }: {
        onClick: () => void; active?: boolean; disabled?: boolean;
        children: React.ReactNode; title?: string;
    }) => (
        <button
            type="button" onClick={onClick} disabled={disabled} title={title}
            className={`
                inline-flex items-center justify-center h-7 w-7 rounded text-xs transition-all
                ${active
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            {children}
        </button>
    );

    const TDiv = () => <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />;

    // ============================================================
    // 主布局
    // ============================================================
    return (
        <div className="flex flex-col h-[calc(100dvh-56px)] w-full overflow-hidden">
            {/* ---- 顶部导航栏 ---- */}
            <div className="flex items-center gap-3 px-4 py-2 border-b bg-white dark:bg-slate-950 shrink-0 z-30">
                <Link href={`/projects/${id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-bold tracking-tight truncate">
                        Report Editor — 报告编辑器
                    </h1>
                    <p className="text-[11px] text-muted-foreground truncate">
                        {project.name}
                        {lastSaved && (
                            <span className="ml-2 text-emerald-600">• 已保存 {lastSaved}</span>
                        )}
                    </p>
                </div>

                {/* 验证状态摘要 */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {errors.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                            <AlertCircle className="h-3 w-3" />
                            {errors.length}
                        </span>
                    )}
                    {warnings.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            {warnings.length}
                        </span>
                    )}
                    {errors.length === 0 && warnings.length === 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready
                        </span>
                    )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        onClick={handleRegenerate} title="根据最新提取数据重新生成报告模板">
                        <RotateCcw className="h-3.5 w-3.5" /> 重新生成
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5"
                        onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        保存
                    </Button>
                    <Button size="sm" disabled={exportingFormat !== null} onClick={exportPDF}
                        className="h-8 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md shadow-orange-500/20 gap-1.5 text-xs">
                        {exportingFormat === 'pdf'
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 导出中...</>
                            : <><Printer className="h-3.5 w-3.5" /> Export PDF</>}
                    </Button>
                </div>
            </div>

            {/* ---- Word 风格格式化工具栏 ---- */}
            {editor && (
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-3 py-1.5 border-b bg-slate-50 dark:bg-slate-900 shrink-0 z-20 overflow-x-auto">

                    {/* 撤销/重做 */}
                    <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销 (Ctrl+Z)">
                        <Undo2 className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做 (Ctrl+Y)">
                        <Redo2 className="h-3.5 w-3.5" />
                    </TBtn>

                    <TDiv />

                    {/* 字体选择 */}
                    <select
                        className="h-7 border rounded px-1.5 text-[11px] bg-white dark:bg-slate-800 dark:border-slate-700 outline-none w-[100px] cursor-pointer"
                        onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                        value={editor.getAttributes('textStyle').fontFamily || ''}
                        title="字体"
                    >
                        <option value="">默认字体</option>
                        <option value="SimSun, STSong, serif">宋体</option>
                        <option value="SimHei, STHeiti, sans-serif">黑体</option>
                        <option value="FangSong, STFangsong, serif">仿宋</option>
                        <option value="KaiTi, STKaiti, serif">楷体</option>
                        <option value="'Microsoft YaHei', sans-serif">微软雅黑</option>
                        <option value="Arial, Helvetica, sans-serif">Arial</option>
                        <option value="'Times New Roman', serif">Times New Roman</option>
                    </select>

                    {/* 字号选择 */}
                    <select
                        className="h-7 border rounded px-1.5 text-[11px] bg-white dark:bg-slate-800 dark:border-slate-700 outline-none w-[90px] cursor-pointer"
                        onChange={(e) => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}
                        value={editor.getAttributes('textStyle').fontSize || ''}
                        title="字号"
                    >
                        <option value="">默认字号</option>
                        <option value="26pt">一号 (26pt)</option>
                        <option value="22pt">二号 (22pt)</option>
                        <option value="16pt">三号 (16pt)</option>
                        <option value="14pt">四号 (14pt)</option>
                        <option value="12pt">小四 (12pt)</option>
                        <option value="10.5pt">五号 (10.5pt)</option>
                        <option value="9pt">小五 (9pt)</option>
                        <option value="7.5pt">六号 (7.5pt)</option>
                    </select>

                    <TDiv />

                    {/* 粗体 / 斜体 / 下划线 / 删除线 */}
                    <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="粗体 (Ctrl+B)">
                        <Bold className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体 (Ctrl+I)">
                        <Italic className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="下划线 (Ctrl+U)">
                        <UnderlineIcon className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="删除线">
                        <Strikethrough className="h-3.5 w-3.5" />
                    </TBtn>

                    <TDiv />

                    {/* 上标 / 下标 — 用于 m² m³ 等 */}
                    <TBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="上标 (m²)">
                        <SupIcon className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="下标">
                        <SubIcon className="h-3.5 w-3.5" />
                    </TBtn>

                    <TDiv />

                    {/* 文字颜色 + 高亮颜色 */}
                    <div className="inline-flex items-center gap-0.5" title="文字颜色">
                        <Baseline className="h-3.5 w-3.5 text-slate-500" />
                        <input type="color" className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                            onInput={e => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
                            value={editor.getAttributes('textStyle').color || '#000000'} />
                    </div>
                    <div className="inline-flex items-center gap-0.5" title="高亮颜色">
                        <Highlighter className="h-3.5 w-3.5 text-slate-500" />
                        <input type="color" className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                            onInput={e => editor.chain().focus().toggleHighlight({ color: (e.target as HTMLInputElement).value }).run()}
                            value={editor.isActive('highlight') ? (editor.getAttributes('highlight').color || '#fef08a') : '#fef08a'} />
                    </div>

                    <TDiv />

                    {/* 对齐 — 左/中/右/两端 */}
                    <TBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="左对齐">
                        <AlignLeft className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="居中">
                        <AlignCenter className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="右对齐">
                        <AlignRight className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="两端对齐">
                        <AlignJustify className="h-3.5 w-3.5" />
                    </TBtn>

                    <TDiv />

                    {/* 列表 */}
                    <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="无序列表">
                        <List className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="有序列表">
                        <ListOrdered className="h-3.5 w-3.5" />
                    </TBtn>

                    <TDiv />

                    {/* 引用 / 代码 / 分割线 / 表格 */}
                    <TBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="引用">
                        <Quote className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="代码块">
                        <Code className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">
                        <Minus className="h-3.5 w-3.5" />
                    </TBtn>
                    <TBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格">
                        <TableIcon className="h-3.5 w-3.5" />
                    </TBtn>
                </div>
            )}

            {/* ---- 双面板工作区 ---- */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* ==== 左面板：A4 编辑器 (65%) ==== */}
                <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900/50 p-6 flex flex-col items-center">
                    {/* 仿 A4 纸张容器 */}
                    <div
                        className="editor-container bg-white dark:bg-slate-950 w-full max-w-[816px] min-h-[1056px] shadow-xl border border-slate-200 dark:border-slate-800 rounded-sm"
                        style={{
                            padding: '60px 72px',
                            fontFamily: '"SimSun", "Noto Serif SC", serif',
                            fontSize: '14px',
                            lineHeight: '1.8',
                        }}
                    >
                        <EditorContent editor={editor} />
                    </div>
                    {/* 底部留白 */}
                    <div className="h-12 shrink-0" />
                </div>

                {/* ==== 右侧面板：数据 + 验证 (320px) ==== */}
                <div className="w-80 flex flex-col bg-white dark:bg-slate-950 border-l overflow-hidden shrink-0">
                    {/* 提取数据面板 */}
                    <div className="flex-1 overflow-y-auto">
                        {/* 数据参考区 */}
                        <div className="px-4 py-3 border-b">
                            <div className="flex items-center gap-2 mb-1">
                                <Copy className="h-4 w-4 text-blue-600" />
                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Extracted Data — 提取数据
                                </h3>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                编辑报告时参考这些已提取的字段值
                            </p>
                        </div>

                        <div className="px-4 py-3 space-y-2">
                            {Object.keys(extracted).length > 0 ? (
                                Object.entries(extracted).map(([key, value]) => (
                                    <div
                                        key={key}
                                        className="group p-2 rounded-md border border-slate-100 dark:border-slate-800 hover:border-blue-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                                        onClick={() => {
                                            // 点击复制值到剪贴板
                                            if (value !== null && value !== undefined) {
                                                navigator.clipboard.writeText(String(value));
                                                toast.success(`已复制: ${value}`);
                                            }
                                        }}
                                        title="点击复制值"
                                    >
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                                            {key.replace(/_/g, ' ')}
                                        </div>
                                        <div className="text-sm font-mono font-medium text-blue-700 dark:text-blue-400 truncate">
                                            {value !== null && value !== undefined ? String(value) : (
                                                <span className="text-slate-300 italic">N/A</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                                    <p className="text-xs text-slate-400">
                                        尚无提取数据。请在估价方法页面通过
                                        <strong> Field Manager </strong>
                                        绑定并提取字段。
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* 验证面板 */}
                        <div className="px-4 py-3 border-t">
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="h-4 w-4 text-blue-600" />
                                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                    Validation — 校验
                                </h3>
                            </div>

                            <div className="space-y-2">
                                {errors.map(renderValidationCard)}
                                {warnings.map(renderValidationCard)}
                                {infos.map(renderValidationCard)}
                            </div>
                        </div>
                    </div>

                    {/* 底部提示 */}
                    <div className="px-4 py-3 border-t bg-slate-50 dark:bg-slate-900/50 shrink-0">
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                报告内容每 3 秒自动保存。点击右侧数据值可复制到剪贴板。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
