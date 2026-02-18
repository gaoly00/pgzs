'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
    { href: '/projects', label: 'Projects', icon: Building2 },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-44 flex-col border-r border-border bg-card">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        SmartVal
                    </h1>
                    <p className="text-[10px] text-muted-foreground -mt-1">房地产估价 SaaS</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                                isActive
                                    ? 'bg-gradient-to-r from-blue-600/10 to-indigo-600/10 text-blue-700 shadow-sm'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            )}
                        >
                            <item.icon className={cn('h-4 w-4', isActive && 'text-blue-600')} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="border-t border-border p-4">
                <p className="text-xs text-muted-foreground text-center">
                    SmartVal MVP v0.1
                </p>
            </div>
        </aside>
    );
}
