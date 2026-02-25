import type { ValuationMethodKey } from '@/types';

export interface WorkspaceTab {
    routeSlug: string;
    methodKey: ValuationMethodKey | null;
    label: string;
    shortLabel: string;
}

export const WORKSPACE_TABS: WorkspaceTab[] = [
    { routeSlug: 'basic-info', methodKey: null, label: 'Basic Information / 基础信息', shortLabel: '基础信息' },
    { routeSlug: 'sales-comp', methodKey: 'sales-comp', label: 'Sales Comparison / 比较法', shortLabel: '比较法' },
    { routeSlug: 'cost', methodKey: 'cost-approach', label: 'Cost Approach / 成本法', shortLabel: '成本法' },
    { routeSlug: 'income', methodKey: 'income-approach', label: 'Income Approach / 收益法', shortLabel: '收益法' },
    { routeSlug: 'hypothetical-dev', methodKey: 'hypothetical-dev', label: 'Hypothetical Development / 假设开发法', shortLabel: '假设开发法' },
    { routeSlug: 'benchmark-land-price', methodKey: 'benchmark-land-price', label: 'Benchmark Land Price / 公示地价', shortLabel: '公示地价' },
    { routeSlug: 'residual-method', methodKey: 'residual-method', label: 'Residual Method / 剩余法', shortLabel: '剩余法' },
    { routeSlug: 'land-sales-comp', methodKey: 'land-sales-comp', label: 'Market Comparison (Land) / 市场比较法', shortLabel: '市场比较法' },
    { routeSlug: 'land-income', methodKey: 'land-income', label: 'Income Approach (Land) / 收益还原法', shortLabel: '收益还原法' },
    { routeSlug: 'cost-approach-land', methodKey: 'cost-approach-land', label: 'Cost Approach (Land) / 成本逼近法', shortLabel: '成本逼近法' },
    { routeSlug: 'conclusion', methodKey: null, label: 'Conclusion / 估价结论', shortLabel: '估价结论' },
    { routeSlug: 'report', methodKey: null, label: 'Report / 报告', shortLabel: '报告' },
];
