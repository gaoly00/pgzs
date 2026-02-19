// ============================================================
// SmartVal — Core Data Types
// ============================================================

export type ProjectValuationType = 'real-estate' | 'land';

/** 估价方法 Key */
export type ValuationMethodKey =
  | 'sales-comp'
  | 'cost-approach'
  | 'income-approach'
  | 'hypothetical-dev'
  // Land methods
  | 'benchmark-land-price' // 公示地价系数修正法
  | 'residual-method'      // 剩余法
  | 'land-sales-comp'      // 市场比较法 (土地)
  | 'land-income'          // 收益还原法
  | 'cost-approach-land';  // 成本逼近法

/** 估价方法可选项信息 */
export const VALUATION_METHODS_CONFIG: Record<
  ProjectValuationType,
  { key: ValuationMethodKey; label: string }[]
> = {
  'real-estate': [
    { key: 'sales-comp', label: '比较法' },
    { key: 'cost-approach', label: '成本法' },
    { key: 'income-approach', label: '收益法' },
    { key: 'hypothetical-dev', label: '假设开发法' },
  ],
  'land': [
    { key: 'benchmark-land-price', label: '公示地价系数修正法' },
    { key: 'residual-method', label: '剩余法' },
    { key: 'land-sales-comp', label: '市场比较法' },
    { key: 'land-income', label: '收益还原法' },
    { key: 'cost-approach-land', label: '成本逼近法' },
  ],
};

/** 扁平化的方法映射（兼容旧逻辑） */
export const VALUATION_METHODS: Record<ValuationMethodKey, string> = {
  'sales-comp': '比较法',
  'cost-approach': '成本法',
  'income-approach': '收益法',
  'hypothetical-dev': '假设开发法',
  'benchmark-land-price': '公示地价系数修正法',
  'residual-method': '剩余法',
  'land-sales-comp': '市场比较法',
  'land-income': '收益还原法',
  'cost-approach-land': '成本逼近法',
};

/** 可比案例（比较法） */
export interface SalesCompCase {
  id: string;
  caseName: string;
  transactionDate: string;
  unitPrice: number | null;   // 单价 (元/㎡)
  area: number | null;        // 面积 (㎡)
  adjustedPrice: number | null; // 修正后单价 (MVP: = unitPrice * 1.0)
  weight: number | null;       // 权重 (= 1/N)
}

/** 成本项（成本法） */
export interface CostItem {
  id: string;
  name: string;
  amount: number | null;       // 金额
}

/** 估价结论 */
export interface Conclusion {
  selectedMethod: 'salesComp' | 'cost' | 'manual';
  manualUnitPrice: number | null;
  manualReason: string;
}

/** 项目状态 */
export interface ProjectStatus {
  isDirty: boolean;
  reportGeneratedAt: string | null;
}

// ============================================================
// FortuneSheet / Hybrid Storage Types
// ============================================================

/** A cell coordinate reference (anchor) within a FortuneSheet workbook */
export interface SalesAnchor {
  sheetId: string;
  sheetName: string;
  r: number;
  c: number;
  a1: string;
}

/** Anchor map */
export interface SalesAnchors {
  [fieldKey: string]: SalesAnchor | undefined;
}

/** Extracted numeric results from the spreadsheet via anchors (Legacy/Typed subset) */
export interface SalesResult {
  unitPrice: number | null;
  totalValue: number | null;
}

export interface CustomFieldDef {
  key: string;
  label: string;
  valueType: 'number' | 'text';
  unit?: string;
}

/** 项目 */
export interface Project {
  id: string;
  name: string;
  projectNumber?: string;
  projectType: ProjectValuationType; // 新增项目类型

  valuationDate: string;
  propertyType: string;
  gfa: number | null;          // 建筑面积 Gross Floor Area
  address: string;

  // 启用的估价方法（仅控制 UI 可见性，不删除数据）
  valuationMethods: ValuationMethodKey[];

  // Legacy module data (kept for migration; do NOT remove)
  salesCompCases: SalesCompCase[];
  costItems: CostItem[];
  conclusion: Conclusion;

  // FortuneSheet Hybrid Storage (new)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  salesSheetData: any | null;           // Full sheet blob for UI restoration (Legacy: Sales Comp)
  sheetData: Record<string, any>;       // New: Isolated storage for all sheet types (keyed by sheetType)
  salesAnchors: SalesAnchors;           // Dynamic anchor coordinates
  salesResult: SalesResult;             // Extracted numeric results (Legacy, keep for existing)
  extractedMetrics: Record<string, string | number | null>; // New: Generic extracted results
  customFields: CustomFieldDef[];       // New: User-defined fields

  // 状态
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/** 创建项目的输入 */
export interface CreateProjectInput {
  name: string;
  projectNumber: string;
  projectType?: ProjectValuationType; // 默认 'real-estate'
  valuationDate?: string;
  propertyType?: string;
  gfa?: number | null;
  address?: string;
  valuationMethods?: ValuationMethodKey[];
}

// ============================================================
// 默认成本项名称（8条标准）
// ============================================================
export const DEFAULT_COST_ITEM_NAMES = [
  '土地取得成本',
  '建安工程费',
  '前期工程费',
  '基础设施配套费',
  '公共配套设施费',
  '开发期间税费',
  '管理费用',
  '开发利润',
] as const;

/** Unified Name Mapping for UI (Breadcrumbs & Headers) */
export const METHOD_NAME_MAP: Record<string, string> = {
  // --- Standard Keys ---
  'sales-comp': "Sales Comparison / 比较法",
  'cost-approach': "Cost Approach / 成本法",
  'income-approach': "Income Approach / 收益法",
  'hypothetical-dev': "Hypothetical Development / 假设开发法",

  // --- Land Keys ---
  'benchmark-land-price': "Benchmark Land Price / 公示地价系数修正法",
  'residual-method': "Residual Method / 剩余法",
  'land-sales-comp': "Market Comparison (Land) / 市场比较法 (土地)",
  'land-income': "Income Approach (Land) / 收益还原法",
  'cost-approach-land': "Cost Approach (Land) / 成本逼近法",

  // --- URL Aliases (Directory Slugs) ---
  'cost': "Cost Approach / 成本法",
  'income': "Income Approach / 收益法",
  'dev': "Hypothetical Development / 假设开发法", // Just in case

  // --- Generic Pages ---
  'basic-info': "Basic Information / 基础信息",
  'conclusion': "Conclusion / 估价结论",
  'report': "Report / 报告生成",
  'projects': "Projects / 项目列表",
  'settings': "Settings / 设置",
  'new': "New Project / 新建项目",
};
