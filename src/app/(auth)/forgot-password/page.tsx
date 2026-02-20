import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4">
            <div className="w-full max-w-md">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-6 mx-auto">
                        <KeyRound className="h-8 w-8 text-slate-600 dark:text-slate-400" />
                    </div>

                    <h1 className="text-2xl font-bold tracking-tight mb-2">忘记密码</h1>

                    <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
                        在当前开发阶段，系统暂未支持通过电子邮件自动找回密码。
                        <br /><br />
                        如果您忘记了登录密码，请<strong>联系系统管理员</strong>，他们可以使用管理员专用工具为您重设密码或生成临时密码。
                    </p>

                    <Link href="/login" className="block">
                        <Button className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            返回登录页面
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
