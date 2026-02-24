/**
 * 统一 API 客户端
 *
 * 自动处理 JSON 序列化/反序列化、401 跳转、统一错误格式。
 */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
    try {
        const res = await fetch(url, init);

        if (res.status === 401) {
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            return { ok: false, error: '未登录' };
        }

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body.error || `请求失败 (${res.status})` };
        }

        const data = await res.json();
        return { ok: true, data: data as T };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : '网络错误' };
    }
}

export function apiGet<T>(url: string): Promise<ApiResult<T>> {
    return request<T>(url);
}

export function apiPost<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

export function apiPatch<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
}

export function apiDelete<T>(url: string): Promise<ApiResult<T>> {
    return request<T>(url, { method: 'DELETE' });
}

export function apiPostForm<T>(url: string, formData: FormData): Promise<ApiResult<T>> {
    return request<T>(url, { method: 'POST', body: formData });
}
