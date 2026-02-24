/**
 * 内存级速率限制器
 *
 * 基于滑动窗口算法，按 key（通常是 IP）限制请求频率。
 * 注意：单进程有效，多实例部署需替换为 Redis 方案。
 */

interface RateWindow {
    timestamps: number[];
}

const store = new Map<string, RateWindow>();

// 定期清理过期条目，防止内存泄漏
const CLEANUP_INTERVAL = 60_000; // 1 分钟
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, window] of store) {
            window.timestamps = window.timestamps.filter((t) => now - t < windowMs);
            if (window.timestamps.length === 0) {
                store.delete(key);
            }
        }
    }, CLEANUP_INTERVAL);
    // 不阻止进程退出
    if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
        cleanupTimer.unref();
    }
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

/**
 * 检查是否允许请求
 * @param key - 限流键（如 IP 地址）
 * @param maxRequests - 窗口内最大请求数
 * @param windowMs - 窗口时间（毫秒）
 */
export function checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number,
): RateLimitResult {
    ensureCleanup(windowMs);

    const now = Date.now();
    let window = store.get(key);

    if (!window) {
        window = { timestamps: [] };
        store.set(key, window);
    }

    // 清除窗口外的旧记录
    window.timestamps = window.timestamps.filter((t) => now - t < windowMs);

    if (window.timestamps.length >= maxRequests) {
        const oldest = window.timestamps[0];
        const retryAfterMs = windowMs - (now - oldest);
        return {
            allowed: false,
            remaining: 0,
            retryAfterMs: Math.max(retryAfterMs, 0),
        };
    }

    window.timestamps.push(now);
    return {
        allowed: true,
        remaining: maxRequests - window.timestamps.length,
        retryAfterMs: 0,
    };
}

/**
 * 登录失败锁定器
 *
 * 连续失败 N 次后锁定一段时间。
 * 成功登录后重置计数。
 */

interface FailureRecord {
    count: number;
    lastFailure: number;
    lockedUntil: number;
}

const failureStore = new Map<string, FailureRecord>();

const MAX_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 分钟

export interface LockoutResult {
    locked: boolean;
    remainingMs: number;
    failureCount: number;
}

/** 检查账户是否被锁定 */
export function checkLockout(key: string): LockoutResult {
    const record = failureStore.get(key);
    if (!record) {
        return { locked: false, remainingMs: 0, failureCount: 0 };
    }

    const now = Date.now();
    if (record.lockedUntil > now) {
        return {
            locked: true,
            remainingMs: record.lockedUntil - now,
            failureCount: record.count,
        };
    }

    // 锁定已过期，重置
    if (record.lockedUntil > 0 && record.lockedUntil <= now) {
        failureStore.delete(key);
        return { locked: false, remainingMs: 0, failureCount: 0 };
    }

    return { locked: false, remainingMs: 0, failureCount: record.count };
}

/** 记录一次登录失败 */
export function recordFailure(key: string): LockoutResult {
    const now = Date.now();
    let record = failureStore.get(key);

    if (!record) {
        record = { count: 0, lastFailure: 0, lockedUntil: 0 };
        failureStore.set(key, record);
    }

    record.count += 1;
    record.lastFailure = now;

    if (record.count >= MAX_FAILURES) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
    }

    return {
        locked: record.lockedUntil > now,
        remainingMs: record.lockedUntil > now ? record.lockedUntil - now : 0,
        failureCount: record.count,
    };
}

/** 登录成功后重置失败计数 */
export function resetFailures(key: string): void {
    failureStore.delete(key);
}
