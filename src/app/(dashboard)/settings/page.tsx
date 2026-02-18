'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Construction } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground text-sm">系统设置</p>
            </div>

            <Card className="border-dashed">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <Construction className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Coming Soon</CardTitle>
                            <CardDescription>设置功能正在开发中，敬请期待</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        未来此页面将包含：用户偏好设置、模板管理、数据导出配置等功能。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
