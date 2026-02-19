// ============================================================
// SmartVal — Auto-Scanner Engine
// Scans FortuneSheet workbook data to SUGGEST anchor bindings
// for Standard Valuation Fields AND Custom Candidates.
//
// IMPORTANT:
//  - Read-only: NEVER mutates store or workbook data.
//  - Uses adapter (excel-utils) for ALL data reading.
//  - Iterates celldata (sparse) for candidate coordinates.
//  - Stops after maxTextCells label candidates.
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getCellValue, getCellNumberValue, resolveSheet } from '@/lib/excel-utils';
import { STANDARD_FIELDS, type StandardFieldDef } from '@/lib/valuation-schema';

// ============================================================
// Interfaces
// ============================================================

export interface SuggestedAnchor {
    type: 'standard' | 'custom';
    fieldKey: string;   // standard key OR 'custom_normalized_text'
    fieldLabel: string; // standard label OR original cell text
    sheetId: string;
    labelCell: { r: number; c: number; text: string };
    valueCell: { r: number; c: number };
    value: string | number | null;
    confidence: number; // 0.0 – 1.0
    reason: string;     // explainable
}

export interface ScanOptions {
    mode: 'current' | 'all';
    currentSheetId?: string;
    maxTextCells?: number; // default 5000
    topK?: number;         // default 3
}

// ============================================================
// Text Normalization (MUST)
// ============================================================

/**
 * Normalize text for matching:
 *  1. trim + toLowerCase
 *  2. remove punctuation: [:：()（）[]【】{}<>「」『』,"'.]
 *  3. remove common units/tokens: [㎡, m2, sq.m, 元/㎡, 元, 万元, 万, RMB, CNY]
 *  4. collapse whitespace to single space
 */
export function normalizeText(input: string): string {
    let s = input.trim().toLowerCase();

    // Remove punctuation
    s = s.replace(/[:：()（）[\]【】{}<>「」『』,"'.。，、；;！!？?\-—_\/\\|·@#$%^&*+=~`]/g, '');

    // Remove common units/tokens (order matters: longer tokens first)
    const tokens = ['元/㎡', '元/m2', 'sq.m', '㎡', 'm2', '万元', '万', '元', 'rmb', 'cny'];
    for (const token of tokens) {
        // Replace all occurrences
        while (s.includes(token)) {
            s = s.replace(token, ' ');
        }
    }

    // Collapse whitespace to single space
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

// ============================================================
// Neighbor Definitions (Exact order & weights)
// ============================================================

interface NeighborDef {
    dr: number;
    dc: number;
    weight: number;
    direction: string;
}

const NEIGHBORS: NeighborDef[] = [
    { dr: 0, dc: 1, weight: 1.0, direction: 'right1' },
    { dr: 0, dc: 2, weight: 0.9, direction: 'right2' },
    { dr: 1, dc: 0, weight: 0.9, direction: 'down1' },
    { dr: 2, dc: 0, weight: 0.8, direction: 'down2' },
];

// ============================================================
// Core Scanner
// ============================================================

/**
 * Scan the workbook and return suggestions WITHOUT mutating the store.
 */
export function scanForSuggestions(
    workbookData: any[] | null | undefined,
    options: ScanOptions,
): SuggestedAnchor[] {
    if (!workbookData || !Array.isArray(workbookData) || workbookData.length === 0) {
        return [];
    }

    const maxTextCells = options.maxTextCells ?? 5000;
    const topK = options.topK ?? 3;

    // Determine target sheets
    const targetSheets: any[] = [];
    if (options.mode === 'current' && options.currentSheetId) {
        const sheet = resolveSheet(workbookData, options.currentSheetId);
        if (sheet) targetSheets.push(sheet);
    } else {
        // All sheets
        for (const sheet of workbookData) {
            if (sheet) targetSheets.push(sheet);
        }
    }

    if (targetSheets.length === 0) return [];

    // Pre-compute normalized schema
    const normalizedSchema: Array<{
        field: StandardFieldDef;
        normalizedKeywords: string[];
        normalizedExcludeKeywords: string[];
    }> = STANDARD_FIELDS.map((field) => ({
        field,
        normalizedKeywords: (field.keywords ?? []).map(normalizeText),
        normalizedExcludeKeywords: (field.excludeKeywords ?? []).map(normalizeText),
    }));

    // Accumulate all suggestions
    const allSuggestions: SuggestedAnchor[] = [];
    let labelCandidateCount = 0;

    for (const sheet of targetSheets) {
        if (labelCandidateCount >= maxTextCells) break;

        const sheetId = String(sheet.id ?? sheet.index ?? '0');
        const celldata: any[] = Array.isArray(sheet.celldata) ? sheet.celldata : [];

        for (const cell of celldata) {
            if (labelCandidateCount >= maxTextCells) break;

            const r = cell?.r;
            const c = cell?.c;
            if (r === undefined || c === undefined) continue;

            // Read label text via adapter
            const label = getCellValue(workbookData, sheetId, r, c);
            if (typeof label !== 'string') continue;

            const normalizedLabel = normalizeText(label);
            if (!normalizedLabel) continue;

            // This is a valid label candidate
            labelCandidateCount++;

            // --------------------------------------------------------
            // 1. Find Valid Neighbors (Values)
            // --------------------------------------------------------
            // For universal discovery, we primarily look for Numeric values.
            interface ValidNeighbor {
                def: NeighborDef;
                value: string | number;
                isNumber: boolean;
            }

            const validNeighbors: ValidNeighbor[] = [];

            for (const neighbor of NEIGHBORS) {
                const rr = r + neighbor.dr;
                const cc = c + neighbor.dc;
                if (rr < 0 || cc < 0) continue;

                // Try reading as number first
                const valNum = getCellNumberValue(workbookData, sheetId, rr, cc);
                if (valNum !== null) {
                    validNeighbors.push({ def: neighbor, value: valNum, isNumber: true });
                    continue;
                }

                // If not number, read as text (BUT only if standard field requires it later)
                // For efficiency, we verify text value validity here
                const valText = getCellValue(workbookData, sheetId, rr, cc);
                if (typeof valText === 'string' && normalizeText(valText).length > 0) {
                    validNeighbors.push({ def: neighbor, value: valText, isNumber: false });
                }
            }

            if (validNeighbors.length === 0) continue;

            // --------------------------------------------------------
            // 2. Try Matching Standard Schema
            // --------------------------------------------------------
            let standardMatched = false;

            for (const { field, normalizedKeywords, normalizedExcludeKeywords } of normalizedSchema) {
                // Negative check
                let excluded = false;
                for (const ek of normalizedExcludeKeywords) {
                    if (ek && normalizedLabel.includes(ek)) {
                        excluded = true;
                        break;
                    }
                }
                if (excluded) continue;

                // Match: find best keyword match
                let base = 0;
                let matchType: 'exact' | 'partial' | null = null;
                let matchedKeyword = '';

                for (let ki = 0; ki < normalizedKeywords.length; ki++) {
                    const nk = normalizedKeywords[ki];
                    if (!nk) continue;

                    if (normalizedLabel === nk) {
                        base = 1.0;
                        matchType = 'exact';
                        matchedKeyword = (field.keywords ?? [])[ki];
                        break;
                    } else if (normalizedLabel.includes(nk)) {
                        if (0.8 > base) {
                            base = 0.8;
                            matchType = 'partial';
                            matchedKeyword = (field.keywords ?? [])[ki];
                        }
                    }
                }

                if (matchType === null || base === 0) continue;

                // Standard match found! Create suggestions for valid neighbors
                for (const vn of validNeighbors) {
                    // Check value type compatibility
                    if (field.valueType === 'number' && !vn.isNumber) continue;
                    // Note: If field.valueType is 'text', we accept both text and number (numbers can be text)

                    const confidence = parseFloat((base * vn.def.weight).toFixed(3));
                    const valuePreview = typeof vn.value === 'number'
                        ? vn.value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                        : String(vn.value).substring(0, 30);

                    const labelSnippet = label.length > 20 ? label.substring(0, 20) + '…' : label;
                    const reason = `Standard: ${matchType}("${matchedKeyword}") + ${vn.def.direction} → ${valuePreview}`;

                    allSuggestions.push({
                        type: 'standard',
                        fieldKey: field.key,
                        fieldLabel: field.label,
                        sheetId,
                        labelCell: { r, c, text: labelSnippet },
                        valueCell: { r: r + vn.def.dr, c: c + vn.def.dc },
                        value: vn.value,
                        confidence,
                        reason,
                    });
                    standardMatched = true;
                }
            }

            // --------------------------------------------------------
            // 3. If NO Standard Match, Try Custom Discovery
            // --------------------------------------------------------
            if (!standardMatched) {
                // Constraints for custom fields:
                // 1. Label length reasonable (< 30)
                // 2. Must not be purely numeric (e.g. year "2023" -> 2024 is unlikely a label)
                // 3. We only auto-suggest CUSTOM fields for NUMERIC values (reduce noise)

                const isNumericLabel = /^\d+$/.test(normalizedLabel.replace(/[\.\,\-\/]/g, ''));
                if (label.length <= 30 && !isNumericLabel) {
                    for (const vn of validNeighbors) {
                        if (!vn.isNumber) continue; // Only numeric values for custom discovery

                        const confidence = parseFloat((0.6 * vn.def.weight).toFixed(3)); // Lower base confidence
                        const valuePreview = typeof vn.value === 'number'
                            ? vn.value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
                            : String(vn.value);

                        // Key is derived from normalized text to enable grouping/dedup in deduplicateAndTopK
                        // E.g. "Average Value" -> "average_value"
                        const customKey = normalizedLabel.replace(/\s+/g, '_');

                        allSuggestions.push({
                            type: 'custom',
                            fieldKey: customKey,
                            fieldLabel: label, // Show original text
                            sheetId,
                            labelCell: { r, c, text: label },
                            valueCell: { r: r + vn.def.dr, c: c + vn.def.dc },
                            value: vn.value,
                            confidence,
                            reason: `Custom: Found label near number (${vn.def.direction}) → ${valuePreview}`,
                        });
                    }
                }
            }
        }
    }

    return deduplicateAndTopK(allSuggestions, topK);
}

// ============================================================
// Deduplication & TopK
// ============================================================

function deduplicateAndTopK(
    suggestions: SuggestedAnchor[],
    topK: number,
): SuggestedAnchor[] {
    // Group by fieldKey
    const grouped = new Map<string, SuggestedAnchor[]>();
    for (const s of suggestions) {
        const arr = grouped.get(s.fieldKey) ?? [];
        arr.push(s);
        grouped.set(s.fieldKey, arr);
    }

    const result: SuggestedAnchor[] = [];

    for (const [, items] of grouped) {
        // Deduplicate: same (sheetId, valueCell.r, valueCell.c) → keep highest confidence
        const dedupMap = new Map<string, SuggestedAnchor>();
        for (const item of items) {
            const key = `${item.sheetId}|${item.valueCell.r}|${item.valueCell.c}`;
            const existing = dedupMap.get(key);
            if (!existing || item.confidence > existing.confidence) {
                dedupMap.set(key, item);
            }
        }

        // Sort by confidence descending
        const deduped = Array.from(dedupMap.values());
        deduped.sort((a, b) => b.confidence - a.confidence);

        // Take topK
        result.push(...deduped.slice(0, topK));
    }

    return result;
}
