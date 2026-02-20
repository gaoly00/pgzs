'use client';

import { useEffect, useState } from 'react';
import { useSmartValStore } from '@/store';

/**
 * 认证水合组件 — 在 dashboard 加载时获取当前用户并同步到 store
 */
export function AuthHydration({ children }: { children: React.ReactNode }) {
    const [ready, setReady] = useState(false);
    const setCurrentUser = useSmartValStore((s) => s.setCurrentUser);

    useEffect(() => {
        // 先水合 zustand persist store
        useSmartValStore.persist.rehydrate();

        // 然后获取当前用户
        fetch('/api/auth/me')
            .then((res) => {
                if (res.ok) return res.json();
                // 未登录 — middleware 会处理重定向
                return null;
            })
            .then((data) => {
                if (data?.userId) {
                    setCurrentUser(data.userId);
                }
            })
            .catch(() => {
                // 忽略错误
            })
            .finally(() => {
                setReady(true);
            });
    }, [setCurrentUser]);

    if (!ready) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
                    <p className="text-sm text-muted-foreground">加载中...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
