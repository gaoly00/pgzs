/**
 * Parse a string input value to number | null for store.
 * Empty string → null; valid number → number; NaN → null.
 */
export function parseNumberInput(value: string): number | null {
    if (value === '' || value === '-') return null;
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
}

/**
 * Format a number | null for display in an input field.
 * null → ''; number → string.
 */
export function formatNumberForInput(value: number | null): string {
    return value === null ? '' : String(value);
}

/**
 * Format a number for display (with 2 decimal places).
 */
export function formatCurrency(value: number): string {
    return value.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
