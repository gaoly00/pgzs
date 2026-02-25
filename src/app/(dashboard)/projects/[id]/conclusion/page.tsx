'use client';

import { use } from 'react';
import { ValuationWorkbookPage } from '@/components/excel/ValuationWorkbookPage';

/**
 * 估价结论页面 — 统一使用 ValuationWorkbookPage
 * 与所有估价方法页面共享相同的工具栏（Field Manager + Save）、
 * FieldManagerDrawer 集成、以及数据隔离机制。
 * 数据存储在 sheetData['conclusion']，与其他方法互不干扰。
 */
export default function ConclusionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex-1 min-h-0 w-full min-w-0 overflow-hidden">
                <ValuationWorkbookPage projectId={id} method="conclusion" />
            </div>
        </div>
    );
}
