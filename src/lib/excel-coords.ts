/**
 * Convert 0-based row/column index to Excel A1 notation.
 * e.g., (0, 0) -> "A1", (4, 2) -> "C5"
 */
export function rcToA1(r: number, c: number): string {
    if (r < 0 || c < 0) return 'Invalid';

    let columnLabel = '';
    let tempC = c;

    while (tempC >= 0) {
        columnLabel = String.fromCharCode((tempC % 26) + 65) + columnLabel;
        tempC = Math.floor(tempC / 26) - 1;
    }

    return `${columnLabel}${r + 1}`;
}
