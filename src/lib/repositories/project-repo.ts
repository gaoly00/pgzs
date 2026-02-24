/**
 * 项目 Repository — SQLite
 *
 * 保持函数签名不变，API 路由无需改动。
 */

import { getDb } from '@/lib/db/index';
import type { SharedProject } from '@/types/shared';

// 向后兼容：ServerProject 即 SharedProject
export type ServerProject = SharedProject;

function rowToProject(r: any): SharedProject {
    return {
        id: r.id,
        tenantId: r.tenant_id,
        name: r.name,
        projectNumber: r.project_number || undefined,
        projectType: r.project_type,
        valuationDate: r.valuation_date,
        propertyType: r.property_type,
        gfa: r.gfa,
        address: r.address,
        valuationMethods: JSON.parse(r.valuation_methods || '[]'),
        salesAnchors: JSON.parse(r.sales_anchors || '{}'),
        salesResult: JSON.parse(r.sales_result || '{}'),
        extractedMetrics: JSON.parse(r.extracted_metrics || '{}'),
        customFields: JSON.parse(r.custom_fields || '[]'),
        templateId: r.template_id || undefined,
        reportContent: r.report_content || undefined,
        status: JSON.parse(r.status || '{}'),
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export function listProjects(tenantId: string): ServerProject[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM projects WHERE tenant_id = ?').all(tenantId) as any[];
    return rows.map(rowToProject);
}

export function getProject(tenantId: string, projectId: string): ServerProject | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM projects WHERE tenant_id = ? AND id = ?').get(tenantId, projectId) as any;
    if (!row) return null;
    return rowToProject(row);
}

export function createProject(tenantId: string, project: ServerProject): void {
    const db = getDb();
    db.prepare(
        `INSERT INTO projects (id, tenant_id, name, project_number, project_type, valuation_date,
         property_type, gfa, address, valuation_methods, sales_anchors, sales_result,
         extracted_metrics, custom_fields, template_id, report_content, status,
         created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
        project.id, tenantId, project.name, project.projectNumber || null,
        project.projectType, project.valuationDate, project.propertyType,
        project.gfa, project.address,
        JSON.stringify(project.valuationMethods),
        JSON.stringify(project.salesAnchors),
        JSON.stringify(project.salesResult),
        JSON.stringify(project.extractedMetrics),
        JSON.stringify(project.customFields),
        project.templateId || null, project.reportContent || null,
        JSON.stringify(project.status),
        project.createdBy, project.createdAt, project.updatedAt,
    );
}

export function updateProject(tenantId: string, projectId: string, patch: Partial<ServerProject>): ServerProject | null {
    const existing = getProject(tenantId, projectId);
    if (!existing) return null;

    const merged = {
        ...existing,
        ...patch,
        id: existing.id,
        tenantId: existing.tenantId,
        updatedAt: new Date().toISOString(),
    };

    const db = getDb();
    db.prepare(
        `UPDATE projects SET name=?, project_number=?, project_type=?, valuation_date=?,
         property_type=?, gfa=?, address=?, valuation_methods=?, sales_anchors=?,
         sales_result=?, extracted_metrics=?, custom_fields=?, template_id=?,
         report_content=?, status=?, updated_at=?
         WHERE id=? AND tenant_id=?`
    ).run(
        merged.name, merged.projectNumber || null, merged.projectType,
        merged.valuationDate, merged.propertyType, merged.gfa, merged.address,
        JSON.stringify(merged.valuationMethods),
        JSON.stringify(merged.salesAnchors),
        JSON.stringify(merged.salesResult),
        JSON.stringify(merged.extractedMetrics),
        JSON.stringify(merged.customFields),
        merged.templateId || null, merged.reportContent || null,
        JSON.stringify(merged.status), merged.updatedAt,
        projectId, tenantId,
    );

    return merged;
}

export function deleteProject(tenantId: string, projectId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM projects WHERE id = ? AND tenant_id = ?').run(projectId, tenantId);
    return result.changes > 0;
}
