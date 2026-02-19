'use client';

import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Save, TableProperties, Loader2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { FieldManagerDrawer } from './FieldManagerDrawer';
import { toast } from 'sonner';
import { saveValuationSheet, getValuationSheet } from '@/app/actions/valuation';
import { readAllSheets, captureSelection } from '@/lib/fortune-api';
import { rcToA1 } from '@/lib/excel-coords';
import { ensureWorkbookData } from '@/lib/fortune-template';
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
        row: 20,
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

export function ValuationWorkbookPage({ projectId, method }: Props) {
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
    const [workbookKey, setWorkbookKey] = useState(0); // Force Re-render Key
    const [debugMsg, setDebugMsg] = useState<string>("");

    const isLoadingProject = !project;

    const [isLoadingSheet, setIsLoadingSheet] = useState(true);

    // Data Preparation
    const safeData = useMemo(() => {
        // Priority: Server Data > Store Data (only if sales-comp) > Default
        let storeData = null;
        if (method === 'sales-comp') {
            storeData = project?.salesSheetData;
        }

        const raw = ensureWorkbookData(serverSheet ?? storeData);
        // FORCE ONE SHEET ONLY (User Request: Delete 2-60)
        return raw.slice(0, 1);
    }, [serverSheet, project?.salesSheetData, method]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // 5. Hydrate from Server on Mount
    const hasFetchedRef = useRef(false);

    useEffect(() => {
        // Reset fetch state when method/project changes
        hasFetchedRef.current = false;
        setServerSheet(null);
        setIsLoadingSheet(true);
    }, [projectId, method]);

    useEffect(() => {
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        let active = true;

        async function fetchSheetData() {
            if (!projectId) return;
            try {
                console.log(`[Client] Fetching sheet data for project ${projectId} (${method})...`);
                const response = await getValuationSheet(projectId, method);

                if (active) {
                    if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                        console.log("[Client] Restoring data from server:", response.data);

                        if (method === 'sales-comp') {
                            updateSalesSheetData(projectId, response.data);
                        }

                        // Direct Render Update & Force Re-mount
                        setServerSheet(response.data);
                        setWorkbookKey(k => k + 1);
                    } else {
                        console.log("[Client] No valid data found on server.");
                    }
                }
            } catch (error) {
                console.error("[Client] Failed to load sheet data:", error);
            } finally {
                if (active) setIsLoadingSheet(false);
            }
        }

        fetchSheetData();

        return () => { active = false; };
    }, [projectId, method, updateSalesSheetData]);


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
        // Capture from simple state if available (from onSelect)
        if (currentSelection) return currentSelection;

        // Fallback to reading workbook ref
        if (!workbookRef.current) return null;
        let data = latestSheetDataRef.current;
        const apiData = readAllSheets(workbookRef.current);
        if (apiData) data = apiData;
        return captureSelection(workbookRef.current, data);
    }, [currentSelection]);

    // Handle standard FortuneSheet onSelect event
    const handleSheetSelect = useCallback((selection: any) => {
        if (selection) {
            const r = selection.r ?? selection.row?.[0];
            const c = selection.c ?? selection.column?.[0];
            if (typeof r === 'number' && typeof c === 'number') {
                setCurrentSelection({ r, c, sheetId: '0', sheetName: 'Sheet1' });
            }
        }
    }, []);

    const handleSaveAndExtract = useCallback(async () => {
        console.log("SAVE CLICKED");
        if (!project) return;

        // Force Sync
        try {
            if (workbookRef.current?.calculateFormula) workbookRef.current.calculateFormula();
        } catch { }

        // 1. Get Data (Global Source of Truth)
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
            // Manual clean
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
                toast.error(`Data too large (${sizeMB.toFixed(2)}MB). Limit is ~5MB.`);
                setDebugMsg(`Data > 5MB (${sizeMB.toFixed(2)})`);
                return;
            }
        } catch (e) {
            console.error("Sanitization Failed:", e);
            toast.error("Save Failed: Data corruption.");
            return;
        }

        // 3. Update Store & Server
        try {
            const toSave = cleanData;

            if (method === 'sales-comp') {
                updateSalesSheetData(projectId, toSave);
            }
            extractMetricsFromData(projectId, toSave);
            setServerSheet(toSave);

            const saveResult = await saveValuationSheet(projectId, method, toSave);

            if (!saveResult.success) {
                throw new Error("Server write failed: " + saveResult.error);
            }

            toast.success('Saved Successfully to Database');
            setDebugMsg("Saved (DB)");
        } catch (e) {
            console.error("Write Failed:", e);
            setDebugMsg("Write Failed");
            toast.error("Save Failed: Could not write to storage.");
        }

    }, [projectId, project, method, updateSalesSheetData, extractMetricsFromData]);

    if (isLoadingProject || isLoadingSheet) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-sm text-gray-500">
                    {isLoadingProject ? 'Loading Project...' : 'Loading Data...'}
                </span>
            </div>
        );
    }

    if (!isMounted) return <div className="p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>;

    if (!safeData || !safeData[0]) {
        return <div className="p-8"><Loader2 className="h-4 w-4 animate-spin" /> Init...</div>;
    }

    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-white dark:bg-slate-950 border-0 rounded-none shadow-none">
            {/* Toolbar */}
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
                    <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider hidden sm:block mr-4">
                        {method.replace(/-|_/g, ' ')}
                    </div>

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

            <div ref={gridContainerRef} className="flex-1 min-h-0 w-full min-w-0 overflow-hidden relative">
                <Workbook
                    key={workbookKey}
                    ref={workbookRef}
                    data={safeData}
                    onChange={(data: any) => { latestSheetDataRef.current = data; }}
                    // @ts-ignore
                    onSelect={handleSheetSelect}
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
                method={method}
                currentSelection={currentSelection}
                onCaptureSelection={handleCaptureSelection}
                getCurrentSelection={getCurrentSelection}
                onSaveAndExtract={handleSaveAndExtract}
            />
        </div>
    );
}
