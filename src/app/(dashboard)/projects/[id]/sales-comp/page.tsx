'use client';

import { use } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ValuationSheet = dynamic(
    () => import('@/components/excel/ValuationSheet').then((m) => m.ValuationSheet),
    { ssr: false }
);

export default function SalesCompPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="text-sm text-muted-foreground mb-4">Project not found</div>
                <Link href="/projects">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                </Link>
            </div>
        );
    }

    // ✅ 关键：w-full max-w-full min-w-0 overflow-hidden，彻底禁止页面横向溢出
    return (
        <div className="flex flex-col h-[calc(100vh-64px)] w-full max-w-full min-w-0 overflow-hidden">
            {/* Sheet Container — maximized, all overflow contained */}
            <div className="flex-1 min-h-0 w-full overflow-hidden bg-background relative isolate">
                <ValuationSheet />
            </div>
        </div>
    );
}
