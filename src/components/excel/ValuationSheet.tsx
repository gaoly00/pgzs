'use client';

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Table2,
    Save,
    Loader2,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { FieldManagerDrawer } from './FieldManagerDrawer';
import { detectWorkbookApi, readAllSheets, captureSelection } from '@/lib/fortune-api';
import { rcToA1 } from '@/lib/excel-coords';
import { ensureWorkbookData } from '@/lib/fortune-template';
import type { SalesAnchor } from '@/types';

// ============================================================
// Dynamic Imports (SSR False)
// ============================================================

const Workbook = dynamic(
    () => import('@fortune-sheet/react').then((mod) => mod.Workbook),
    { ssr: false }
);

// ============================================================
// Component
// ============================================================

export function ValuationSheet() {
    // 1. All Hooks must be at the top level
    const params = useParams();
    const projectId = params.id as string;

    // Store access
    const project = useSmartValStore((state) => state.projects.find((p) => p.id === projectId));
    const updateSalesSheetData = useSmartValStore((state) => state.updateSalesSheetData);
    const extractMetricsFromData = useSmartValStore((state) => state.extractMetricsFromData);

    // Refs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workbookRef = useRef<any>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const latestSheetDataRef = useRef<any[] | null>(null);

    // State
    const [fieldManagerOpen, setFieldManagerOpen] = useState(false);
    const [currentSelection, setCurrentSelection] = useState<{ sheetId: string; sheetName: string; r: number; c: number } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    // Helper: Safe data derivation (useMemo is a hook)
    const safeData = useMemo(() => {
        return ensureWorkbookData(project?.salesSheetData);
    }, [project?.salesSheetData]);

    // Effects
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handlers
    const handleScroll = useCallback((direction: 'left' | 'right') => {
        if (!gridContainerRef.current) return;
        // FortuneSheet renders a scrollbar with this class
        const scrollbar = gridContainerRef.current.querySelector('.fortune-scrollbar-x')
            || gridContainerRef.current.querySelector('.luckysheet-scrollbar-x')
            || gridContainerRef.current.querySelector('.fortune-sheet-scrollbar-x');

        if (scrollbar) {
            const amount = 300; // px
            scrollbar.scrollLeft += direction === 'right' ? amount : -amount;
        }
    }, []);

    // 1. Capture Selection (Legacy/Toast trigger)
    const handleCaptureSelection = useCallback(() => {
        const sel = getCurrentSelection();
        if (sel) {
            setCurrentSelection(sel);
            toast.dismiss();
            toast.success(`Captured: ${sel.sheetName}!${rcToA1(sel.r, sel.c)}`);
        } else {
            setCurrentSelection(null);
            toast.error('No valid cell selected.');
        }
    }, []);

    // 2. Get Current Selection (Direct Read for Drawer Binding)
    const getCurrentSelection = useCallback(() => {
        if (!workbookRef.current) return null;
        let data = latestSheetDataRef.current;
        const apiData = readAllSheets(workbookRef.current);
        if (apiData) data = apiData;
        return captureSelection(workbookRef.current, data);
    }, []);

    const handleSaveAndExtract = useCallback(() => {
        if (!projectId || !project || !workbookRef.current) return;

        // Force calculation if possible
        try { workbookRef.current.calculateFormula(); } catch { /* ignore */ }

        // 1. Get Fresh Data
        const data = readAllSheets(workbookRef.current);
        if (!data) {
            toast.error('Failed to read spreadsheet data. Try again.');
            return;
        }

        // 2. Update Blob (Storage)
        updateSalesSheetData(projectId, data);

        // 3. Extract Metrics
        extractMetricsFromData(projectId, data);

        // 4. Feedback
        const boundCount = Object.keys(project.salesAnchors || {}).length;
        toast.success('Saved & Extracted', {
            description: `Updated metrics from ${boundCount} bound fields.`
        });

    }, [projectId, project, updateSalesSheetData, extractMetricsFromData]);

    // Horizontal Scroll Wheel Support
    useEffect(() => {
        const container = gridContainerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            // Check for horizontal scroll intent (Shift+Wheel or Trackpad horizontal)
            const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;

            if (isHorizontal) {
                const scrollbar = container.querySelector('.fortune-scrollbar-x')
                    || container.querySelector('.luckysheet-scrollbar-x')
                    || container.querySelector('.fortune-sheet-scrollbar-x');

                if (scrollbar) {
                    if (e.shiftKey && e.deltaY !== 0) {
                        // Shift + Vertical Wheel -> Horizontal Scroll
                        scrollbar.scrollLeft += e.deltaY;
                        e.preventDefault();
                    } else if (e.deltaX !== 0) {
                        // Horizontal Wheel / Trackpad
                        scrollbar.scrollLeft += e.deltaX;
                        e.preventDefault();
                    }
                }
            }
        };

        // Passive: false is required to use preventDefault
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [isMounted]);


    // 2. Early Returns AFTER all hooks
    if (!isMounted) return <div className="p-8 text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading spreadsheet...</div>;
    if (!project) return <div className="p-8 text-destructive">Project not found.</div>;

    // Safety check for data integrity
    if (!safeData || !safeData[0] || typeof safeData[0].row !== 'number') {
        return <div className="p-8 text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> preparing workbook...</div>;
    }

    // 3. Render - Task B Layout (Enhanced for Sidebar Fix)
    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden bg-white dark:bg-slate-950 border-0 rounded-none shadow-none">

            {/* --- TOP TOOLBAR --- */}
            {/* 1. flex-wrap: Buttons wrap if screen is small (visible!) */}
            {/* 2. shrink-0: Don't let the sheet squash the toolbar */}
            {/* 3. min-w-0: allow shrinking */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-white shrink-0 z-20 min-h-[50px] min-w-0">
                {/* Left Group */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Button variant="outline" size="sm" className="h-8 border-dashed shadow-sm bg-slate-50 hover:bg-slate-100 shrink-0" onClick={() => setFieldManagerOpen(true)}>
                        <Table2 className="h-4 w-4 mr-2 text-blue-600" /> Field Manager
                    </Button>

                    {/* Scroll buttons */}
                    <div className="hidden sm:flex items-center border rounded-md overflow-hidden shadow-sm shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100" onClick={() => handleScroll('left')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-[1px] h-4 bg-slate-200" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-slate-100" onClick={() => handleScroll('right')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Right Group */}
                <div className="flex items-center gap-2 shrink-0 min-w-0 flex-wrap justify-end">
                    {project.status.isDirty && (
                        <span className="text-xs text-amber-600 font-medium px-2 py-0.5 bg-amber-50 rounded border border-amber-200 whitespace-nowrap">
                            Unsaved Changes
                        </span>
                    )}
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleSaveAndExtract}
                        className="h-8 bg-black hover:bg-slate-800 text-white shadow-md transition-all active:scale-95 shrink-0"
                    >
                        <Save className="h-3.5 w-3.5 mr-2" />
                        Save & Extract
                    </Button>
                </div>
            </div>

            {/* --- SHEET AREA --- */}
            {/* 3. min-w-0: THE MAGIC FIX. Forces flex container to respect parent width. */}
            {/* 4. flex-1: Takes remaining height. */}
            <div ref={gridContainerRef} className="flex-1 min-h-0 w-full min-w-0 overflow-hidden relative">
                <div className="h-full w-full min-w-0 overflow-hidden">
                    <Workbook
                        ref={workbookRef}
                        data={safeData}
                        onChange={(data: any) => { latestSheetDataRef.current = data; }}
                        style={{ height: '100%', width: '100%' }}
                        showToolbar={true}
                        showFormulaBar={true}
                        showSheetTabs={true}
                        allowEdit={true}
                    />
                </div>
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
