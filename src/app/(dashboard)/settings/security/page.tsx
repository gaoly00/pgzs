'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ShieldCheck, Lock, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordPage() {
    const router = useRouter();
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [errors, setErrors] = useState<{ old?: string; new?: string; confirm?: string }>({});

    function validate(): boolean {
        const e: typeof errors = {};
        if (!oldPassword) e.old = '请输入当前密码';
        if (!newPassword || newPassword.length < 6) e.new = '新密码至少 6 个字符';
        if (newPassword && oldPassword && newPassword === oldPassword) e.new = '新密码不能与当前密码相同';
        if (newPassword !== confirmPassword) e.confirm = '两次输入的密码不一致';
        setErrors(e);
        return Object.keys(e).length === 0;
    }

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        if (!validate()) return;

        setLoading(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, newPassword }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error('修改失败', { description: data.error });
                return;
            }

            toast.success('密码修改成功', { description: '下次登录请使用新密码。' });
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            toast.error('网络错误', { description: '请检查网络连接' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
            {/* 顶部导航 */}
            <div className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/projects">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-base font-bold">安全设置</h1>
                        <p className="text-xs text-muted-foreground">修改登录密码</p>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-6 mt-8">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {/* 头部装饰 */}
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
                                <ShieldCheck className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">修改密码</h2>
                                <p className="text-xs text-muted-foreground">修改后需使用新密码登录</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* 当前密码 */}
                            <div className="space-y-2">
                                <Label htmlFor="oldPassword">当前密码</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="oldPassword"
                                        type={showOld ? 'text' : 'password'}
                                        value={oldPassword}
                                        onChange={(e) => { setOldPassword(e.target.value); setErrors((p) => ({ ...p, old: undefined })); }}
                                        placeholder="输入当前密码"
                                        className="pl-10 pr-10"
                                        autoComplete="current-password"
                                    />
                                    <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.old && <p className="text-xs text-red-500">{errors.old}</p>}
                            </div>

                            <hr className="border-dashed" />

                            {/* 新密码 */}
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">新密码</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="newPassword"
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, new: undefined })); }}
                                        placeholder="至少 6 个字符"
                                        className="pl-10 pr-10"
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {errors.new && <p className="text-xs text-red-500">{errors.new}</p>}
                                {newPassword && newPassword.length >= 6 && !errors.new && (
                                    <p className="text-xs text-emerald-600">✓ 密码长度符合要求</p>
                                )}
                            </div>

                            {/* 确认新密码 */}
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">确认新密码</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
                                        placeholder="再次输入新密码"
                                        className="pl-10"
                                        autoComplete="new-password"
                                    />
                                </div>
                                {errors.confirm && <p className="text-xs text-red-500">{errors.confirm}</p>}
                                {confirmPassword && confirmPassword === newPassword && newPassword.length >= 6 && (
                                    <p className="text-xs text-emerald-600">✓ 两次密码一致</p>
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                                确认修改
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
