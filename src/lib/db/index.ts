/**
 * SQLite 单例连接
 *
 * WAL 模式 + 外键约束 + busy_timeout=5000
 * 数据库文件：data/smartval.db
 *
 * Schema 在首次连接时自动初始化。
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'smartval.db');

let _db: Database.Database | null = null;
let _schemaReady = false;

export function getDb(): Database.Database {
    if (_db) {
        if (!_schemaReady) {
            _schemaReady = true;
            const { initSchema } = require('./schema');
            initSchema();
        }
        return _db;
    }

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('busy_timeout = 5000');

    _schemaReady = true;
    const { initSchema } = require('./schema');
    initSchema();

    return _db;
}
