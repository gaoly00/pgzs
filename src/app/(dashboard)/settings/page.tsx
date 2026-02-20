'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Construction, ShieldCheck, UserCog, ArrowRight, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SettingsPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ username: string } | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => {
                if (res.status === 401) {
                    router.push('/login');
                    throw new Error('Not logged in');
                }
                return res.json();
            })
            .then(data => setUser(data))
            .catch((err) => {
                console.error(err);
            });
    }, [router]);

    async function handleLogout() {
        try {
            const res = await fetch('/api/auth/logout', { method: 'POST' });
            if (res.ok) {
                toast.success('已安全退出');
                router.push('/login');
                router.refresh(); // 清除可能的客户端状态缓存
            } else {
                toast.error('退出失败');
            }
        } catch (error) {
            toast.error('网络错误，请重试');
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground text-sm">系统设置与管理</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* 账户信息 */}
                <Card className="md:col-span-2 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-2.5 rounded-full">
                                <User className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">账号状态</CardTitle>
                                <CardDescription>查看当前登录账号，或退出系统</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">
                                当前登录用户: <span className="font-bold text-foreground text-base ml-1">{user?.username || '加载中...'}</span>
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                            <LogOut className="h-4 w-4 mr-2" />
                            退出登录
                        </Button>
                    </CardContent>
                </Card>

                {/* 密码安全 */}
                <Link href="/settings/security">
                    <Card className="hover:border-blue-500 hover:shadow-md transition-all cursor-pointer h-full group border-slate-200 dark:border-slate-800">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                                        <ShieldCheck className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">安全设置</CardTitle>
                                        <CardDescription>修改登录密码</CardDescription>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                定期修改密码可以保护你的账号安全。如果怀疑密码泄露，请立即修改。
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* 管理员工具 */}
                <Link href="/admin/users">
                    <Card className="hover:border-red-500 hover:shadow-md transition-all cursor-pointer h-full group border-slate-200 dark:border-slate-800">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                                        <UserCog className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg group-hover:text-red-600 transition-colors">管理员工具</CardTitle>
                                        <CardDescription>重置用户密码</CardDescription>
                                    </div>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                仅限拥有管理员密钥的人员使用，可以强制重置遗忘密码的账号。
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                {/* Coming Soon */}
                <Card className="border-dashed border-slate-300 dark:border-slate-700 md:col-span-2">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                <Construction className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">更多设置 (Coming Soon)</CardTitle>
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
        </div>
    );
}
