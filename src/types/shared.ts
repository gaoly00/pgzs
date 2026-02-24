/**
 * 前后端共享的 Project 类型
 *
 * 这是数据库的真实结构，前后端共用。
 * 前端 Project 在此基础上添加可选的客户端专属字段。
 */

export type ProjectValuationType = 'real-estate' | 'land';

export interface SharedProject {
    id: string;
    tenantId: string;
    name: string;
    projectNumber?: string;
    projectType: ProjectValuationType;
    valuationDate: string;
    propertyType: string;
    gfa: number | null;
    address: string;
    valuationMethods: string[];
    salesAnchors: Record<string, any>;
    salesResult: { unitPrice: number | null; totalValue: number | null };
    extractedMetrics: Record<string, string | number | null>;
    customFields: Array<{ key: string; label: string; valueType: string; unit?: string }>;
    templateId?: string;
    reportContent?: string;
    status: { isDirty: boolean; reportGeneratedAt: string | null };
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
