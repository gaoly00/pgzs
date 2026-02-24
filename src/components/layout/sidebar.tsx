'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Building2, PanelLeftClose, PanelLeft, Menu, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { useCurrentUser, type UserRole } from '@/components/auth/require-role';

// 导航项配置（新增可见角色）
interface NavItem {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    /** 哪些角色可以看到此导航项，undefined = 所有角色可见 */
    visibleRoles?: UserRole[];
}

const navItems: NavItem[] = [
    { href: '/projects', label: 'Projects', icon: Building2 },
    { href: '/admin', label: 'System Admin', icon: Shield, visibleRoles: ['admin', 'manager', 'reviewer'] },
    { href: '/settings', label: 'Settings', icon: Settings },
];

// ============================================================
// 侧边栏内容（桌面/移动端共用）
// ============================================================
function SidebarContent({
    collapsed,
    onNavClick,
}: {
    collapsed: boolean;
    onNavClick?: () => void;
}) {
    const pathname = usePathname();
    const { user } = useCurrentUser();
    const userRole = (user?.role || 'valuer') as UserRole;

    // 根据角色过滤可见导航项
    const visibleItems = navItems.filter((item) => {
        if (!item.visibleRoles) return true;
        return item.visibleRoles.includes(userRole);
    });

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className={cn(
                'flex h-14 items-center border-b border-border shrink-0',
                collapsed ? 'justify-center px-2' : 'gap-2.5 px-4',
            )}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shrink-0">
                    <LayoutDashboard className="h-4 w-4" />
                </div>
                {!collapsed && (
                    <div className="min-w-0">
                        <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                            SmartVal
                        </h1>
                        <p className="text-[10px] text-muted-foreground -mt-0.5 truncate">房地产估价 SaaS</p>
                    </div>
                )}
            </div>

            {/* 导航链接 */}
            <nav className={cn('flex-1 space-y-1 py-3', collapsed ? 'px-1.5' : 'px-3')}>
                {visibleItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onNavClick}
                            title={collapsed ? item.label : undefined}
                            className={cn(
                                'flex items-center rounded-lg text-sm font-medium transition-all duration-200',
                                collapsed
                                    ? 'justify-center h-9 w-full'
                                    : 'gap-3 px-3 py-2.5',
                                isActive
                                    ? 'bg-gradient-to-r from-blue-600/10 to-indigo-600/10 text-blue-700 shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-blue-600')} />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* 底部版本号 */}
            <div className="border-t border-border p-3 shrink-0">
                <p className={cn(
                    'text-xs text-muted-foreground',
                    collapsed ? 'text-center' : 'text-center',
                )}>
                    {collapsed ? 'v0.1' : 'SmartVal MVP v0.1'}
                </p>
            </div>
        </div>
    );
}

// ============================================================
// 桌面端侧边栏（固定定位，支持折叠）
// ============================================================
export function DesktopSidebar({
    collapsed,
    onToggle,
}: {
    collapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <aside
            className={cn(
                'hidden md:flex fixed left-0 top-0 z-40 h-screen flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
                collapsed ? 'w-14' : 'w-44',
            )}
        >
            {/* 折叠按钮（右上角） */}
            <button
                type="button"
                onClick={onToggle}
                title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
                className="absolute -right-3 top-[18px] z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors"
            >
                {collapsed
                    ? <PanelLeft className="h-3 w-3 text-muted-foreground" />
                    : <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
                }
            </button>

            <SidebarContent collapsed={collapsed} />
        </aside>
    );
}

// ============================================================
// 移动端侧边栏（Sheet Drawer）
// ============================================================
export function MobileSidebar({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="w-56 p-0">
                {/* 隐藏标题以满足无障碍要求 */}
                <VisuallyHidden.Root>
                    <SheetTitle>导航菜单</SheetTitle>
                </VisuallyHidden.Root>
                <SidebarContent collapsed={false} onNavClick={() => onOpenChange(false)} />
            </SheetContent>
        </Sheet>
    );
}

// ============================================================
// 移动端汉堡菜单按钮（用于 Header）
// ============================================================
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors mr-2"
            title="打开菜单"
        >
            <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
    );
}
