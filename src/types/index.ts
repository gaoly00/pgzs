// ============================================================
// SmartVal — Core Data Types
// ============================================================

import type { SharedProject } from './shared';
export type { SharedProject } from './shared';

export type ProjectValuationType = 'real-estate' | 'land';

/** 估价方法 Key */
export type ValuationMethodKey =
  | 'basic-info'           // 基础信息（通用）
  | 'sales-comp'
  | 'cost-approach'
  | 'income-approach'
  | 'hypothetical-dev'
  // Land methods
  | 'benchmark-land-price' // 公示地价系数修正法
  | 'residual-method'      // 剩余法
  | 'land-sales-comp'      // 市场比较法 (土地)
  | 'land-income'          // 收益还原法
  | 'cost-approach-land'   // 成本逼近法
  // Common pages
  | 'conclusion';          // 估价结论

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
  'basic-info': '基础信息',
  'sales-comp': '比较法',
  'cost-approach': '成本法',
  'income-approach': '收益法',
  'hypothetical-dev': '假设开发法',
  'benchmark-land-price': '公示地价系数修正法',
  'residual-method': '剩余法',
  'land-sales-comp': '市场比较法',
  'land-income': '收益还原法',
  'cost-approach-land': '成本逼近法',
  'conclusion': '估价结论',
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

// ============================================================
// Word 模板管理
// ============================================================

/** 全局 Word 报告模板 */
export interface ReportTemplate {
  id: string;
  name: string;                          // 模板名称
  fileName: string;                      // 原始文件名
  /** .docx 文件内容（base64 编码） */
  docxBase64: string;
  /** mammoth 转换后的 HTML（缓存，避免每次重新转换） */
  htmlContent?: string;
  /** 模板中发现的占位符列表，如 ['client_name', 'property_address'] */
  placeholders: string[];
  uploadedAt: string;
  updatedAt: string;
}

/** 项目 — 前端扩展类型，继承共享的数据库结构 */
export interface Project extends SharedProject {
  // 覆盖为更严格的前端类型
  valuationMethods: ValuationMethodKey[];
  salesAnchors: SalesAnchors;
  salesResult: SalesResult;
  customFields: CustomFieldDef[];
  // 前端专属字段（可选，不存在于数据库）
  salesCompCases?: SalesCompCase[];
  costItems?: CostItem[];
  conclusion?: Conclusion;
  salesSheetData?: any | null;
  sheetData?: Record<string, any>;
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
