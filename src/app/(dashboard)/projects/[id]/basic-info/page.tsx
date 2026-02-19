'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { readAllSheets } from '@/lib/fortune-api';
import { ensureWorkbookData } from '@/lib/fortune-template';

const Workbook = dynamic(
    () => import('@fortune-sheet/react').then((mod) => mod.Workbook),
    { ssr: false }
);

export default function BasicInfoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params); // Unwrapping params
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));

    // Sheet State
    const workbookRef = useRef<any>(null);
    const latestSheetDataRef = useRef<any[] | null>(null);
    const [sheetData, setSheetData] = useState<any[] | null>(null);
    const [workbookKey, setWorkbookKey] = useState(0);
    const [isSheetLoading, setIsSheetLoading] = useState(true);

    // 从服务器加载基础信息 Sheet 数据
    useEffect(() => {
        let active = true;
        async function fetchSheet() {
            try {
                const { getValuationSheet } = await import('@/app/actions/valuation');
                const res = await getValuationSheet(id, 'basic-info');
                if (active && res.success && res.data) {
                    setSheetData(res.data);
                } else {
                    setSheetData(null);
                }
            } catch (e) {
                console.error("加载基础信息数据失败", e);
            } finally {
                if (active) setIsSheetLoading(false);
            }
        }
        fetchSheet();
        return () => { active = false; };
    }, [id]);

    const safeData = useMemo(() => {
        return ensureWorkbookData(sheetData).slice(0, 1);
    }, [sheetData]);

    // 保存基础信息 Sheet 数据
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project) return;

        // 2. Save Sheet Data
        // Force Sync
        try {
            if (workbookRef.current?.calculateFormula) workbookRef.current.calculateFormula();
        } catch { }

        // Get Data
        let rawData: any[] | null = null;
        // @ts-ignore
        if (typeof window !== 'undefined' && window.luckysheet) {
            // @ts-ignore
            const sheets = window.luckysheet.getAllSheets();
            // @ts-ignore
            rawData = sheets.map((sheet: any) => {
                // @ts-ignore
                const activeCellData = sheet.celldata || (window.luckysheet.transToCellData ? window.luckysheet.transToCellData(sheet.data) : []);
                return {
                    name: sheet.name,
                    index: sheet.index || 0,
                    status: sheet.status || 0,
                    order: sheet.order || 0,
                    config: sheet.config || {},
                    celldata: activeCellData
                };
            });
        }
        if ((!rawData || rawData.length === 0) && workbookRef.current) {
            rawData = readAllSheets(workbookRef.current);
        }
        if ((!rawData || rawData.length === 0) && latestSheetDataRef.current) {
            rawData = latestSheetDataRef.current;
        }

        if (!rawData || rawData.length === 0) {
            toast.error('Could not retrieve sheet data to save.');
            return;
        }

        // Sanitize (Clean Payload Logic)
        let cleanData: any[] = [];
        try {
            cleanData = rawData.map((sheet: any) => {
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
                    index: Number(sheet.index || 0),
                    status: Number(sheet.status || 0),
                    order: Number(sheet.order || 0),
                    config: sheet.config || {},
                    celldata: finalCelldata
                };
            });
        } catch (err) {
            console.error("Sanitization failed", err);
            toast.error("Save Failed: Data corruption.");
            return;
        }

        // Server Write
        try {
            const { saveValuationSheet } = await import('@/app/actions/valuation');
            const res = await saveValuationSheet(id, 'basic-info', cleanData);
            if (res.success) {
                setSheetData(cleanData); // Sync local
                toast.success('Basic Information & Sheet Saved');
            } else {
                toast.error('Server Save Failed');
            }
        } catch (err) {
            console.error(err);
            toast.error('Save Error');
        }
    };

    if (!project) return <div className="p-8">Project not found</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            <div className="flex items-center justify-between shrink-0">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Basic Information</h1>
                    <p className="text-muted-foreground">Manage project details and valuation scope.</p>
                </div>
                <Button onClick={handleSave} size="sm" className="h-8">
                    <Save className="h-3.5 w-3.5 mr-2" />
                    Save
                </Button>
            </div>

            {/* Luckysheet 表格区域 */}
            <div className="flex-1 min-h-0 relative border rounded-md overflow-hidden bg-white flex flex-col">
                <div className="flex-1 w-full min-h-0 relative">
                    {isSheetLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Workbook
                            key={workbookKey}
                            ref={workbookRef}
                            data={safeData}
                            onChange={(data: any) => { latestSheetDataRef.current = data; }}
                            showToolbar={true}
                            showFormulaBar={true}
                            showSheetTabs={true}
                            allowEdit={true}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
