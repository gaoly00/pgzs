'use client';

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Save, TableProperties, Loader2 } from 'lucide-react';
import { FieldManagerDrawer } from './FieldManagerDrawer';
import { toast } from 'sonner';
import { saveValuationSheet } from '@/app/actions/valuation';
import type { MethodKey } from '@/types';

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
        row: 20, // Reduced from 50 per user request
        column: 20,
        config: {},
        status: 1,
    },
];

interface Props {
    projectId: string;
    method: MethodKey;
}

declare global {
    interface Window {
        luckysheet?: any;
    }
}

// Keep Sanitization - It is essential for LocalStorage reliability
const sanitizeSheetData = (sheets: any[]) => {
    if (!Array.isArray(sheets)) return [];

    return sheets.map((sheet) => {
        // Check if we have dense data populated
        const hasDenseData = Array.isArray(sheet.data) && sheet.data.length > 0;

        return {
            name: sheet.name,
            index: sheet.index,
            order: sheet.order,
            status: sheet.status,
            row: sheet.row,
            column: sheet.column,
            config: sheet.config || {},

            // CRITICAL FIX: If dense 'data' is present, we must NOT provide 'celldata' (sparse).
            // FortuneSheet/Luckysheet prioritizes 'celldata' if present (even if empty []),
            // causing the sheet to render partially blank on reload.
            celldata: hasDenseData ? undefined : (sheet.celldata || []),

            data: sheet.data || [],
            calcChain: sheet.calcChain || [],
            frozen: sheet.frozen || {},
            zoomRatio: sheet.zoomRatio || 1,
            images: sheet.images || null,
            hyperlinks: sheet.hyperlinks || null,
            filter: sheet.filter || null,
            filter_select: sheet.filter_select || null,
            luckysheet_conditionformat_save: sheet.luckysheet_conditionformat_save || [],
            luckysheet_alternateformat_save: sheet.luckysheet_alternateformat_save || [],
        };
    });
};

export function ValuationWorkbookPage({ projectId, method }: Props) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [currentSelection, setCurrentSelection] = useState<{ r: number; c: number; sheetId: string } | null>(null);

    // 1. Project Loading Guard
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === projectId));
    const valuationState = project?.valuation?.[method];
    const saveWorkbook = useSmartValStore((s) => s.saveWorkbook || s.updateValuationData);
    const extractValuationMetrics = useSmartValStore((s) => s.extractValuationMetrics);

    const isLoadingProject = !project;

    // 2. Data Preparation
    const storeData = valuationState?.workbookData;
    const isLoaded = Array.isArray(storeData) && storeData.length > 0;

    const workbookData = useMemo(() => {
        // Force single sheet per user request ("delete 2-60 sheet")
        if (isLoaded) return storeData.slice(0, 1);
        return DEFAULT_WORKBOOK_DATA;
    }, [storeData, isLoaded]);

    // key strategy: Only remount when we switch from "Default" to "Loaded" data state.
    const workbookKey = useMemo(() => {
        return `${method}-${isLoaded ? 'loaded' : 'default'}`;
    }, [method, isLoaded]);

    const workbookRef = useRef<any>(null);

    // --- Handlers ---

    const handleSheetSelect = useCallback((selection: any) => {
        if (selection) {
            const r = selection.r ?? selection.row?.[0];
            const c = selection.c ?? selection.column?.[0];
            if (typeof r === 'number' && typeof c === 'number') {
                setCurrentSelection({ r, c, sheetId: '0' });
            }
        }
    }, []);

    const getSelectionFromLuckysheet = useCallback(() => {
        if (currentSelection) return currentSelection;
        if (typeof window === 'undefined') return null;
        const ls = window.luckysheet;
        return ls?.luckysheet_select_save?.[0] ?
            { r: ls.luckysheet_select_save[0].row_focus, c: ls.luckysheet_select_save[0].column_focus, sheetId: '0' } : null;
    }, [currentSelection]);

    const handleSave = useCallback(async () => {
        try {
            // 1. DIRECT FETCH: Use the global luckysheet object as the single source of truth.
            // This bypasses any React state lag or incomplete event data.
            let rawData = null;

            const globalLs = window.luckysheet;
            if (globalLs && typeof globalLs.getluckysheetfile === 'function') {
                rawData = globalLs.getluckysheetfile();
            } else if (workbookRef.current?.getAllSheets) {
                // Fallback only if global is missing (rare)
                rawData = workbookRef.current.getAllSheets();
            }

            if (!Array.isArray(rawData) || rawData.length === 0) {
                throw new Error("Could not retrieve workbook data from global instance.");
            }

            // 2. Sanitize (Essential)
            // JSON.stringify handles this but sanitizeSheetData cleans circular refs explicitly
            const cleanData = sanitizeSheetData(rawData);

            // 3. Persist to Server (Real Database/File Write)
            const saveResult = await saveValuationSheet(projectId, method, cleanData);

            if (!saveResult.success) {
                throw new Error("Server write failed: " + saveResult.error);
            }

            // 4. Update Store (Optimistic UI)
            saveWorkbook(projectId, method, cleanData);

            // 5. Extract
            extractValuationMetrics(projectId, method, cleanData);

            toast.success('Saved & Extracted Successfully');
            console.log(`[SmartVal] Successfully saved to DB: ${cleanData.length} sheets.`);

        } catch (e: any) {
            console.error("Save Failure:", e);
            toast.error(`Save Failed: ${e.message || "Unknown error"}`);
        }
    }, [projectId, method, saveWorkbook, extractValuationMetrics]);

    if (isLoadingProject) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-500">Loading Project...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-white shrink-0 z-20 min-h-[52px]">
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setDrawerOpen(true)}>
                        <TableProperties className="w-4 h-4 mr-2" />
                        Field Manager
                    </Button>

                    <span className="text-xs text-gray-500 font-mono flex items-center gap-2">
                        <span>{currentSelection ? `R${currentSelection.r + 1}:C${currentSelection.c + 1}` : 'No Select'}</span>
                        {/* Visual Debugging Indicator */}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${isLoaded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {isLoaded ? 'DATA LOADED' : 'NEW SHEET'}
                        </span>
                    </span>
                </div>

                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:block">
                    {method.replace('_', ' ')} Approach
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={handleSave}>
                        <Save className="w-4 h-4 mr-2" />
                        Save & Extract
                    </Button>
                </div>
            </div>

            <FieldManagerDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                projectId={projectId}
                method={method}
                currentSelection={currentSelection}
                getSelection={getSelectionFromLuckysheet}
                setCurrentSelection={setCurrentSelection}
            />

            <div className="flex-1 min-h-0 w-full min-w-0 relative bg-gray-50 border-t">
                <Workbook
                    key={workbookKey}
                    ref={workbookRef}
                    data={workbookData}
                    // @ts-ignore
                    onSelect={handleSheetSelect}
                    style={{ height: '100%', width: '100%' }}
                />
            </div>
        </div>
    );
}
