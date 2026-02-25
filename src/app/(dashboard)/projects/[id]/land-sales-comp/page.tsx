'use client';

import { use } from 'react';
import { ValuationWorkbookPage } from '@/components/excel/ValuationWorkbookPage';

/**
 * 市场比较法（土地）页面 — 统一使用 ValuationWorkbookPage
 * data 隔离到 sheetData['land-sales-comp']
 */
export default function LandSalesCompPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    return (
        <div className="flex flex-col h-full w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex-1 min-h-0 w-full min-w-0 overflow-hidden">
                <ValuationWorkbookPage projectId={id} method="land-sales-comp" />
            </div>
        </div>
    );
}
