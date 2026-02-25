'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { WORKSPACE_TABS } from '@/lib/workspace-tabs';
import { LayoutDashboard } from 'lucide-react';

export function ProjectWorkspaceTabBar({ projectId }: { projectId: string }) {
    const pathname = usePathname();
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === projectId));
    const methods = project?.valuationMethods ?? [];

    const visibleTabs = WORKSPACE_TABS.filter(
        (tab) => tab.methodKey === null || methods.includes(tab.methodKey),
    );

    const basePath = `/projects/${projectId}`;

    // Determine active tab from pathname
    const activeSlug = visibleTabs.find((tab) => {
        const tabPath = `${basePath}/${tab.routeSlug}`;
        return pathname === tabPath || pathname.startsWith(tabPath + '/');
    })?.routeSlug;

    // Check if we're on the project dashboard (exact match)
    const isDashboard = pathname === basePath || pathname === basePath + '/';

    return (
        <div className="shrink-0 border-t bg-white dark:bg-slate-950 flex items-center h-10 px-1 overflow-x-auto scrollbar-none">
            {/* Dashboard entry */}
            <Link
                href={basePath}
                className={`
                    inline-flex items-center gap-1.5 px-3 h-8 text-xs font-medium rounded-md whitespace-nowrap transition-colors shrink-0
                    ${isDashboard
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                    }
                `}
            >
                <LayoutDashboard className="h-3.5 w-3.5" />
                概览
            </Link>

            {/* Separator */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

            {/* Method tabs */}
            {visibleTabs.map((tab) => {
                const isActive = activeSlug === tab.routeSlug;
                return (
                    <Link
                        key={tab.routeSlug}
                        href={`${basePath}/${tab.routeSlug}`}
                        title={tab.label}
                        className={`
                            inline-flex items-center px-3 h-8 text-xs font-medium rounded-md whitespace-nowrap transition-colors shrink-0
                            ${isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                            }
                        `}
                    >
                        {tab.shortLabel}
                    </Link>
                );
            })}
        </div>
    );
}
