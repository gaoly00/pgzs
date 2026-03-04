import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import { getDb } from './src/lib/db/index';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables for tests
process.env.SESSION_SECRET = 'test-secret-key-for-vitest-testing';

// Initialize test database with test tenant
beforeAll(() => {
  const db = getDb();

  // Create test tenant if not exists
  const existingTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get('test-tenant-123');
  if (!existingTenant) {
    db.prepare('INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)').run(
      'test-tenant-123',
      'Test Tenant',
      new Date().toISOString()
    );
  }

  // Create test user if not exists
  const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get('test-user-456');
  if (!existingUser) {
    db.prepare('INSERT INTO users (id, tenant_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      'test-user-456',
      'test-tenant-123',
      'testuser',
      'dummy-hash',
      'valuer',
      new Date().toISOString()
    );
  }
});
