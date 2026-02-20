'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, ShieldAlert, UserCog, Key, Copy, AlertTriangle } from 'lucide-react';

export default function AdminResetPasswordPage() {
    const [adminSecret, setAdminSecret] = useState('');
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [autoGenerate, setAutoGenerate] = useState(true);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string; tempPassword?: string; username?: string } | null>(null);

    async function handleReset(ev: React.FormEvent) {
        ev.preventDefault();
        setResult(null);

        // 验证
        if (!adminSecret.trim()) {
            toast.error('请输入管理员密钥');
            return;
        }
        if (!username.trim()) {
            toast.error('请输入目标用户名');
            return;
        }
        if (!autoGenerate && (!newPassword || newPassword.length < 6)) {
            toast.error('手动密码至少 6 个字符');
            return;
        }

        setLoading(true);
        try {
            const body: Record<string, string> = { username: username.trim() };
            if (!autoGenerate && newPassword) {
                body.newPassword = newPassword;
            }

            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': adminSecret.trim(),
                },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error('重置失败', { description: data.error });
                return;
            }

            setResult(data);
            toast.success('密码已重置', { description: data.message });
        } catch {
            toast.error('网络错误', { description: '请检查网络连接' });
        } finally {
            setLoading(false);
        }
    }

    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text).then(
            () => toast.success('已复制到剪贴板'),
            () => toast.error('复制失败'),
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-100 dark:from-slate-950 dark:via-red-950 dark:to-orange-950">
            {/* 顶部导航 */}
            <div className="border-b bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/login">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-base font-bold">Admin - Reset User Password</h1>
                        <p className="text-xs text-muted-foreground">管理员用户密码重置</p>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-6 mt-8">
                {/* 安全警告 */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 mb-6">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">仅限管理员使用</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                            此页面用于重置用户密码。操作记录将写入服务器日志。管理员密钥仅存于内存中，不会持久化。<br />
                            <strong>For development only. Replace with email reset later. (仅供开发阶段使用。未来需替换为电子邮件重置。)</strong>
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />

                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                                <UserCog className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">重置用户密码</h2>
                                <p className="text-xs text-muted-foreground">需要环境变量 ADMIN_RESET_SECRET</p>
                            </div>
                        </div>

                        <form onSubmit={handleReset} className="space-y-5">
                            {/* 管理员密钥 */}
                            <div className="space-y-2">
                                <Label htmlFor="adminSecret" className="flex items-center gap-1">
                                    <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                                    管理员密钥
                                </Label>
                                <Input
                                    id="adminSecret"
                                    type="password"
                                    value={adminSecret}
                                    onChange={(e) => setAdminSecret(e.target.value)}
                                    placeholder="输入 ADMIN_RESET_SECRET"
                                    autoComplete="off"
                                />
                            </div>

                            <hr className="border-dashed" />

                            {/* 目标用户名 */}
                            <div className="space-y-2">
                                <Label htmlFor="targetUsername">目标用户名</Label>
                                <Input
                                    id="targetUsername"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="要重置密码的用户名 (letters+numbers, min 6)"
                                    autoComplete="off"
                                />
                            </div>

                            {/* 密码模式 */}
                            <div className="space-y-3">
                                <Label>选项</Label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAutoGenerate(true)}
                                        className={`flex-1 p-3 rounded-lg border-2 text-sm text-center transition-all ${autoGenerate
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 font-semibold text-blue-700 dark:text-blue-300'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-muted-foreground'
                                            }`}
                                    >
                                        Option A: 生成临时密码
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAutoGenerate(false)}
                                        className={`flex-1 p-3 rounded-lg border-2 text-sm text-center transition-all ${!autoGenerate
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 font-semibold text-blue-700 dark:text-blue-300'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-muted-foreground'
                                            }`}
                                    >
                                        Option B: 手动指定密码
                                    </button>
                                </div>

                                {!autoGenerate && (
                                    <Input
                                        type="text"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="输入新密码（至少 6 位）"
                                        autoComplete="off"
                                    />
                                )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-md"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Key className="h-4 w-4 mr-2" />}
                                {autoGenerate ? "Generate Temporary Password & Reset" : "Reset to This Password"}
                            </Button>
                        </form>

                        {/* 结果展示 */}
                        {result?.ok && (
                            <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                                    ✓ 用户 <strong>{result.username}</strong> 的密码已重置！
                                </p>
                                {result.tempPassword ? (
                                    <>
                                        <div className="flex items-center gap-2 mt-2">
                                            <code className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border text-sm font-mono select-all">
                                                {result.tempPassword}
                                            </code>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyToClipboard(result.tempPassword!)}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                            请将此临时密码安全地告知用户，建议用户登录后立即修改。
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        密码已成功重置为手动指定的新密码。
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

