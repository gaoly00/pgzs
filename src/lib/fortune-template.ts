import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_ROW_COUNT = 60;
export const DEFAULT_COL_COUNT = 26; // A-Z

export function ensureWorkbookData(input?: any): any[] {
    // 1. If input is completely missing or not an array, return default template
    if (!input || !Array.isArray(input) || input.length === 0) {
        return createDefaultWorkbook();
    }

    // 2. Sanitize each sheet
    return input.map((sheet, index) => {
        // Ensure strictly required fields for FortuneSheet/Luckysheet
        return {
            ...sheet,
            id: sheet.id || uuidv4(),
            name: sheet.name || `Sheet${index + 1}`,
            // Vital: row/column must be numbers. If missing, default them.
            // "row or column cannot be null or undefined" crash fix.
            row: (typeof sheet.row === 'number' && sheet.row > 0) ? sheet.row : DEFAULT_ROW_COUNT,
            column: (typeof sheet.column === 'number' && sheet.column > 0) ? sheet.column : DEFAULT_COL_COUNT,
            celldata: Array.isArray(sheet.celldata) ? sheet.celldata : [],
            config: sheet.config || {},
            // Preserve status if present (active sheet), else default first one to 1
            status: sheet.status !== undefined ? sheet.status : (index === 0 ? 1 : 0)
        };
    });
}

function createDefaultWorkbook() {
    return [{
        id: uuidv4(),
        name: "Sales Comparison",
        row: DEFAULT_ROW_COUNT,
        column: DEFAULT_COL_COUNT,
        celldata: [],
        config: {},
        status: 1, // Active
        order: 0
    }];
}
