'use client';

import { use, useRef } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    ArrowLeft,
    Building2,
    FileText,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Upload,
    File,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ReportPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));
    const generateReport = useSmartValStore((s) => s.generateReport);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadedFileName = useRef<string | null>(null);

    if (!project) {
        return (
            <div className="flex flex-col items-center justify-center py-24">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 mb-6">
                    <Building2 className="h-10 w-10 text-red-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
                <p className="text-muted-foreground mb-6">该项目不存在或已被删除</p>
                <Link href="/projects">
                    <Button>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Projects
                    </Button>
                </Link>
            </div>
        );
    }

    const handleGenerate = () => {
        generateReport(id);
        toast.success('Report Data Locked', {
            description: '报告数据已锁定，数据状态已标记为最新。',
        });
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadedFileName.current = file.name;
            toast.info('Template Uploaded', {
                description: `已选择模板文件：${file.name}`,
            });
            // Force re-render (simple approach via state update)
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/projects/${id}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Report</h1>
                    <p className="text-muted-foreground text-sm">
                        报告生成 — {project.name}
                    </p>
                </div>
            </div>

            {/* Status Alert */}
            {project.status.isDirty ? (
                <Alert variant="destructive" className="border-amber-200 bg-amber-50 text-amber-900">
                    <AlertTriangle className="h-4 w-4 !text-amber-600" />
                    <AlertTitle className="text-amber-900">Data Changed. Report Outdated.</AlertTitle>
                    <AlertDescription className="text-amber-700">
                        数据已发生变更，当前报告状态已过期。请重新生成报告以锁定最新数据。
                    </AlertDescription>
                </Alert>
            ) : (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 !text-emerald-600" />
                    <AlertTitle className="text-emerald-900">Report is Up-to-date.</AlertTitle>
                    <AlertDescription className="text-emerald-700">
                        报告数据已锁定，与当前项目数据保持一致。
                        {project.status.reportGeneratedAt && (
                            <span className="flex items-center gap-1 mt-1">
                                <Clock className="h-3.5 w-3.5" />
                                Last Generated: {new Date(project.status.reportGeneratedAt).toLocaleString('zh-CN')}
                            </span>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {/* Generate Report Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-5 w-5 text-orange-500" />
                        生成报告
                    </CardTitle>
                    <CardDescription>
                        点击生成以锁定当前数据状态，数据将标记为「最新」。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <Button
                            onClick={handleGenerate}
                            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg shadow-orange-500/25"
                            size="lg"
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Report
                        </Button>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge
                                variant="outline"
                                className={
                                    project.status.isDirty
                                        ? 'text-amber-600 border-amber-200 bg-amber-50'
                                        : 'text-emerald-600 border-emerald-200 bg-emerald-50'
                                }
                            >
                                {project.status.isDirty ? 'Dirty' : 'Clean'}
                            </Badge>
                            {project.status.reportGeneratedAt && (
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5" />
                                    {new Date(project.status.reportGeneratedAt).toLocaleString('zh-CN')}
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>


            {/* Template Upload (Optional UI) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Upload className="h-5 w-5 text-blue-500" />
                        报告模板（可选）
                    </CardTitle>
                    <CardDescription>
                        上传 .docx 模板文件（仅展示文件名，不做解析）
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Select Template
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".docx,.doc"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        {uploadedFileName.current && (
                            <span className="flex items-center gap-2 text-sm text-muted-foreground">
                                <File className="h-4 w-4" />
                                {uploadedFileName.current}
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
