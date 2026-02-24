/**
 * 租户 (Tenant) Repository — SQLite
 */

import { getDb } from '@/lib/db/index';

export interface Tenant {
    id: string;
    name: string;
    createdAt: string;
}

export function listTenants(): Tenant[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM tenants').all() as any[];
    return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export function getTenant(id: string): Tenant | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function createTenant(tenant: Tenant): void {
    const db = getDb();
    db.prepare(
        'INSERT OR IGNORE INTO tenants (id, name, created_at) VALUES (?, ?, ?)'
    ).run(tenant.id, tenant.name, tenant.createdAt);
}

export function ensureTenantExists(id: string, defaultName: string) {
    if (!getTenant(id)) {
        createTenant({ id, name: defaultName, createdAt: new Date().toISOString() });
    }
}
