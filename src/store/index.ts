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

    // 项目列表（从 API 加载，不再持久化到 localStorage）
    projects: Project[];

    // 兼容：旧的 projectsByUser 仅用于数据迁移
    projectsByUser: Record<string, Project[]>;

    // 用户管理
    setCurrentUser: (userId: string) => void;
    logoutUser: () => void;

    // ---- 服务端同步 ----
    loadProjectsFromServer: () => Promise<void>;
    syncProjectToServer: (projectId: string) => Promise<void>;

    // ---- Actions ----
    createProject: (data: CreateProjectInput) => string;
    createProjectViaAPI: (data: CreateProjectInput) => Promise<string>;
    deleteProject: (id: string) => void;
    deleteProjectViaAPI: (id: string) => Promise<boolean>;
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

    // Word 模板关联
    updateProjectTemplate: (projectId: string, templateId: string | undefined) => void;

    // 已弃用：Word 模板已迁移到服务端 API
    reportTemplates: any[];
    addTemplate: (template: any) => void;
    deleteTemplate: (templateId: string) => void;
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
            currentUserId: null,
            projectsByUser: {},
            projects: [],
            reportTemplates: [],

            setCurrentUser: (userId: string) => {
                set((state) => ({
                    currentUserId: userId,
                    // 尝试从旧数据恢复（兼容迁移期）
                    projects: state.projects.length > 0 ? state.projects : (state.projectsByUser[userId] ?? []),
                }));
            },

            logoutUser: () => {
                set({ currentUserId: null, projects: [] });
            },

            // ============================================================
            // 服务端同步
            // ============================================================

            loadProjectsFromServer: async () => {
                try {
                    const res = await fetch('/api/projects');
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data.projects && Array.isArray(data.projects)) {
                        // 服务端项目列表作为权威来源
                        set({ projects: data.projects });
                    }
                } catch (err) {
                    console.warn('[store] 从服务端加载项目失败，使用本地缓存:', err);
                }
            },

            syncProjectToServer: async (projectId: string) => {
                const project = get().projects.find(p => p.id === projectId);
                if (!project) return;

                try {
                    await fetch(`/api/projects/${projectId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(project),
                    });
                } catch (err) {
                    console.warn('[store] 同步项目到服务端失败:', err);
                }
            },

            // ---- Create Project (本地版本，保持兼容) ----
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
                set((state) => ({
                    projects: [...state.projects, newProject],
                }));
                return id;
            },

            // ---- Create Project (API 版本) ----
            createProjectViaAPI: async (data) => {
                try {
                    const res = await fetch('/api/projects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    });
                    const result = await res.json();
                    if (res.ok && result.project) {
                        // 将服务端返回的项目补充前端需要的默认字段
                        const serverProject = result.project;
                        const fullProject: Project = {
                            ...serverProject,
                            salesCompCases: serverProject.salesCompCases ?? createDefaultSalesCompCases(),
                            costItems: serverProject.costItems ?? createDefaultCostItems(),
                            conclusion: serverProject.conclusion ?? {
                                selectedMethod: 'salesComp',
                                manualUnitPrice: null,
                                manualReason: '',
                            },
                            salesSheetData: serverProject.salesSheetData ?? null,
                            sheetData: serverProject.sheetData ?? {},
                            salesAnchors: serverProject.salesAnchors ?? {},
                            salesResult: serverProject.salesResult ?? { unitPrice: null, totalValue: null },
                            extractedMetrics: serverProject.extractedMetrics ?? {},
                            customFields: serverProject.customFields ?? [],
                            status: serverProject.status ?? { isDirty: false, reportGeneratedAt: null },
                        };
                        set((state) => ({
                            projects: [...state.projects, fullProject],
                        }));
                        return fullProject.id;
                    }
                    throw new Error(result.error || '创建失败');
                } catch (err) {
                    console.error('[store] API 创建项目失败，回退到本地:', err);
                    // 回退到本地创建
                    return get().createProject(data);
                }
            },

            // ---- Delete Project (本地版本) ----
            deleteProject: (id) => {
                set((state) => ({
                    projects: state.projects.filter((p) => p.id !== id),
                }));
            },

            // ---- Delete Project (API 版本) ----
            deleteProjectViaAPI: async (id) => {
                try {
                    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        set((state) => ({
                            projects: state.projects.filter((p) => p.id !== id),
                        }));
                        return true;
                    }
                    return false;
                } catch {
                    return false;
                }
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
                        setDirty({ ...p, salesSheetData: data }),
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
                const project = get().projects.find(p => p.id === projectId);
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

            // ---- Save Report Content ----
            saveReportContent: (projectId, htmlContent) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({ ...p, reportContent: htmlContent }),
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

            // ---- Word 模板（已弃用，保持接口兼容） ----
            addTemplate: () => {
                console.warn('[store] addTemplate 已弃用，请使用 /api/templates/word API');
            },
            deleteTemplate: () => {
                console.warn('[store] deleteTemplate 已弃用，请使用 /api/templates/word API');
            },

            updateProjectTemplate: (projectId, templateId) => {
                set((state) => ({
                    projects: updateProjectInList(state.projects, projectId, (p) =>
                        setDirty({ ...p, templateId }),
                    ),
                }));
            },
        }),
        {
            name: 'smartval.store.v3',
            storage: createJSONStorage(() => localStorage),
            // 仅持久化 userId，项目数据从 API 加载
            partialize: (state) => ({
                currentUserId: state.currentUserId,
            }),
            // 水合时只恢复 userId
            onRehydrateStorage: () => (state) => {
                if (state && state.currentUserId) {
                    // 项目数据将由 AuthHydration 从 API 加载
                }
            },
            skipHydration: true,
        },
    ),
);
