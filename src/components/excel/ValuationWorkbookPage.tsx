'use client';

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Save, TableProperties, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { FieldManagerDrawer } from './FieldManagerDrawer';
import { toast } from 'sonner';
// 工作簿读写已迁移到 API（带鉴权 + 租户隔离），不再使用无鉴权的 Server Action
// import { saveValuationSheet, getValuationSheet } from '@/app/actions/valuation';
import { readAllSheets, captureSelection } from '@/lib/fortune-api';
import { rcToA1 } from '@/lib/excel-coords';
import { ensureWorkbookData } from '@/lib/fortune-template';
import type { ValuationMethodKey } from '@/types';

const Workbook = dynamic(
    () => import('@fortune-sheet/react').then((mod) => mod.Workbook),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        ),
    }
);

const DEFAULT_WORKBOOK_DATA = [
    {
        name: 'Sheet1',
        celldata: [],
        order: 0,
        row: 20,
        column: 20,
        config: {},
        status: 1,
    },
];

interface Props {
    projectId: string;
    method: ValuationMethodKey;
}

declare global {
    interface Window {
        luckysheet?: any;
    }
}

// ============================================================
// Error Boundary — 捕获 FortuneSheet 内部的非致命 DOM 错误
// 如 IndexSizeError: setStart/setEnd offset 越界
// ============================================================
class WorkbookErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        // 不设置 hasError=true，因为这些是非致命错误，
        // FortuneSheet 仍可继续工作
        return null;
    }

    componentDidCatch(error: Error) {
        // 静默处理已知的 FortuneSheet 内部错误
        if (
            error.name === 'IndexSizeError' ||
            error.message?.includes('setStart') ||
            error.message?.includes('setEnd') ||
            error.message?.includes('offset')
        ) {
            console.warn('[FortuneSheet] 已忽略非致命 DOM Range 错误:', error.message);
            return;
        }
        // 未知错误则正常抛出
        console.error('[FortuneSheet] 未知渲染错误:', error);
    }

    render() {
        return this.props.children;
    }
}

/**
 * 通用估价工作簿页面组件
 * 此组件为 9 种估价方法提供完全物理隔离的数据存储
 * 
 * 隔离机制：
 * 1. Store 层：使用 updateSheetData(projectId, method, data) 按 method key 隔离写入
 * 2. 数据读取：从 project.sheetData[method] 精准读取，各方法互不干扰
 * 3. 服务器层：文件名格式 {projectId}_{method}.json，物理隔离
 * 4. DOM 层：container ID 包含 method 名，Workbook key 包含 method
 * 5. 缓存层：Fetch 请求按 [projectId, method] 双重隔离
 */
export function ValuationWorkbookPage({ projectId, method }: Props) {
    const project = useSmartValStore((state) => state.projects.find((p) => p.id === projectId));
    // 统一使用隔离存储 action，彻底弃用 updateSalesSheetData
    const updateSheetData = useSmartValStore((state) => state.updateSheetData);
    const extractMetricsFromData = useSmartValStore((state) => state.extractMetricsFromData);

    const workbookRef = useRef<any>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const latestSheetDataRef = useRef<any[] | null>(null);

    const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
    const [currentSelection, setCurrentSelection] = useState<{ sheetId: string; sheetName: string; r: number; c: number } | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [serverSheet, setServerSheet] = useState<any[] | null>(null);
    // workbookKey 包含 method 确保切换方法时强制重新挂载
    const [workbookKey, setWorkbookKey] = useState(0);
    const [debugMsg, setDebugMsg] = useState<string>("");

    const isLoadingProject = !project;

    const [isLoadingSheet, setIsLoadingSheet] = useState(true);

    // ============================================================
    // 数据准备 — 完全按 method 隔离读取
    // ============================================================
    const safeData = useMemo(() => {
        // 优先级：服务器数据 > Store 隔离 Map 中的数据 > 默认空表
        // 关键：从 project.sheetData[method] 精准读取，不再读 salesSheetData
        const storedData = project?.sheetData?.[method] ?? null;
        const raw = ensureWorkbookData(serverSheet ?? storedData);
        // 限制单 Sheet
        return raw.slice(0, 1);
    }, [serverSheet, project?.sheetData, method]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // ============================================================
    // 当 method 或 projectId 变化时，重置所有状态
    // ============================================================
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // 重置 fetch 状态
        hasFetchedRef.current = false;
        setServerSheet(null);
        setIsLoadingSheet(true);
        setDebugMsg("");
        setCurrentSelection(null);
        latestSheetDataRef.current = null;
    }, [projectId, method]);

    // ============================================================
    // 从服务器加载数据 — 按 [projectId, method] 双重隔离
    // ============================================================
    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        let active = true;

        async function fetchSheetData() {
            if (!projectId) return;
            try {
                console.log(`[ValuationWorkbook] 正在加载 project=${projectId}, method=${method} 的数据...`);
                // 通过鉴权 API 获取数据（带租户隔离）
                const res = await fetch(`/api/projects/${projectId}/sheets/${method}`);
                if (!res.ok) {
                    console.warn(`[ValuationWorkbook] API 返回 ${res.status}`);
                    return;
                }
                const result = await res.json();

                if (active) {
                    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                        console.log(`[ValuationWorkbook] 成功恢复 ${method} 的服务器数据`);

                        // Store 层隔离：写入 sheetData[method]
                        updateSheetData(projectId, method, result.data);

                        // 渲染更新 & 强制重新挂载
                        setServerSheet(result.data);
                        setWorkbookKey(k => k + 1);
                    } else {
                        console.log(`[ValuationWorkbook] ${method} 无服务器数据，使用默认空表`);
                    }
                }
            } catch (error) {
                console.error(`[ValuationWorkbook] 加载 ${method} 数据失败:`, error);
            } finally {
                if (active) setIsLoadingSheet(false);
            }
        }

        fetchSheetData();

        // 清理：强制销毁 Luckysheet 实例，防止内存级数据串盘
        return () => {
            active = false;
            // @ts-ignore
            if (typeof window !== 'undefined' && window.luckysheet && window.luckysheet.destroy) {
                try {
                    // @ts-ignore
                    window.luckysheet.destroy();
                    console.log(`[ValuationWorkbook] 已销毁 ${method} 的 Luckysheet 实例`);
                } catch (e) {
                    console.warn(`[ValuationWorkbook] 销毁 Luckysheet 实例时出错:`, e);
                }
            }
        };
    }, [projectId, method, updateSheetData]);


    // ============================================================
    // 滚动控制
    // ============================================================
    const handleScroll = useCallback((direction: 'left' | 'right') => {
        if (!gridContainerRef.current) return;
        const scrollbar = gridContainerRef.current.querySelector('.fortune-scrollbar-x')
            || gridContainerRef.current.querySelector('.luckysheet-scrollbar-x')
            || gridContainerRef.current.querySelector('.fortune-sheet-scrollbar-x');

        if (scrollbar) {
            const amount = 300;
            scrollbar.scrollLeft += direction === 'right' ? amount : -amount;
        }
    }, []);

    // ============================================================
    // 选择捕获
    // ============================================================
    const handleCaptureSelection = useCallback(() => {
        const sel = getCurrentSelection();
        if (sel) {
            setCurrentSelection(sel);
            toast.success(`Captured: ${sel.sheetName}!${rcToA1(sel.r, sel.c)}`);
        } else {
            toast.error('No valid cell selected.');
        }
    }, []);

    const getCurrentSelection = useCallback(() => {
        // 优先使用已捕获的选择状态
        if (currentSelection) return currentSelection;

        // 回退到读取 workbook ref
        if (!workbookRef.current) return null;
        let data = latestSheetDataRef.current;
        const apiData = readAllSheets(workbookRef.current);
        if (apiData) data = apiData;
        return captureSelection(workbookRef.current, data);
    }, [currentSelection]);

    // FortuneSheet onSelect 事件处理
    const handleSheetSelect = useCallback((selection: any) => {
        if (selection) {
            const r = selection.r ?? selection.row?.[0];
            const c = selection.c ?? selection.column?.[0];
            if (typeof r === 'number' && typeof c === 'number') {
                setCurrentSelection({ r, c, sheetId: '0', sheetName: 'Sheet1' });
            }
        }
    }, []);

    // ============================================================
    // 保存逻辑 — 全链路按 method 隔离
    // ============================================================
    const handleSaveAndExtract = useCallback(async () => {
        console.log(`[${method}] 保存按钮点击`);
        if (!project) return;

        // 强制同步公式计算
        try {
            if (workbookRef.current?.calculateFormula) workbookRef.current.calculateFormula();
        } catch { }

        // 1. 获取数据（全局数据源）
        let rawData: any[] | null = null;

        // @ts-ignore
        const globalLs = typeof window !== 'undefined' ? window.luckysheet : null;

        if (globalLs) {
            // @ts-ignore
            if (globalLs.getAllSheets) {
                // @ts-ignore
                rawData = globalLs.getAllSheets();
            } else if (globalLs.getluckysheetfile) {
                // @ts-ignore
                rawData = globalLs.getluckysheetfile();
            }
        }

        if ((!rawData || !Array.isArray(rawData) || rawData.length === 0) && workbookRef.current) {
            rawData = readAllSheets(workbookRef.current);
        }

        // 回退到最新 ref
        if ((!rawData || !Array.isArray(rawData) || rawData.length === 0) && latestSheetDataRef.current) {
            rawData = latestSheetDataRef.current;
        }

        if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
            toast.error('读取数据失败，表格 API 未就绪');
            return;
        }

        // 2. 清洗数据
        let cleanData: any[] = [];
        try {
            cleanData = (rawData || []).map((sheet: any) => {
                let finalCelldata: any[] = sheet.celldata;

                if (!finalCelldata || (typeof finalCelldata === 'string' && finalCelldata === "$undefined") || !Array.isArray(finalCelldata)) {
                    finalCelldata = [];
                    if (sheet.data && Array.isArray(sheet.data)) {
                        for (let r = 0; r < sheet.data.length; r++) {
                            const row = sheet.data[r];
                            if (!row) continue;
                            for (let c = 0; c < row.length; c++) {
                                const cell = row[c];
                                if (cell !== null && cell !== undefined) {
                                    finalCelldata.push({ r, c, v: cell });
                                }
                            }
                        }
                    }
                }

                if (Array.isArray(finalCelldata)) {
                    finalCelldata = finalCelldata.filter(cell => cell && typeof cell === 'object');
                }

                return {
                    name: String(sheet.name || "Sheet1"),
                    index: (sheet.index === "$undefined" || sheet.index == null) ? 0 : Number(sheet.index),
                    status: (sheet.status === "$undefined" || sheet.status == null) ? 0 : Number(sheet.status),
                    order: (sheet.order === "$undefined" || sheet.order == null) ? 0 : Number(sheet.order),
                    config: sheet.config || {},
                    celldata: finalCelldata
                };
            });

            const json = JSON.stringify(cleanData);
            const sizeMB = new Blob([json]).size / (1024 * 1024);
            if (sizeMB > 4.5) {
                toast.error(`数据过大 (${sizeMB.toFixed(2)}MB)，限制约 5MB`);
                setDebugMsg(`Data > 5MB (${sizeMB.toFixed(2)})`);
                return;
            }
        } catch (e) {
            console.error("数据清洗失败:", e);
            toast.error("保存失败：数据损坏");
            return;
        }

        // 3. Store & 服务器 — 全部按 method 隔离
        try {
            const toSave = cleanData;

            // Store 层隔离：写入 sheetData[method]，绝不写入 salesSheetData
            updateSheetData(projectId, method, toSave);
            extractMetricsFromData(projectId, toSave);
            setServerSheet(toSave);

            // 通过鉴权 API 保存（带租户隔离）
            const saveRes = await fetch(`/api/projects/${projectId}/sheets/${method}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: toSave }),
            });

            if (!saveRes.ok) {
                const err = await saveRes.json().catch(() => ({}));
                throw new Error(err.error || `服务器返回 ${saveRes.status}`);
            }

            toast.success(`${method} 数据已保存至数据库`);
            setDebugMsg("Saved (DB)");
        } catch (e) {
            console.error("写入失败:", e);
            setDebugMsg("Write Failed");
            toast.error("保存失败：无法写入存储");
        }

    }, [projectId, project, method, updateSheetData, extractMetricsFromData]);

    // ============================================================
    // Loading 状态
    // ============================================================
    if (isLoadingProject || isLoadingSheet) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-500">
                    {isLoadingProject ? 'Loading Project...' : `Loading ${method}...`}
                </span>
            </div>
        );
    }

    if (!isMounted) return <div className="p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;

    if (!safeData || !safeData[0]) {
        return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /> Init...</div>;
    }

    // DOM 容器 ID 按 method 隔离，确保互不干扰
    const containerId = `luckysheet-${method}`;

    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-white dark:bg-slate-950 border-0 rounded-none shadow-none">
            {/* 工具栏 */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-white shrink-0 z-20 min-h-[50px] min-w-0">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFieldManagerOpen(true)}>
                        <TableProperties className="h-4 w-4 mr-2 text-blue-600" /> Field Manager
                    </Button>
                    <div className="hidden sm:flex items-center border rounded-md shadow-sm shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleScroll('left')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-[1px] h-4 bg-slate-200" />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleScroll('right')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">

                    {debugMsg && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3" /> {debugMsg}
                        </span>
                    )}

                    <Button variant="default" size="sm" onClick={handleSaveAndExtract} className="h-8 bg-black text-white hover:bg-slate-800">
                        <Save className="h-3.5 w-3.5 mr-2" />
                        Save
                    </Button>
                </div>
            </div>

            {/* 表格容器 — container ID 按 method 隔离 */}
            <div ref={gridContainerRef} id={containerId} className="flex-1 min-h-0 w-full min-w-0 overflow-hidden relative">
                <WorkbookErrorBoundary>
                    <Workbook
                        key={`${method}-${workbookKey}`}
                        ref={workbookRef}
                        data={safeData}
                        onChange={(data: any) => { latestSheetDataRef.current = data; }}
                        // @ts-ignore - FortuneSheet onSelect 类型签名不精确
                        onSelect={handleSheetSelect}
                        showToolbar={true}
                        showFormulaBar={true}
                        showSheetTabs={true}
                        allowEdit={true}
                    />
                </WorkbookErrorBoundary>
            </div>

            <FieldManagerDrawer
                open={fieldManagerOpen}
                onOpenChange={setFieldManagerOpen}
                projectId={projectId}
                method={method}
                currentSelection={currentSelection}
                onCaptureSelection={handleCaptureSelection}
                getCurrentSelection={getCurrentSelection}
                onSaveAndExtract={handleSaveAndExtract}
            />
        </div>
    );
}
