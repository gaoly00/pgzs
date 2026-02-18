// ============================================================
// SmartVal — ID Generation Utility
// ============================================================

export function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
