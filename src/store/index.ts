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
    // 用户命名空间
    currentUserId: string | null;
    projectsByUser: Record<string, Project[]>;

    // 派生属性：当前用户的项目列表
    projects: Project[];

    // 用户管理
    setCurrentUser: (userId: string) => void;
    logoutUser: () => void;

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
    updateSalesSheetData: (projectId: string, data: any) => void;
    updateSheetData: (projectId: string, sheetType: string, data: any) => void;

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
    saveReportContent: (projectId: string, htmlContent: string) => void;
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

/** 获取当前用户的项目列表 */
function getUserProjects(state: SmartValState): Project[] {
    const uid = state.currentUserId;
    if (!uid) return [];
    return state.projectsByUser[uid] ?? [];
}

/** 生成更新当前用户项目列表的 partial state */
function setUserProjects(state: SmartValState, projects: Project[]): Partial<SmartValState> {
    const uid = state.currentUserId;
    if (!uid) return {};
    return {
        projectsByUser: { ...state.projectsByUser, [uid]: projects },
        projects, // 同步派生属性
    };
}

// ============================================================
// Store
// ============================================================

export const useSmartValStore = create<SmartValState>()(
    persist(
        (set, get) => ({
            currentUserId: null,
            projectsByUser: {},
            projects: [],

            setCurrentUser: (userId: string) => {
                set((state) => ({
                    currentUserId: userId,
                    projects: state.projectsByUser[userId] ?? [],
                }));
            },

            logoutUser: () => {
                set({ currentUserId: null, projects: [] });
            },

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
                    salesSheetData: null,
                    sheetData: {},
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
                set((state) => {
                    const cur = getUserProjects(state);
                    return setUserProjects(state, [...cur, newProject]);
                });
                return id;
            },

            // ---- Delete Project ----
            deleteProject: (id) => {
                set((state) => {
                    const cur = getUserProjects(state).filter((p) => p.id !== id);
                    return setUserProjects(state, cur);
                });
            },

            // ---- Update Project ----
            updateProject: (id, patch) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), id, (p) =>
                        setDirty({ ...p, ...patch }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Valuation Methods ----
            updateValuationMethods: (projectId, methods) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({ ...p, valuationMethods: methods }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Sales Comp Cases (Legacy) ----
            addSalesCompCase: (projectId) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
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
                    );
                    return setUserProjects(state, updated);
                });
            },

            updateSalesCompCase: (projectId, caseId, patch) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            salesCompCases: p.salesCompCases.map((c) =>
                                c.id === caseId ? { ...c, ...patch } : c,
                            ),
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            deleteSalesCompCase: (projectId, caseId) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            salesCompCases: p.salesCompCases.filter((c) => c.id !== caseId),
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ============================================================
            // FortuneSheet Hybrid Storage Actions
            // ============================================================

            bindAnchor: (projectId, fieldKey, anchor) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors, [fieldKey]: anchor };
                        return setDirty({ ...p, salesAnchors: nextAnchors });
                    });
                    return setUserProjects(state, updated);
                });
            },

            unbindAnchor: (projectId, fieldKey) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors };
                        delete nextAnchors[fieldKey];
                        return setDirty({ ...p, salesAnchors: nextAnchors });
                    });
                    return setUserProjects(state, updated);
                });
            },

            updateSalesSheetData: (projectId, data) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({ ...p, salesSheetData: data }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            updateSheetData: (projectId, sheetType, data) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) => {
                        const newSheets = { ...(p.sheetData || {}), [sheetType]: data };
                        return setDirty({ ...p, sheetData: newSheets });
                    });
                    return setUserProjects(state, updated);
                });
            },

            addCustomField: (projectId, field) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            customFields: [...(p.customFields || []), field],
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            removeCustomField: (projectId, fieldKey) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) => {
                        const nextAnchors = { ...p.salesAnchors };
                        delete nextAnchors[fieldKey];

                        return setDirty({
                            ...p,
                            customFields: (p.customFields || []).filter(f => f.key !== fieldKey),
                            salesAnchors: nextAnchors,
                        });
                    });
                    return setUserProjects(state, updated);
                });
            },

            extractMetricsFromData: (projectId, data) => {
                const project = getUserProjects(get()).find(p => p.id === projectId);
                if (!project) return;

                const anchors = project.salesAnchors || {};
                const extracted: Record<string, string | number | null> = {};

                const allFields = [...STANDARD_FIELDS, ...(project.customFields || [])];

                allFields.forEach(field => {
                    const anchor = anchors[field.key];
                    if (!anchor) {
                        extracted[field.key] = null;
                        return;
                    }

                    let val: string | number | null = null;
                    if (field.valueType === 'number') {
                        val = getCellNumberValue(data, anchor.sheetId, anchor.r, anchor.c);
                    } else {
                        val = getCellValue(data, anchor.sheetId, anchor.r, anchor.c);
                        if (val !== null) val = String(val);
                    }
                    extracted[field.key] = val;
                });

                const legacyResult = { ...project.salesResult };
                if (extracted['subject_value_unit'] !== undefined) {
                    legacyResult.unitPrice = typeof extracted['subject_value_unit'] === 'number' ? extracted['subject_value_unit'] : null;
                }
                if (extracted['subject_value_total'] !== undefined) {
                    legacyResult.totalValue = typeof extracted['subject_value_total'] === 'number' ? extracted['subject_value_total'] : null;
                }

                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            extractedMetrics: extracted,
                            salesResult: legacyResult
                        })
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Cost Items ----
            addCostItem: (projectId) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: [
                                ...p.costItems,
                                { id: generateId(), name: '', amount: null },
                            ],
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            updateCostItem: (projectId, itemId, patch) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: p.costItems.map((item) =>
                                item.id === itemId ? { ...item, ...patch } : item,
                            ),
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            deleteCostItem: (projectId, itemId) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            costItems: p.costItems.filter((item) => item.id !== itemId),
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Conclusion ----
            updateConclusion: (projectId, patch) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({
                            ...p,
                            conclusion: { ...p.conclusion, ...patch },
                        }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Save Report Content ----
            saveReportContent: (projectId, htmlContent) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) =>
                        setDirty({ ...p, reportContent: htmlContent }),
                    );
                    return setUserProjects(state, updated);
                });
            },

            // ---- Generate Report ----
            generateReport: (projectId) => {
                set((state) => {
                    const updated = updateProjectInList(getUserProjects(state), projectId, (p) => ({
                        ...p,
                        status: {
                            isDirty: false,
                            reportGeneratedAt: new Date().toISOString(),
                        },
                        updatedAt: new Date().toISOString(),
                    }));
                    return setUserProjects(state, updated);
                });
            },
        }),
        {
            name: 'smartval.store.v2',
            storage: createJSONStorage(() => localStorage),
            // 持久化用户 ID 和按用户隔离的项目数据
            partialize: (state) => ({
                currentUserId: state.currentUserId,
                projectsByUser: state.projectsByUser,
            }),
            // 水合时恢复派生的 projects
            onRehydrateStorage: () => (state) => {
                if (state && state.currentUserId) {
                    state.projects = state.projectsByUser[state.currentUserId] ?? [];
                }
            },
            skipHydration: true,
        },
    ),
);
