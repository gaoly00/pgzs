'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { AuthHydration } from '@/components/auth/auth-hydration';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthHydration>
            <DashboardLayout>{children}</DashboardLayout>
        </AuthHydration>
    );
}
