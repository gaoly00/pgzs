import type { Project, SalesCompCase } from '@/types';

/** null → 0 for calculations */
function n(v: number | null | undefined): number {
    return v ?? 0;
}

// ============================================================
// Sales Comparison Calculations
// ============================================================

/** Recalculate adjustedPrice & weight for all cases */
export function recalcSalesCompCases(cases: SalesCompCase[]): SalesCompCase[] {
    const count = cases.length;
    return cases.map((c) => ({
        ...c,
        adjustedPrice: c.unitPrice !== null ? c.unitPrice * 1.0 : null,
        weight: count > 0 ? 1 / count : null,
    }));
}

/** Indicated Unit Price = Σ(adjustedPrice × weight) */
export function calcSalesCompUnitPrice(cases: SalesCompCase[]): number {
    const recalced = recalcSalesCompCases(cases);
    return recalced.reduce((sum, c) => sum + n(c.adjustedPrice) * n(c.weight), 0);
}

/** Indicated Total Value = unitPrice × GFA */
export function calcSalesCompTotalValue(cases: SalesCompCase[], gfa: number | null): number {
    return calcSalesCompUnitPrice(cases) * n(gfa);
}

// ============================================================
// Cost Approach Calculations
// ============================================================

/** Total Cost = Σ(amounts) */
export function calcCostTotal(project: Project): number {
    return (project.costItems ?? []).reduce((sum, item) => sum + n(item.amount), 0);
}

/** Cost Unit Price = Total Cost / GFA */
export function calcCostUnitPrice(project: Project): number {
    const gfa = n(project.gfa);
    if (gfa === 0) return 0;
    return calcCostTotal(project) / gfa;
}

/** Cost Indicated Total Value = Total Cost */
export function calcCostTotalValue(project: Project): number {
    return calcCostTotal(project);
}

// ============================================================
// Conclusion Calculations
// ============================================================

export function calcFinalUnitPrice(project: Project): number {
    const conclusion = project.conclusion ?? { selectedMethod: 'salesComp' as const, manualUnitPrice: null, manualReason: '' };
    switch (conclusion.selectedMethod) {
        case 'salesComp': {
            const sr = (project as any).salesResult;
            if (sr && sr.unitPrice !== null && sr.unitPrice !== undefined) {
                return sr.unitPrice;
            }
            return calcSalesCompUnitPrice(project.salesCompCases ?? []);
        }
        case 'cost':
            return calcCostUnitPrice(project);
        case 'manual':
            return n(conclusion.manualUnitPrice);
        default:
            return 0;
    }
}

export function calcFinalTotalValue(project: Project): number {
    const conclusion = project.conclusion ?? { selectedMethod: 'salesComp' as const, manualUnitPrice: null, manualReason: '' };
    switch (conclusion.selectedMethod) {
        case 'salesComp': {
            const sr = (project as any).salesResult;
            if (sr && sr.totalValue !== null && sr.totalValue !== undefined) {
                return sr.totalValue;
            }
            return calcSalesCompTotalValue(project.salesCompCases ?? [], project.gfa);
        }
        case 'cost':
            return calcCostTotalValue(project);
        case 'manual':
            return n(conclusion.manualUnitPrice) * n(project.gfa);
        default:
            return 0;
    }
}
