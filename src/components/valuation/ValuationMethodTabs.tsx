'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
    { key: 'sales_comp', label: 'Sales Comparison', path: 'sales-comp' },
    { key: 'income', label: 'Income Approach', path: 'income' },
    { key: 'cost', label: 'Cost Approach', path: 'cost' },
    { key: 'dev', label: 'Hypothetical Dev', path: 'dev' },
];

export default function ValuationMethodTabs({ projectId }: { projectId: string }) {
    const pathname = usePathname();

    return (
        <div className="flex items-center space-x-1 bg-gray-100 p-1 border-b shrink-0">
            {TABS.map((tab) => {
                const href = `/projects/${projectId}/${tab.path}`;
                const isActive = pathname.includes(`/${tab.path}`);

                return (
                    <Link
                        key={tab.key}
                        href={href}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2",
                            isActive
                                ? "bg-white text-blue-600 border-blue-600 border-b-2"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200 border-transparent"
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
