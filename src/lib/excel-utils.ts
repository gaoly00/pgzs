// ============================================================
// FortuneSheet Adapter — Robust cell value extraction
// Handles both sparse (celldata) and dense (data) structures.
// NEVER throws if structures differ or are missing.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Resolve the target sheet from sheetData array.
 * If sheetId is provided, tries to match by `id` field.
 * Falls back to first sheet (index 0) if not found.
 */
export function resolveSheet(
    sheetData: any[] | null | undefined,
    sheetId?: string,
): any | null {
    if (!sheetData || !Array.isArray(sheetData) || sheetData.length === 0) {
        return null;
    }

    if (sheetId) {
        const found = sheetData.find(
            (s: any) => s?.id === sheetId || s?.index === sheetId,
        );
        if (found) return found;
    }

    // Fallback: first sheet
    return sheetData[0] ?? null;
}

/**
 * Extract the display/raw value from a FortuneSheet cell.
 *
 * Priority 1 — Sparse (celldata): array of { r, c, v } objects
 *   The cell payload is item.v (NOT the item itself).
 *
 * Priority 2 — Dense (data): 2D array, data[r][c]
 *   The cell value may be an object with .v/.m or a primitive.
 *
 * Value extraction from payload:
 *   - Prefer payload.m (display string) if present
 *   - Else payload.v (raw value)
 *   - Ignore payload.f (formula string) — never treat formula as numeric output
 *
 * Returns null if nothing found.
 */
export function getCellValue(
    sheetData: any[] | null | undefined,
    sheetId: string | undefined,
    r: number,
    c: number,
): any {
    try {
        const sheet = resolveSheet(sheetData, sheetId);
        if (!sheet) return null;

        // Priority 1: Sparse data (celldata)
        if (Array.isArray(sheet.celldata) && sheet.celldata.length > 0) {
            const cell = sheet.celldata.find(
                (item: any) => item?.r === r && item?.c === c,
            );
            if (cell) {
                const payload = cell.v;
                return extractPayloadValue(payload);
            }
        }

        // Priority 2: Dense data (data)
        if (Array.isArray(sheet.data) && sheet.data[r] && sheet.data[r][c] != null) {
            const obj = sheet.data[r][c];
            return extractPayloadValue(obj);
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Extract value from a cell payload object.
 * - Prefer .m (display string) if present and non-empty
 * - Else .v (raw value) if present
 * - If payload is a primitive (string/number), return it directly
 * - Never return .f (formula)
 */
function extractPayloadValue(payload: any): any {
    if (payload === null || payload === undefined) return null;

    // Payload is a primitive
    if (typeof payload !== 'object') return payload;

    // Prefer display value
    if (payload.m !== undefined && payload.m !== null && payload.m !== '') {
        return payload.m;
    }

    // Raw value
    if (payload.v !== undefined && payload.v !== null) {
        return payload.v;
    }

    return null;
}

/**
 * Extract a numeric value from a cell.
 * Returns null if the cell is empty, non-numeric, or contains a formula string
 * that hasn't been computed.
 */
export function getCellNumberValue(
    sheetData: any[] | null | undefined,
    sheetId: string | undefined,
    r: number,
    c: number,
): number | null {
    try {
        const raw = getCellValue(sheetData, sheetId, r, c);

        if (raw === null || raw === undefined || raw === '') return null;

        // Convert to string, trim, remove commas and spaces
        const cleaned = String(raw).trim().replace(/[,\s]/g, '');

        if (cleaned === '') return null;

        const num = Number(cleaned);
        return Number.isNaN(num) ? null : num;
    } catch {
        return null;
    }
}
