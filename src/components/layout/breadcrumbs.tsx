'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { useSmartValStore } from '@/store';

export function Breadcrumbs() {
    const pathname = usePathname();
    const projects = useSmartValStore((s) => s.projects);

    const segments = pathname.split('/').filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    let accumulatedPath = '';
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        accumulatedPath += `/${seg}`;

        // Try to resolve dynamic segments
        if (seg === 'projects') {
            crumbs.push({ label: 'Projects', href: '/projects' });
        } else if (seg === 'new') {
            crumbs.push({ label: 'New Project', href: accumulatedPath });
        } else if (seg === 'sales-comp') {
            crumbs.push({ label: 'Sales Comparison', href: accumulatedPath });
        } else if (seg === 'cost') {
            crumbs.push({ label: 'Cost Approach', href: accumulatedPath });
        } else if (seg === 'income') {
            crumbs.push({ label: 'Income Approach', href: accumulatedPath });
        } else if (seg === 'dev' || seg === 'hypothetical-dev') {
            crumbs.push({ label: 'Hypothetical Development', href: accumulatedPath });
        } else if (seg === 'conclusion') {
            crumbs.push({ label: 'Conclusion', href: accumulatedPath });
        } else if (seg === 'report') {
            crumbs.push({ label: 'Report', href: accumulatedPath });
        } else if (seg === 'settings') {
            crumbs.push({ label: 'Settings', href: '/settings' });
        } else {
            // Assume it's a project ID — try to look up the name
            const project = projects.find((p) => p.id === seg);

            // If project found, use name. If not found, use the segment itself (capitalized) as fallback
            // This prevents "Project" from showing up for unknown routes (like 'income' was before fix)
            const fallbackLabel = seg.charAt(0).toUpperCase() + seg.slice(1);

            crumbs.push({
                label: project ? project.name : fallbackLabel,
                href: accumulatedPath,
            });
        }
    }

    return (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link
                href="/projects"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
                <Home className="h-3.5 w-3.5" />
            </Link>
            {crumbs.map((crumb, i) => (
                <span key={crumb.href} className="flex items-center gap-1.5">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    {i === crumbs.length - 1 ? (
                        <span className="font-medium text-foreground">{crumb.label}</span>
                    ) : (
                        <Link href={crumb.href} className="hover:text-foreground transition-colors">
                            {crumb.label}
                        </Link>
                    )}
                </span>
            ))}
        </nav>
    );
}
