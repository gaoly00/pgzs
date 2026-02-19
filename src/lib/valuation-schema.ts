export type FieldValueType = 'number' | 'text';
export type FieldCategory = 'Results' | 'Subject' | 'Comparables' | 'Other';

export interface StandardFieldDef {
    key: string;
    label: string;
    category: FieldCategory;
    valueType: FieldValueType;
    keywords?: string[];       // 用于 auto-scanner 关键词匹配
    excludeKeywords?: string[]; // 用于 auto-scanner 排除匹配
}

export const STANDARD_FIELDS: StandardFieldDef[] = [
    // Results
    { key: 'subject_value_unit', label: 'Indicated Unit Price (单价)', category: 'Results', valueType: 'number' },
    { key: 'subject_value_total', label: 'Indicated Total Value (总价)', category: 'Results', valueType: 'number' },

    // Subject Property
    { key: 'valuation_date', label: 'Valuation Date (价值时点)', category: 'Subject', valueType: 'text' },
    { key: 'property_address', label: 'Property Address (坐落)', category: 'Subject', valueType: 'text' },
    { key: 'property_type', label: 'Property Type (物业类型)', category: 'Subject', valueType: 'text' },
    { key: 'gfa', label: 'Gross Floor Area (建筑面积)', category: 'Subject', valueType: 'number' },
    { key: 'land_area', label: 'Land Area (土地面积)', category: 'Subject', valueType: 'number' },
    { key: 'owner_name', label: 'Owner Name (权利人)', category: 'Subject', valueType: 'text' },
    { key: 'certificate_no', label: 'Certificate No. (证书编号)', category: 'Subject', valueType: 'text' },
    { key: 'year_built', label: 'Year Built (建成年份)', category: 'Subject', valueType: 'text' },
    { key: 'structure_type', label: 'Structure Type (结构)', category: 'Subject', valueType: 'text' },
    { key: 'floor_level', label: 'Floor Level (楼层)', category: 'Subject', valueType: 'text' },
    { key: 'total_floors', label: 'Total Floors (总层数)', category: 'Subject', valueType: 'number' },
    { key: 'orientation', label: 'Orientation (朝向)', category: 'Subject', valueType: 'text' },
    { key: 'land_use_years', label: 'Land Use Years (使用年限)', category: 'Subject', valueType: 'text' },
    { key: 'land_unit_price', label: 'Land Unit Price (地价)', category: 'Subject', valueType: 'number' },

    // Other
    { key: 'report_no', label: 'Report No. (报告编号)', category: 'Other', valueType: 'text' },
    { key: 'appraiser_name', label: 'Appraiser Name (估价师)', category: 'Other', valueType: 'text' },
    { key: 'replacement_cost', label: 'Replacement Cost (重置价)', category: 'Other', valueType: 'number' },
    { key: 'depreciation', label: 'Depreciation (折旧)', category: 'Other', valueType: 'number' },
];
