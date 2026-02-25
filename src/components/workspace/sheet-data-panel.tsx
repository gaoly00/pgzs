'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSmartValStore } from '@/store';
import { apiGet } from '@/lib/api-client';
import { WORKSPACE_TABS } from '@/lib/workspace-tabs';
import { Loader2, Table2 } from 'lucide-react';
import { toast } from 'sonner';

interface SheetDataPanelProps {
    projectId: string;
}

/** Extract a 2D grid from FortuneSheet celldata */
function celldataToGrid(celldata: { r: number; c: number; v: any }[]): string[][] {
    if (!celldata || celldata.length === 0) return [];
    let maxR = 0, maxC = 0;
    for (const cell of celldata) {
        if (cell.r > maxR) maxR = cell.r;
        if (cell.c > maxC) maxC = cell.c;
    }
    // Cap to reasonable size for preview
    maxR = Math.min(maxR, 99);
    maxC = Math.min(maxC, 25);
    const grid: string[][] = Array.from({ length: maxR + 1 }, () =>
        Array.from({ length: maxC + 1 }, () => ''),
    );
    for (const cell of celldata) {
        if (cell.r > maxR || cell.c > maxC) continue;
        const v = cell.v;
        if (v === null || v === undefined) continue;
        // FortuneSheet cell value can be { v, m, ct, ... } or primitive
        if (typeof v === 'object') {
            grid[cell.r][cell.c] = v.m ?? v.v?.toString() ?? '';
        } else {
            grid[cell.r][cell.c] = String(v);
        }
    }
    return grid;
}

export function SheetDataPanel({ projectId }: SheetDataPanelProps) {
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === projectId));
    const methods = project?.valuationMethods ?? [];

    // Build selectable methods from workspace tabs (only method tabs that are enabled)
    const selectableTabs = WORKSPACE_TABS.filter(
        (tab) => tab.methodKey !== null && methods.includes(tab.methodKey),
    );

    const [selectedSlug, setSelectedSlug] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [grid, setGrid] = useState<string[][]>([]);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeSheetIdx, setActiveSheetIdx] = useState(0);
    const [allSheets, setAllSheets] = useState<any[]>([]);

    // Auto-select first method
    useEffect(() => {
        if (selectableTabs.length > 0 && !selectedSlug) {
            setSelectedSlug(selectableTabs[0].routeSlug);
        }
    }, [selectableTabs, selectedSlug]);

    const loadSheet = useCallback(async (method: string) => {
        if (!method) return;
        setLoading(true);
        setGrid([]);
        setSheetNames([]);
        setAllSheets([]);
        setActiveSheetIdx(0);
        try {
            const result = await apiGet<{ data: any }>(`/api/projects/${projectId}/sheets/${method}`);
            if (result.ok && result.data?.data) {
                const sheets = Array.isArray(result.data.data) ? result.data.data : [result.data.data];
                setAllSheets(sheets);
                setSheetNames(sheets.map((s: any, i: number) => s.name || `Sheet${i + 1}`));
                if (sheets.length > 0 && sheets[0].celldata) {
                    setGrid(celldataToGrid(sheets[0].celldata));
                }
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (selectedSlug) loadSheet(selectedSlug);
    }, [selectedSlug, loadSheet]);

    // Switch active sheet tab
    const switchSheet = (idx: number) => {
        setActiveSheetIdx(idx);
        const sheet = allSheets[idx];
        if (sheet?.celldata) {
            setGrid(celldataToGrid(sheet.celldata));
        } else {
            setGrid([]);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Method selector */}
            <div className="px-4 py-3 border-b">
                <div className="flex items-center gap-2 mb-2">
                    <Table2 className="h-4 w-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Sheet Data — 工作表数据
                    </h3>
                </div>
                <select
                    value={selectedSlug}
                    onChange={(e) => setSelectedSlug(e.target.value)}
                    className="w-full h-8 text-xs border rounded-md px-2 bg-white dark:bg-slate-900 dark:border-slate-700"
                >
                    {selectableTabs.map((tab) => (
                        <option key={tab.routeSlug} value={tab.routeSlug}>
                            {tab.shortLabel}
                        </option>
                    ))}
                </select>
            </div>

            {/* Sheet tabs */}
            {sheetNames.length > 1 && (
                <div className="flex border-b overflow-x-auto scrollbar-none">
                    {sheetNames.map((name, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => switchSheet(idx)}
                            className={`px-3 py-1.5 text-[10px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                                idx === activeSheetIdx
                                    ? 'border-blue-500 text-blue-700 dark:text-blue-300'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                ) : grid.length === 0 ? (
                    <div className="p-4 text-center">
                        <p className="text-xs text-slate-400">
                            {selectableTabs.length === 0 ? '暂无启用的估价方法' : '暂无数据'}
                        </p>
                    </div>
                ) : (
                    <table className="text-[10px] border-collapse w-full">
                        <tbody>
                            {grid.map((row, ri) => (
                                <tr key={ri} className="border-b border-slate-100 dark:border-slate-800">
                                    {row.map((cell, ci) => (
                                        <td
                                            key={ci}
                                            className="px-1.5 py-1 border-r border-slate-100 dark:border-slate-800 truncate max-w-[120px] hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                                            title={cell || undefined}
                                            onClick={() => {
                                                if (cell) {
                                                    navigator.clipboard.writeText(cell);
                                                    toast.success(`已复制: ${cell}`);
                                                }
                                            }}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}