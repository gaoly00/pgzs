'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, LogIn, Building2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

    // 客户端验证
    function validate(): boolean {
        const e: typeof errors = {};
        if (!username || username.trim().length < 6) e.username = '用户名至少 6 个字符';
        else if (!/^[A-Za-z0-9]{6,}$/.test(username.trim())) e.username = '仅允许字母和数字';
        if (!password || password.length < 6) e.password = '密码至少 6 个字符';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error('登录失败', { description: data.error });
                return;
            }

            toast.success('登录成功', { description: `欢迎回来, ${data.username}` });
            router.push('/projects');
            router.refresh();
        } catch {
            toast.error('网络错误', { description: '请检查网络连接' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/20 mb-4">
                        <Building2 className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">SmartVal</h1>
                    <p className="text-sm text-muted-foreground mt-1">智能房地产估价平台</p>
                </div>

                {/* 表单卡片 */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                    <h2 className="text-lg font-semibold mb-6">登录账户</h2>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="username">用户名</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: undefined })); }}
                                placeholder="letters + numbers, min 6"
                                autoComplete="username"
                                autoFocus
                            />
                            {errors.username && <p className="text-xs text-red-500">{errors.username}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">密码</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                                placeholder="min 6 characters"
                                autoComplete="current-password"
                            />
                            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                        </div>
                        <Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                            登录
                        </Button>
                    </form>
                    <div className="mt-6 flex flex-col items-center space-y-3">
                        <p className="text-center text-sm text-muted-foreground">
                            还没有账户？{' '}
                            <Link href="/register" className="text-blue-600 hover:underline font-medium">
                                注册
                            </Link>
                        </p>
                        <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4">
                            忘记密码？联系管理员
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
