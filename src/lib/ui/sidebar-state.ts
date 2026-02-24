/**
 * 侧边栏折叠状态持久化
 * 使用 localStorage 存储，SSR 安全
 */

const STORAGE_KEY = 'smartval-sidebar-collapsed';

/** 从 localStorage 读取折叠状态（默认展开） */
export function getSidebarCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

/** 将折叠状态写入 localStorage */
export function setSidebarCollapsed(value: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
        // localStorage 不可用时静默失败
    }
}
