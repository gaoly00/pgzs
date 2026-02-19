'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import {
    Table2,
    Save,
    Loader2,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { FieldManagerDrawer } from './FieldManagerDrawer';
import { readAllSheets, captureSelection } from '@/lib/fortune-api';
import { rcToA1 } from '@/lib/excel-coords';
import { ensureWorkbookData } from '@/lib/fortune-template';

// ============================================================
// Dynamic Imports
// ============================================================

const Workbook = dynamic(
    () => import('@fortune-sheet/react').then((mod) => mod.Workbook),
    { ssr: false }
);

// ============================================================
// Helper: Sparse Data Sanitization (Safe & Standard)
// ============================================================

const sanitizeSheetData = (sheets: any[]) => {
    if (!Array.isArray(sheets)) return [];

    return sheets.map((sheet) => {
        // STRATEGY: Prefer 'celldata' (Sparse) for storage.
        // 'data' (Flowdata) is a dense 2D matrix that often contains Runtime circular references (DOM nodes).
        // Saving 'celldata' avoids JSON.stringify crashes.

        // Luckysheet/FortuneSheet usually maintains 'celldata' in sync with 'data'.
        // If we save 'celldata', the library rebuilds 'data' on load.

        const hasCellData = Array.isArray(sheet.celldata) && sheet.celldata.length > 0;

        return {
            name: sheet.name,
            index: sheet.index,
            status: sheet.status,
            order: sheet.order,
            row: sheet.row,
            column: sheet.column,
            config: sheet.config || {},

            // If celldata exists, use it. Otherwise undefined (so data is used).
            celldata: hasCellData ? sheet.celldata : undefined,

            // If we use celldata, we can safely drop 'data' (undefined) to save massive space/risk.
            // If NO celldata, we fall back to 'data' (risky but necessary).
            data: hasCellData ? undefined : (sheet.data || []),

            calcChain: sheet.calcChain || [],
            frozen: sheet.frozen || {},
            zoomRatio: sheet.zoomRatio || 1,
            images: sheet.images || null,
        };
    });
};

// ============================================================
// Component
// ============================================================

export function ValuationSheet() {
    const params = useParams();
    const projectId = params.id as string;

    const project = useSmartValStore((state) => state.projects.find((p) => p.id === projectId));
    const updateSalesSheetData = useSmartValStore((state) => state.updateSalesSheetData);
    const extractMetricsFromData = useSmartValStore((state) => state.extractMetricsFromData);

    const workbookRef = useRef<any>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    const latestSheetDataRef = useRef<any[] | null>(null);

    const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
    const [currentSelection, setCurrentSelection] = useState<{ sheetId: string; sheetName: string; r: number; c: number } | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [serverSheet, setServerSheet] = useState<any[] | null>(null);
    const [workbookKey, setWorkbookKey] = useState(0); // NEW: Force Re-render Key

    // Debug State
    const [debugMsg, setDebugMsg] = useState<string>("");

    const safeData = useMemo(() => {
        // Priority: Server Data > Store Data > Default
        const raw = ensureWorkbookData(serverSheet ?? project?.salesSheetData);
        // FORCE ONE SHEET ONLY (User Request: Delete 2-60)
        return raw.slice(0, 1);
    }, [serverSheet, project?.salesSheetData]);

    useEffect(() => {
        setIsMounted(true);
        // Test Storage
        try {
            localStorage.setItem('TEST_WRITE', '1');
            localStorage.removeItem('TEST_WRITE');
        } catch (e) {
            setDebugMsg("Storage Error!");
            toast.error("Critical: LocalStorage is full or disabled.");
        }
    }, []);

    // Scroll Handlers
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
        if (!workbookRef.current) return null;
        let data = latestSheetDataRef.current;
        const apiData = readAllSheets(workbookRef.current);
        if (apiData) data = apiData;
        return captureSelection(workbookRef.current, data);
    }, []);

    // --- SAVE LOGIC ---
    const handleSaveAndExtract = useCallback(async () => {
        console.log("SAVE CLICKED");
        if (!project) return;

        // Force Sync: Ensure edit mode is exited so data commits to model
        try {
            if (workbookRef.current?.calculateFormula) workbookRef.current.calculateFormula();
        } catch { }

        // 1. Get Data (Global Source of Truth)
        let rawData: any[] | null = null;

        // @ts-ignore
        if (typeof window !== 'undefined' && window.luckysheet) {
            // @ts-ignore
            const sheets = window.luckysheet.getAllSheets();

            // MAP & CLEAN: Strip redundant dense data, keep sparse celldata
            // @ts-ignore
            rawData = sheets.map((sheet: any) => {
                // Prefer celldata (sparse), fallback to converting dense data
                // @ts-ignore
                const activeCellData = sheet.celldata || (window.luckysheet.transToCellData ? window.luckysheet.transToCellData(sheet.data) : []);

                return {
                    name: sheet.name,
                    index: sheet.index || 0,
                    status: sheet.status || 0,
                    order: sheet.order || 0,
                    config: sheet.config || {},
                    // Flatten: Discard dense 'data', keep 'celldata'
                    celldata: activeCellData
                };
            });
        }

        if ((!rawData || !Array.isArray(rawData) || rawData.length === 0) && workbookRef.current) {
            rawData = readAllSheets(workbookRef.current);
        }

        // Fallback to latest ref if API fails
        if ((!rawData || !Array.isArray(rawData) || rawData.length === 0) && latestSheetDataRef.current) {
            rawData = latestSheetDataRef.current;
        }

        if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
            toast.error('Failed to read data. Grid API not ready.');
            return;
        }

        // 2. Sanitize (Robust Cleaning Strategy)
        let cleanData: any[] = [];
        try {
            // Manual clean to remove "$undefined" and Nulls
            cleanData = (rawData || []).map((sheet: any) => {
                let finalCelldata: any[] = sheet.celldata;

                // If celldata is missing, invalid string, or not array, extract from dense data
                if (!finalCelldata || (typeof finalCelldata === 'string' && finalCelldata === "$undefined") || !Array.isArray(finalCelldata)) {
                    finalCelldata = [];
                    if (sheet.data && Array.isArray(sheet.data)) {
                        for (let r = 0; r < sheet.data.length; r++) {
                            const row = sheet.data[r];
                            if (!row) continue;
                            for (let c = 0; c < row.length; c++) {
                                const cell = row[c];
                                // Extract only non-null cells
                                if (cell !== null && cell !== undefined) {
                                    finalCelldata.push({ r, c, v: cell });
                                }
                            }
                        }
                    }
                }

                // Ensure celldata contains valid objects
                if (Array.isArray(finalCelldata)) {
                    finalCelldata = finalCelldata.filter(cell => cell && typeof cell === 'object');
                }

                return {
                    name: String(sheet.name || "Sheet1"),
                    // Handle weird strings from Luckysheet serialization
                    index: (sheet.index === "$undefined" || sheet.index == null) ? 0 : Number(sheet.index),
                    status: (sheet.status === "$undefined" || sheet.status == null) ? 0 : Number(sheet.status),
                    order: (sheet.order === "$undefined" || sheet.order == null) ? 0 : Number(sheet.order),
                    config: sheet.config || {},
                    celldata: finalCelldata
                };
            });

            const json = JSON.stringify(cleanData);

            // Check Size
            const sizeMB = new Blob([json]).size / (1024 * 1024);
            if (sizeMB > 4.5) {
                toast.error(`Data too large (${sizeMB.toFixed(2)}MB). Limit is ~5MB.`);
                setDebugMsg(`Data > 5MB (${sizeMB.toFixed(2)})`);
                return;
            }
        } catch (e) {
            console.error("Sanitization Failed:", e);
            toast.error("Save Failed: Data corruption.");
            return;
        }

        // 3. Update Store (Optimistic UI)
        try {
            // Priority: Use the captured data for save
            const toSave = cleanData;

            updateSalesSheetData(projectId, toSave);
            extractMetricsFromData(projectId, toSave);

            // Also update local serverSheet state to keep them in sync immediately
            setServerSheet(toSave);

            // 4. Server Persistence (Real Database/File Write)
            const saveResult = await import('@/app/actions/valuation').then(mod =>
                mod.saveValuationSheet(projectId, 'sales-comp', toSave)
            );

            if (!saveResult.success) {
                throw new Error("Server write failed: " + saveResult.error);
            }

            // Force Re-render REMOVED per user request
            // setWorkbookKey(k => k + 1);

            toast.success('Saved Successfully to Database');
            setDebugMsg("Saved (DB)");
        } catch (e) {
            console.error("Write Failed:", e);
            setDebugMsg("Write Failed");
            toast.error("Save Failed: Could not write to storage.");
        }

    }, [projectId, project, updateSalesSheetData, extractMetricsFromData]);

    // 5. Hydrate from Server on Mount
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        let active = true;

        async function fetchSheetData() {
            if (!projectId) return;
            try {
                // Dynamically import server action to avoid build issues in some setups
                const { getValuationSheet } = await import('@/app/actions/valuation');

                console.log(`[Client] Fetching sheet data for project ${projectId}...`);
                const response = await getValuationSheet(projectId, 'sales-comp');

                if (active && response.success && Array.isArray(response.data) && response.data.length > 0) {
                    console.log("[Client] Restoring data from server:", response.data);

                    updateSalesSheetData(projectId, response.data);

                    // Direct Render Update & Force Re-mount
                    setServerSheet(response.data);
                    setWorkbookKey(k => k + 1);
                } else {
                    console.log("[Client] No valid data found on server.");
                }
            } catch (error) {
                console.error("[Client] Failed to load sheet data:", error);
            }
        }

        fetchSheetData();

        return () => { active = false; };
    }, [projectId, updateSalesSheetData]);

    if (!isMounted) return <div className="p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;
    if (!project) return <div className="p-8 text-destructive">Project not found.</div>;

    if (!safeData || !safeData[0]) {
        return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /> Init...</div>;
    }

    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-white dark:bg-slate-950 border-0 rounded-none shadow-none">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-white shrink-0 z-20 min-h-[50px] min-w-0">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFieldManagerOpen(true)}>
                        <Table2 className="h-4 w-4 mr-2 text-blue-600" /> Field Manager
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

                    {project.status.isDirty && !debugMsg && (
                        <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-50 rounded border border-amber-200">
                            Unsaved
                        </span>
                    )}
                    <Button variant="default" size="sm" onClick={handleSaveAndExtract} className="h-8 bg-black text-white hover:bg-slate-800">
                        <Save className="h-3.5 w-3.5 mr-2" />
                        Save
                    </Button>
                </div>
            </div>

            {/* Sheet */}
            <div ref={gridContainerRef} className="flex-1 min-h-0 w-full min-w-0 overflow-hidden relative">
                <Workbook
                    key={workbookKey}
                    ref={workbookRef}
                    data={safeData}
                    // onChange updated ref for capture
                    onChange={(data: any) => { latestSheetDataRef.current = data; }}
                    showToolbar={true}
                    showFormulaBar={true}
                    showSheetTabs={true}
                    allowEdit={true}
                />
            </div>

            <FieldManagerDrawer
                open={fieldManagerOpen}
                onOpenChange={setFieldManagerOpen}
                projectId={projectId}
                currentSelection={currentSelection}
                onCaptureSelection={handleCaptureSelection}
                getCurrentSelection={getCurrentSelection}
                onSaveAndExtract={handleSaveAndExtract}
            />
        </div>
    );
}
