/**
 * 速率限制器 — SQLite 持久化
 *
 * 滑动窗口算法 + 登录失败锁定，数据持久化到 SQLite。
 * 重启后状态保持，支持多进程。
 */

import { getDb } from '@/lib/db/index';

// ============================================================
// 速率限制（滑动窗口）
// ============================================================

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number,
): RateLimitResult {
    const db = getDb();
    const now = Date.now();
    const windowStart = now - windowMs;

    // 读取现有记录
    const row = db.prepare('SELECT timestamps FROM rate_limits WHERE key = ?').get(key) as any;
    let timestamps: number[] = [];
    if (row) {
        try { timestamps = JSON.parse(row.timestamps); } catch { timestamps = []; }
    }

    // 清除窗口外的旧记录
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= maxRequests) {
        const oldest = timestamps[0];
        const retryAfterMs = windowMs - (now - oldest);
        // 写回清理后的时间戳
        db.prepare(
            `INSERT INTO rate_limits (key, timestamps, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET timestamps = excluded.timestamps, updated_at = excluded.updated_at`
        ).run(key, JSON.stringify(timestamps), new Date().toISOString());
        return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
    }

    timestamps.push(now);

    // 写回
    db.prepare(
        `INSERT INTO rate_limits (key, timestamps, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET timestamps = excluded.timestamps, updated_at = excluded.updated_at`
    ).run(key, JSON.stringify(timestamps), new Date().toISOString());

    // 顺带清理过期的其他 key（每次写入时）
    db.prepare('DELETE FROM rate_limits WHERE updated_at < ?').run(
        new Date(Date.now() - windowMs * 2).toISOString()
    );

    return {
        allowed: true,
        remaining: maxRequests - timestamps.length,
        retryAfterMs: 0,
    };
}

// ============================================================
// 登录失败锁定
// ============================================================

const MAX_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分钟

export interface LockoutResult {
    locked: boolean;
    remainingMs: number;
    failureCount: number;
}

export function checkLockout(key: string): LockoutResult {
    const db = getDb();
    const row = db.prepare('SELECT * FROM login_failures WHERE key = ?').get(key) as any;
    if (!row) {
        return { locked: false, remainingMs: 0, failureCount: 0 };
    }

    const now = Date.now();
    if (row.locked_until) {
        const lockedUntil = new Date(row.locked_until).getTime();
        if (lockedUntil > now) {
            return { locked: true, remainingMs: lockedUntil - now, failureCount: row.count };
        }
        // 锁定已过期，清除
        db.prepare('DELETE FROM login_failures WHERE key = ?').run(key);
        return { locked: false, remainingMs: 0, failureCount: 0 };
    }

    return { locked: false, remainingMs: 0, failureCount: row.count };
}

export function recordFailure(key: string): LockoutResult {
    const db = getDb();
    const now = new Date().toISOString();

    // UPSERT: 增加计数
    db.prepare(
        `INSERT INTO login_failures (key, count, last_failure) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = count + 1, last_failure = excluded.last_failure`
    ).run(key, now);

    const row = db.prepare('SELECT * FROM login_failures WHERE key = ?').get(key) as any;
    const count = row.count;

    if (count >= MAX_FAILURES) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
        db.prepare('UPDATE login_failures SET locked_until = ? WHERE key = ?').run(lockedUntil, key);
        return { locked: true, remainingMs: LOCKOUT_DURATION_MS, failureCount: count };
    }

    return { locked: false, remainingMs: 0, failureCount: count };
}

export function resetFailures(key: string): void {
    const db = getDb();
    db.prepare('DELETE FROM login_failures WHERE key = ?').run(key);
}
