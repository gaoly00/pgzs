'use client';

import { use } from 'react';
import { ValuationWorkbookPage } from '@/components/excel/ValuationWorkbookPage';

/**
 * 公示地价系数修正法页面 — 统一使用 ValuationWorkbookPage
 * data 隔离到 sheetData['benchmark-land-price']
 */
export default function BenchmarkLandPricePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    return (
        <div className="flex flex-col h-[calc(100dvh-56px)] w-full max-w-full min-w-0 overflow-hidden">
            <div className="flex-1 min-h-0 w-full min-w-0 overflow-hidden">
                <ValuationWorkbookPage projectId={id} method="benchmark-land-price" />
            </div>
        </div>
    );
}
