'use client';

import { useState, useEffect } from 'react';
import { DesktopSidebar, MobileSidebar, MobileMenuButton } from './sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { useHydration } from '@/hooks/use-hydration';
import { Loader2 } from 'lucide-react';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/ui/sidebar-state';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const hydrated = useHydration();

    // 桌面端折叠状态（从 localStorage 恢复）
    const [collapsed, setCollapsed] = useState(false);
    // 移动端抽屉开关
    const [mobileOpen, setMobileOpen] = useState(false);

    // 水合后从 localStorage 读取折叠状态
    useEffect(() => {
        setCollapsed(getSidebarCollapsed());
    }, []);

    // 切换折叠状态并持久化
    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            setSidebarCollapsed(next);
            return next;
        });
    };

    if (!hydrated) {
        return (
            <div className="flex h-screen w-screen items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-muted-foreground">Loading SmartVal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden">
            {/* 桌面端侧边栏 */}
            <DesktopSidebar collapsed={collapsed} onToggle={toggleCollapsed} />

            {/* 移动端抽屉 */}
            <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

            {/* 主内容区域 —— 使用 margin-left 避让固定侧边栏 */}
            <div
                className={`
                    flex-1 min-w-0 flex flex-col overflow-hidden
                    transition-[margin-left] duration-200 ease-in-out
                    ${collapsed ? 'md:ml-14' : 'md:ml-44'}
                    ml-0
                `}
            >
                {/* 顶部栏 */}
                <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-4 md:px-6 shrink-0">
                    {/* 移动端：汉堡菜单按钮 */}
                    <MobileMenuButton onClick={() => setMobileOpen(true)} />
                    {/* 面包屑 */}
                    <Breadcrumbs />
                </header>

                {/* 页面内容 */}
                <main className="flex-1 min-w-0 overflow-auto">
                    <div className="p-4">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
