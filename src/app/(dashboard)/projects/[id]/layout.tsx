'use client';

import { use } from 'react';
import { ProjectWorkspaceTabBar } from '@/components/workspace/project-workspace-tab-bar';

export default function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);

    return (
        <div className="flex flex-col h-[calc(100dvh-56px)] -m-4 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden">
                {children}
            </div>
            <ProjectWorkspaceTabBar projectId={id} />
        </div>
    );
}
