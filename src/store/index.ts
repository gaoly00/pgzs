import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    Project,
    CreateProjectInput,
    SalesCompCase,
    CostItem,
    Conclusion,
    ValuationMethodKey,
    SalesAnchor,
    CustomFieldDef,
} from '@/types';
import { DEFAULT_COST_ITEM_NAMES } from '@/types';
import { generateId } from '@/lib/id';
import { getCellValue, getCellNumberValue } from '@/lib/excel-utils';
import { STANDARD_FIELDS } from '@/lib/valuation-schema';

// ============================================================
// Store Interface
// ============================================================

interface SmartValState {
    projects: Project[];

    // ---- Actions ----
    createProject: (data: CreateProjectInput) => string;
    deleteProject: (id: string) => void;
    updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'projectNumber' | 'projectType' | 'valuationDate' | 'propertyType' | 'gfa' | 'address'>>) => void;
    updateValuationMethods: (projectId: string, methods: ValuationMethodKey[]) => void;

    // Sales Comp (Legacy — kept for backward compat)
    addSalesCompCase: (projectId: string) => void;
    updateSalesCompCase: (projectId: string, caseId: string, patch: Partial<Omit<SalesCompCase, 'id'>>) => void;
    deleteSalesCompCase: (projectId: string, caseId: string) => void;

    // Sales Comp (FortuneSheet — Field Manager & Hybrid Storage)
    bindAnchor: (projectId: string, fieldKey: string, anchor: SalesAnchor) => void;
    unbindAnchor: (projectId: string, fieldKey: string) => void;
    updateSalesSheetData: (projectId: string, data: any) => void; // Updates blob only (Legacy)
    updateSheetData: (projectId: string, sheetType: string, data: any) => void; // New: Isolated updates

    // Custom Fields
    addCustomField: (projectId: string, field: CustomFieldDef) => void;
    removeCustomField: (projectId: string, fieldKey: string) => void;

    /** 
     * Extract Metrics:
     * Takes FRESH data snapshot, iterates ALL bound anchors (from STANDARD_FIELDS),
     * extracts values, and updates extractedMetrics. Set isDirty=true.
     */
    extractMetricsFromData: (projectId: string, data: any) => void;

    // Cost
    addCostItem: (projectId: string) => void;
    updateCostItem: (projectId: string, itemId: string, patch: Partial<Omit<CostItem, 'id'>>) => void;
    deleteCostItem: (projectId: string, itemId: string) => void;

    // Conclusion
    updateConclusion: (projectId: string, patch: Partial<Conclusion>) => void;

    // Report
    generateReport: (projectId: string) => void;
}

// ============================================================
// Helpers
// ============================================================

function createDefaultSalesCompCases(): SalesCompCase[] {
    return Array.from({ length: 3 }, () => ({
        id: generateId(),
        caseName: '',
        transactionDate: '',
        unitPrice: null,
        area: null,
        adjustedPrice: null,
        weight: null,
    }));
}

function createDefaultCostItems(): CostItem[] {
    return DEFAULT_COST_ITEM_NAMES.map((name) => ({
        id: generateId(),
        name,
        amount: null,
    }));
}

function setDirty(project: Project): Project {
    return {
        ...project,
        status: { ...project.status, isDirty: true },
        updatedAt: new Date().toISOString(),
    };
}

function updateProjectInList(
    projects: Project[],
    projectId: string,
    updater: (p: Project) => Project,
): Project[] {
    return projects.map((p) => (p.id === projectId ? updater(p) : p));
}

// ============================================================
// Store
// ============================================================

export const useSmartValStore = create<SmartValState>()(
    persist(
        (set, get) => ({
            projects: [],

            // ---- Create Project ----
            createProject: (data) => {
                const id = generateId();
                const now = new Date().toISOString();
                const newProject: Project = {
                    id,
                    name: data.name,
                    projectNumber: data.projectNumber,
                    projectType: data.projectType ?? 'real-estate',
                    valuationDate: data.valuationDate ?? '',
                    propertyType: data.propertyType ?? '',
                    gfa: data.gfa ?? null,
                    address: data.address ?? '',
                    valuationMethods: data.valuationMethods ?? ['sales-comp'],
                    salesCompCases: createDefaultSalesCompCases(),
                    costItems: createDefaultCostItems(),
                    conclusion: {
                        selectedMethod: 'salesComp',
                        manualUnitPrice: null,
                        manualReason: '',
                    },
                    // FortuneSheet fields
                    salesSheetData: null,
                    sheetData: {}, // New: Init isolation map
                    salesAnchors: {},
                    salesResult: { unitPrice: null, totalValue: null },
                    extractedMetrics: {},
                    customFields: [],
                    status: {
                        isDirty: false,
                        reportGeneratedAt: null,
                    },
                    createdAt: now,
                    updatedAt: now,
                };
                set((state) => ({ projects: [...state.projects, newProject] }));
                return id;
            },

            // ---- Delete Project ----
            deleteProject: (id) => {
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                }));
            },

            // ---- Update Project ----
            updateProject: (id, patch) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, id, (p) =>
                        setDirty({ ...p, ...patch }),
                    ),
                }));
            },

            // ---- Valuation Methods ----
            updateValuationMethods: (projectId, methods) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({ ...p, valuationMethods: methods }),
                    ),
                }));
            },

            // ---- Sales Comp Cases (Legacy) ----
            addSalesCompCase: (projectId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            salesCompCases: [
                                ...p.salesCompCases,
                                {
                                    id: generateId(),
                                    caseName: '',
                                    transactionDate: '',
                                    unitPrice: null,
                                    area: null,
                                    adjustedPrice: null,
                                    weight: null,
                                },
                            ],
                        }),
                    ),
                }));
            },

            updateSalesCompCase: (projectId, caseId, patch) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            salesCompCases: p.salesCompCases.map((c) =>
                                c.id === caseId ? { ...c, ...patch } : c,
                            ),
                        }),
                    ),
                }));
            },

            deleteSalesCompCase: (projectId, caseId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            salesCompCases: p.salesCompCases.filter((c) => c.id !== caseId),
                        }),
                    ),
                }));
            },

            // ============================================================
            // FortuneSheet Hybrid Storage Actions
            // ============================================================

            bindAnchor: (projectId, fieldKey, anchor) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors, [fieldKey]: anchor };
                        return setDirty({ ...p, salesAnchors: nextAnchors });
                    }),
                }));
            },

            unbindAnchor: (projectId, fieldKey) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors };
                        delete nextAnchors[fieldKey];
                        return setDirty({ ...p, salesAnchors: nextAnchors });
                    }),
                }));
            },

            updateSalesSheetData: (projectId, data) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({ ...p, salesSheetData: data }), // Keep legacy for sales-comp
                    ),
                }));
            },

            updateSheetData: (projectId, sheetType, data) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) => {
                        const newSheets = { ...(p.sheetData || {}), [sheetType]: data };
                        return setDirty({ ...p, sheetData: newSheets });
                    }),
                }));
            },

            addCustomField: (projectId, field) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            customFields: [...(p.customFields || []), field],
                        }),
                    ),
                }));
            },

            removeCustomField: (projectId, fieldKey) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors };
                        delete nextAnchors[fieldKey];

                        return setDirty({
                            ...p,
                            customFields: (p.customFields || []).filter(f => f.key !== fieldKey),
                            salesAnchors: nextAnchors,
                        });
                    }),
                }));
            },

            extractMetricsFromData: (projectId, data) => {
                // Read current project state safely
                const project = get().projects.find(p => p.id === projectId);
                if (!project) return;

                const anchors = project.salesAnchors || {};
                const extracted: Record<string, string | number | null> = {};

                // Iterate Standard Fields + Custom Fields
                const allFields = [...STANDARD_FIELDS, ...(project.customFields || [])];

                allFields.forEach(field => {
                    const anchor = anchors[field.key];
                    if (!anchor) {
                        extracted[field.key] = null;
                        return;
                    }

                    // Extract using safe utilities
                    // Note: anchor has sheetId. data is workbook blob (array of sheets).
                    // We must pass data + sheetId to getCellValue.
                    let val: string | number | null = null;

                    if (field.valueType === 'number') {
                        val = getCellNumberValue(data, anchor.sheetId, anchor.r, anchor.c);
                    } else {
                        // Text
                        val = getCellValue(data, anchor.sheetId, anchor.r, anchor.c);
                        if (val !== null) val = String(val);
                    }

                    extracted[field.key] = val;
                });

                // Also update legacy salesResult if relevant keys exist
                const legacyResult = { ...project.salesResult };
                if (extracted['subject_value_unit'] !== undefined) {
                    legacyResult.unitPrice = typeof extracted['subject_value_unit'] === 'number' ? extracted['subject_value_unit'] : null;
                }
                if (extracted['subject_value_total'] !== undefined) {
                    legacyResult.totalValue = typeof extracted['subject_value_total'] === 'number' ? extracted['subject_value_total'] : null;
                }

                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            extractedMetrics: extracted,
                            salesResult: legacyResult
                        })
                    ),
                }));
            },

            // ---- Cost Items ----
            addCostItem: (projectId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: [
                                ...p.costItems,
                                { id: generateId(), name: '', amount: null },
                            ],
                        }),
                    ),
                }));
            },

            updateCostItem: (projectId, itemId, patch) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: p.costItems.map((item) =>
                                item.id === itemId ? { ...item, ...patch } : item,
                            ),
                        }),
                    ),
                }));
            },

            deleteCostItem: (projectId, itemId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: p.costItems.filter((item) => item.id !== itemId),
                        }),
                    ),
                }));
            },

            // ---- Conclusion ----
            updateConclusion: (projectId, patch) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({
                            ...p,
                            conclusion: { ...p.conclusion, ...patch },
                        }),
                    ),
                }));
            },

            // ---- Generate Report ----
            generateReport: (projectId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) => ({
                        ...p,
                        status: {
                            isDirty: false,
                            reportGeneratedAt: new Date().toISOString(),
                        },
                        updatedAt: new Date().toISOString(),
                    })),
                }));
            },
        }),
        {
            name: 'smartval.store.v1',
            storage: createJSONStorage(() => localStorage),
            // Only persist projects data, not actions
            partialize: (state) => ({ projects: state.projects }),
            skipHydration: true,
        },
    ),
);
