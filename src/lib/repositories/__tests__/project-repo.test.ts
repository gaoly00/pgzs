import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb } from '@/lib/db/index';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  type ServerProject,
} from '../project-repo';

describe('Project Repository', () => {
  const testTenantId = 'test-tenant-123';
  const testUserId = 'test-user-456';
  let testProjectId: string;

  beforeEach(() => {
    // Create a test project
    const project: ServerProject = {
      id: 'test-project-001',
      tenantId: testTenantId,
      name: 'Test Project',
      projectNumber: 'PRJ-001',
      projectType: 'real-estate',
      valuationDate: '2026-03-04',
      propertyType: 'residential',
      gfa: 1000,
      address: 'Test Address',
      valuationMethods: ['sales-comp'],
      salesAnchors: {},
      salesResult: { unitPrice: null, totalValue: null },
      extractedMetrics: {},
      customFields: [],
      status: { isDirty: false, reportGeneratedAt: null },
      createdBy: testUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createProject(testTenantId, project);
    testProjectId = project.id;
  });

  afterEach(() => {
    // Clean up test data
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE tenant_id = ?').run(testTenantId);
  });

  describe('createProject', () => {
    it('should create a new project', () => {
      const newProject: ServerProject = {
        id: 'test-project-002',
        tenantId: testTenantId,
        name: 'New Test Project',
        projectNumber: 'PRJ-002',
        projectType: 'real-estate',
        valuationDate: '2026-03-05',
        propertyType: 'commercial',
        gfa: 2000,
        address: 'New Test Address',
        valuationMethods: ['cost'],
        salesAnchors: {},
        salesResult: { unitPrice: null, totalValue: null },
        extractedMetrics: {},
        customFields: [],
        status: { isDirty: false, reportGeneratedAt: null },
        createdBy: testUserId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      createProject(testTenantId, newProject);
      const retrieved = getProject(testTenantId, newProject.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('New Test Project');
      expect(retrieved?.projectNumber).toBe('PRJ-002');
    });
  });

  describe('getProject', () => {
    it('should retrieve an existing project', () => {
      const project = getProject(testTenantId, testProjectId);

      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
      expect(project?.name).toBe('Test Project');
      expect(project?.tenantId).toBe(testTenantId);
    });

    it('should return null for non-existent project', () => {
      const project = getProject(testTenantId, 'non-existent-id');
      expect(project).toBeNull();
    });

    it('should enforce tenant isolation', () => {
      const project = getProject('different-tenant', testProjectId);
      expect(project).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('should list all projects for a tenant', () => {
      const projects = listProjects(testTenantId);

      expect(projects).toBeDefined();
      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].tenantId).toBe(testTenantId);
    });

    it('should return empty array for tenant with no projects', () => {
      const projects = listProjects('empty-tenant');
      expect(projects).toEqual([]);
    });

    it('should enforce tenant isolation', () => {
      // Create tenant and user for other tenant first
      const db = getDb();

      // Create other tenant
      const existingOtherTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get('other-tenant');
      if (!existingOtherTenant) {
        db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)').run(
          'other-tenant',
          'Other Tenant',
          new Date().toISOString()
        );
      }

      // Create other user
      const existingOtherUser = db.prepare('SELECT id FROM users WHERE id = ?').get('other-user');
      if (!existingOtherUser) {
        db.prepare('INSERT INTO users (id, tenant_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
          'other-user',
          'other-tenant',
          'otheruser',
          'dummy-hash',
          'valuer',
          new Date().toISOString()
        );
      }

      // Create project for different tenant
      const otherProject: ServerProject = {
        id: 'other-project-001',
        tenantId: 'other-tenant',
        name: 'Other Project',
        projectNumber: 'OTHER-001',
        projectType: 'real-estate',
        valuationDate: '2026-03-04',
        propertyType: 'residential',
        gfa: 500,
        address: 'Other Address',
        valuationMethods: ['sales-comp'],
        salesAnchors: {},
        salesResult: { unitPrice: null, totalValue: null },
        extractedMetrics: {},
        customFields: [],
        status: { isDirty: false, reportGeneratedAt: null },
        createdBy: 'other-user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      createProject('other-tenant', otherProject);

      const projects = listProjects(testTenantId);
      expect(projects.every(p => p.tenantId === testTenantId)).toBe(true);

      // Cleanup
      db.prepare('DELETE FROM projects WHERE tenant_id = ?').run('other-tenant');
      db.prepare('DELETE FROM users WHERE id = ?').run('other-user');
      db.prepare('DELETE FROM tenants WHERE id = ?').run('other-tenant');
    });
  });

  describe('updateProject', () => {
    it('should update project fields', () => {
      const updated = updateProject(testTenantId, testProjectId, {
        name: 'Updated Project Name',
        gfa: 1500,
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Project Name');
      expect(updated?.gfa).toBe(1500);
      expect(updated?.projectNumber).toBe('PRJ-001'); // unchanged
    });

    it('should return null for non-existent project', () => {
      const updated = updateProject(testTenantId, 'non-existent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should enforce tenant isolation', () => {
      const updated = updateProject('different-tenant', testProjectId, { name: 'Hacked' });
      expect(updated).toBeNull();

      // Verify original unchanged
      const original = getProject(testTenantId, testProjectId);
      expect(original?.name).toBe('Test Project');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', () => {
      const success = deleteProject(testTenantId, testProjectId);
      expect(success).toBe(true);

      const deleted = getProject(testTenantId, testProjectId);
      expect(deleted).toBeNull();
    });

    it('should return false for non-existent project', () => {
      const success = deleteProject(testTenantId, 'non-existent');
      expect(success).toBe(false);
    });

    it('should enforce tenant isolation', () => {
      const success = deleteProject('different-tenant', testProjectId);
      expect(success).toBe(false);

      // Verify project still exists
      const project = getProject(testTenantId, testProjectId);
      expect(project).toBeDefined();
    });
  });
});
