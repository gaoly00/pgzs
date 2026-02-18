/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Safe wrapper for FortuneSheet workbook API.
 * Detects presence of methods before calling to avoid crashes.
 */

// Basic detection
export function detectWorkbookApi(ref: any) {
    if (!ref) return { hasApi: false };

    return {
        hasApi: true,
        canReadSheets: typeof ref.getAllSheets === 'function',
        canGetSelection: typeof ref.getSelection === 'function' || Array.isArray(ref.getSelection?.()),
        canSetCellFormat: typeof ref.setCellFormat === 'function',
        canSetRangeStyle: typeof ref.setRangeStyle === 'function',
        canUseMarkers: typeof ref.addCellMarker === 'function', // hypothetical, verify if needed later
    };
}

/**
 * Safely read all sheets data.
 * Returns null if API unavailable or fails.
 */
export function readAllSheets(ref: any): any[] | null {
    if (!ref || typeof ref.getAllSheets !== 'function') {
        console.warn('[FortuneApi] getAllSheets not available');
        return null;
    }

    try {
        const data = ref.getAllSheets();
        if (Array.isArray(data)) return data;
        return null;
    } catch (e) {
        console.error('[FortuneApi] Allowed getAllSheets failed', e);
        return null;
    }
}

/**
 * Capture currently selected cell.
 * Returns { sheetId, sheetName, r, c } or null.
 * Requires latestData to resolve sheet name.
 */
export function captureSelection(ref: any, latestData: any[] | null) {
    if (!ref) return null;

    let selection = null;

    // Try getSelection()
    if (typeof ref.getSelection === 'function') {
        try {
            const ranges = ref.getSelection();
            if (Array.isArray(ranges) && ranges.length > 0) {
                // Focus on the first range's start cell
                // range objects usually: { r, c, w, h } or { row: [r1, r2], column: [c1, c2] }
                // In FortuneSheet/Luckysheet: typically { row: [r1, r2], column: [c1, c2] }
                const range = ranges[0];
                if (range && Array.isArray(range.row) && Array.isArray(range.column)) {
                    selection = { r: range.row[0], c: range.column[0] };
                }
            }
        } catch (e) {
            console.warn('[FortuneApi] getSelection failed', e);
        }
    }

    if (!selection) return null;

    // Resolve Sheet ID
    // FortuneSheet usually operates on active sheet implicitly for getSelection unless specified?
    // We need to know which sheet is active.
    // If we assume latestData is fresh, we can find active sheet (status=1).

    if (!latestData || !Array.isArray(latestData)) {
        // Fallback: assume sheetId '0' or try to get it from ref if possible?
        // FortuneSheet doesn't easily expose "getActiveSheetId" directly on ref sometimes.
        // But usually data[0] is default if no status=1.
        return null;
    }

    const activeSheet = latestData.find((s: any) => s.status === 1) || latestData[0];
    if (!activeSheet) return null;

    const sheetId = String(activeSheet.id ?? activeSheet.index ?? '0');
    const sheetName = activeSheet.name || `Sheet${sheetId}`;

    return {
        sheetId,
        sheetName,
        r: selection.r,
        c: selection.c
    };
}
