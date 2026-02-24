/**
 * One-time migration: JSON flat files -> SQLite
 *
 * Usage:  npx tsx src/lib/db/migrate-json.ts
 */

import fs from 'fs';
import path from 'path';
import { getDb } from './index';
import { initSchema } from './schema';

const DATA_DIR = path.join(process.cwd(), 'data');

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function readJsonSafe<T = unknown>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch (err) {
    console.warn(`  [WARN] Failed to read ${filePath}:`, (err as Error).message);
    return null;
  }
}

function jsonStr(value: unknown): string {
  if (value === undefined || value === null) return '{}';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function jsonArr(value: unknown): string {
  if (value === undefined || value === null) return '[]';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/* ------------------------------------------------------------------ */
/*  1. Tenants                                                        */
/* ------------------------------------------------------------------ */

function migrateTenants() {
  const file = path.join(DATA_DIR, 'tenants.json');
  const tenants = readJsonSafe<any[]>(file);
  if (!tenants) { console.log('[tenants] tenants.json not found, skipping.'); return; }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO tenants (id, name, created_at) VALUES (?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const t of tenants) {
      insert.run(t.id, t.name, t.createdAt);
    }
  });
  tx();
  console.log(`[tenants] Migrated ${tenants.length} tenants.`);
}

/* ------------------------------------------------------------------ */
/*  2. Users (+ auto-create missing tenants)                          */
/* ------------------------------------------------------------------ */

function migrateUsers() {
  const file = path.join(DATA_DIR, 'users.json');
  const users = readJsonSafe<any[]>(file);
  if (!users) { console.log('[users] users.json not found, skipping.'); return; }

  const db = getDb();
  const insertTenant = db.prepare(
    `INSERT OR IGNORE INTO tenants (id, name, created_at) VALUES (?, ?, ?)`
  );
  const insertUser = db.prepare(
    `INSERT OR IGNORE INTO users (id, username, password_hash, role, tenant_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const u of users) {
      const role = u.role ?? (u.username === 'admin' ? 'admin' : 'valuer');
      const tenantId = u.tenantId ?? `tenant_${u.id.slice(0, 8)}`;

      // Ensure tenant exists
      insertTenant.run(tenantId, `${u.username}的租户`, u.createdAt);

      insertUser.run(u.id, u.username, u.passwordHash, role, tenantId, u.createdAt);
    }
  });
  tx();
  console.log(`[users] Migrated ${users.length} users.`);
}

/* ------------------------------------------------------------------ */
/*  3. Sessions                                                       */
/* ------------------------------------------------------------------ */

function migrateSessions() {
  const file = path.join(DATA_DIR, 'sessions.json');
  const sessions = readJsonSafe<any[]>(file);
  if (!sessions) { console.log('[sessions] sessions.json not found, skipping.'); return; }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const s of sessions) {
      insert.run(s.tokenHash, s.userId, s.expiresAt);
    }
  });
  tx();
  console.log(`[sessions] Migrated ${sessions.length} sessions.`);
}

/* ------------------------------------------------------------------ */
/*  4. Projects                                                       */
/* ------------------------------------------------------------------ */

function migrateProjects() {
  const projectsDir = path.join(DATA_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    console.log('[projects] data/projects/ not found, skipping.');
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO projects
     (id, tenant_id, name, project_number, project_type, valuation_date,
      property_type, gfa, address, valuation_methods, sales_anchors,
      sales_result, extracted_metrics, custom_fields, template_id,
      report_content, status, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let count = 0;
  const tx = db.transaction(() => {
    // Scan for tenant directories containing projects.json
    for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const tenantId = entry.name;
      const pFile = path.join(projectsDir, tenantId, 'projects.json');
      const projects = readJsonSafe<any[]>(pFile);
      if (!projects) continue;

      for (const p of projects) {
        insert.run(
          p.id,
          p.tenantId ?? tenantId,
          p.name,
          p.projectNumber ?? null,
          p.projectType ?? 'real-estate',
          p.valuationDate ?? '',
          p.propertyType ?? '',
          p.gfa ?? null,
          p.address ?? '',
          jsonArr(p.valuationMethods),
          jsonStr(p.salesAnchors),
          jsonStr(p.salesResult),
          jsonStr(p.extractedMetrics),
          jsonArr(p.customFields),
          p.templateId ?? null,
          p.reportContent ?? null,
          jsonStr(p.status),
          p.createdBy ?? '',
          p.createdAt ?? new Date().toISOString(),
          p.updatedAt ?? p.createdAt ?? new Date().toISOString(),
        );
        count++;
      }
    }
  });
  tx();
  console.log(`[projects] Migrated ${count} projects.`);
}

/* ------------------------------------------------------------------ */
/*  5. Sheets (new layout + legacy layout)                            */
/* ------------------------------------------------------------------ */

function migrateSheets() {
  const projectsDir = path.join(DATA_DIR, 'projects');
  if (!fs.existsSync(projectsDir)) {
    console.log('[sheets] data/projects/ not found, skipping.');
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO sheets (tenant_id, project_id, method, data, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  let count = 0;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    // --- New layout: data/projects/{tenantId}/{projectId}/sheets/{method}.json
    for (const tenantEntry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!tenantEntry.isDirectory()) continue;
      const tenantId = tenantEntry.name;
      const tenantDir = path.join(projectsDir, tenantId);

      for (const projEntry of fs.readdirSync(tenantDir, { withFileTypes: true })) {
        if (!projEntry.isDirectory()) continue;
        if (projEntry.name === 'sheets') continue; // skip if at wrong level
        const projectId = projEntry.name;
        const sheetsDir = path.join(tenantDir, projectId, 'sheets');
        if (!fs.existsSync(sheetsDir)) continue;

        for (const sheetFile of fs.readdirSync(sheetsDir)) {
          if (!sheetFile.endsWith('.json')) continue;
          const method = sheetFile.replace(/\.json$/, '');
          const data = readJsonSafe(path.join(sheetsDir, sheetFile));
          if (data === null) continue;
          insert.run(tenantId, projectId, method, JSON.stringify(data), now);
          count++;
        }
      }
    }

    // --- Legacy layout: data/projects/{projectId}_{method}.json
    for (const file of fs.readdirSync(projectsDir)) {
      if (!file.endsWith('.json')) continue;
      // Skip projects.json files
      if (file === 'projects.json') continue;
      const match = file.match(/^(.+?)_(.+)\.json$/);
      if (!match) continue;
      const [, projectId, method] = match;
      const data = readJsonSafe(path.join(projectsDir, file));
      if (data === null) continue;
      // Legacy files don't have tenantId; use empty string as placeholder
      insert.run('', projectId, method, JSON.stringify(data), now);
      count++;
    }
  });
  tx();
  console.log(`[sheets] Migrated ${count} sheets.`);
}

/* ------------------------------------------------------------------ */
/*  6. Snapshots                                                      */
/* ------------------------------------------------------------------ */

function migrateSnapshots() {
  const snapshotsDir = path.join(DATA_DIR, 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    console.log('[snapshots] data/snapshots/ not found, skipping.');
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO snapshots (snapshot_id, project_id, project_name, created_at, extracted_metrics)
     VALUES (?, ?, ?, ?, ?)`
  );

  let count = 0;
  const tx = db.transaction(() => {
    for (const file of fs.readdirSync(snapshotsDir)) {
      if (!file.endsWith('.json')) continue;
      const snap = readJsonSafe<any>(path.join(snapshotsDir, file));
      if (!snap) continue;
      insert.run(
        snap.snapshotId,
        snap.projectId,
        snap.projectName ?? '',
        snap.createdAt ?? new Date().toISOString(),
        jsonStr(snap.extractedMetrics),
      );
      count++;
    }
  });
  tx();
  console.log(`[snapshots] Migrated ${count} snapshots.`);
}

/* ------------------------------------------------------------------ */
/*  7. Audit logs                                                     */
/* ------------------------------------------------------------------ */

function migrateAuditLogs() {
  const file = path.join(DATA_DIR, 'audit', 'audit.log');
  if (!fs.existsSync(file)) {
    console.log('[audit] audit.log not found, skipping.');
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO audit_logs
     (timestamp, action, user_id, username, tenant_id, ip, detail, target_id, target_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);
  let count = 0;

  const tx = db.transaction(() => {
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        insert.run(
          entry.timestamp ?? '',
          entry.action ?? '',
          entry.userId ?? '',
          entry.username ?? '',
          entry.tenantId ?? '',
          entry.ip ?? null,
          entry.details ?? entry.detail ?? null,
          entry.targetId ?? null,
          entry.targetType ?? null,
        );
        count++;
      } catch {
        // skip malformed lines
      }
    }
  });
  tx();
  console.log(`[audit] Migrated ${count} audit log entries.`);
}

/* ------------------------------------------------------------------ */
/*  8. Word templates                                                 */
/* ------------------------------------------------------------------ */

function migrateWordTemplates() {
  const file = path.join(DATA_DIR, 'templates', 'word-templates.json');
  const templates = readJsonSafe<any[]>(file);
  if (!templates) {
    console.log('[templates] word-templates.json not found, skipping.');
    return;
  }

  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO word_templates
     (id, name, original_name, size, placeholders, uploaded_by, uploaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const t of templates) {
      insert.run(
        t.id,
        t.name,
        t.fileName ?? t.originalName ?? t.name,
        t.fileSizeBytes ?? t.size ?? 0,
        jsonArr(t.placeholders),
        t.uploadedBy ?? '',
        t.uploadedAt ?? t.updatedAt ?? new Date().toISOString(),
      );
    }
  });
  tx();
  console.log(`[templates] Migrated ${templates.length} word templates.`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

function main() {
  console.log('=== SmartVal JSON -> SQLite migration ===\n');

  console.log('[init] Creating schema...');
  initSchema();
  console.log('[init] Schema ready.\n');

  migrateTenants();
  migrateUsers();
  migrateSessions();
  migrateProjects();
  migrateSheets();
  migrateSnapshots();
  migrateAuditLogs();
  migrateWordTemplates();

  console.log('\n=== Migration complete ===');
}

main();
