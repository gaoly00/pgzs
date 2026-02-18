// ============================================================
// SmartVal — Core Data Types
// ============================================================

/** 估价方法 Key */
export type ValuationMethodKey =
  | 'sales-comp'
  | 'cost-approach'
  | 'income-approach'
  | 'hypothetical-dev';

/** 估价方法可选项 */
export const VALUATION_METHODS: Record<ValuationMethodKey, string> = {
  'sales-comp': '比较法',
  'cost-approach': '成本法',
  'income-approach': '收益法',
  'hypothetical-dev': '假设开发法',
} as const;

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
  salesSheetData: any | null;           // Full sheet blob for UI restoration
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
  valuationDate: string;
  propertyType: string;
  gfa: number | null;
  address: string;
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
