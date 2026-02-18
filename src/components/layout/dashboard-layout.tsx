'use client';

import { Sidebar } from './sidebar';
import { Breadcrumbs } from './breadcrumbs';
import { useHydration } from '@/hooks/use-hydration';
import { Loader2 } from 'lucide-react';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const hydrated = useHydration();

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
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="ml-44 flex-1 min-w-0">
                {/* Header */}
                <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-6">
                    <Breadcrumbs />
                </header>
                {/* Main Content */}
                <main className="p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
