'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    ArrowLeft,
    BarChart3,
    Calculator,
    CheckCircle2,
    FileText,
    Building2,
    Calendar,
    MapPin,
    Ruler,
    Settings2,
    TrendingUp,
    Landmark,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { VALUATION_METHODS, type ValuationMethodKey } from '@/types';

// ---- Module card definitions ----
// methodKey maps to ValuationMethodKey; null = always visible (conclusion / report)
const moduleCards: {
    key: string;
    methodKey: ValuationMethodKey | null;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    shadow: string;
}[] = [
        {
            key: 'sales-comp',
            methodKey: 'sales-comp',
            label: 'Sales Comparison',
            description: '比较法 — 通过可比案例估算价值',
            icon: BarChart3,
            gradient: 'from-blue-500 to-cyan-500',
            shadow: 'shadow-blue-500/20',
        },
        {
            key: 'cost',
            methodKey: 'cost-approach',
            label: 'Cost Approach',
            description: '成本法 — 基于重建成本估算价值',
            icon: Calculator,
            gradient: 'from-emerald-500 to-teal-500',
            shadow: 'shadow-emerald-500/20',
        },
        {
            key: 'income',
            methodKey: 'income-approach',
            label: 'Income Approach',
            description: '收益法 — 基于收益能力估算价值',
            icon: TrendingUp,
            gradient: 'from-amber-500 to-yellow-500',
            shadow: 'shadow-amber-500/20',
        },
        {
            key: 'hypothetical-dev',
            methodKey: 'hypothetical-dev',
            label: 'Hypothetical Development',
            description: '假设开发法 — 基于开发潜力估算价值',
            icon: Landmark,
            gradient: 'from-pink-500 to-rose-500',
            shadow: 'shadow-pink-500/20',
        },
        {
            key: 'conclusion',
            methodKey: null,
            label: 'Conclusion',
            description: '估价结论 — 综合确定最终价值',
            icon: CheckCircle2,
            gradient: 'from-violet-500 to-purple-500',
            shadow: 'shadow-violet-500/20',
        },
        {
            key: 'report',
            methodKey: null,
            label: 'Report',
            description: '报告生成 — 锁定数据并生成报告',
            icon: FileText,
            gradient: 'from-orange-500 to-red-500',
            shadow: 'shadow-orange-500/20',
        },
    ];

export default function ProjectDashboardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));
    const updateValuationMethods = useSmartValStore((s) => s.updateValuationMethods);

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

    // Ensure backward compat: old projects without the field default to ['sales-comp']
    const enabledMethods: ValuationMethodKey[] = project.valuationMethods ?? ['sales-comp'];

    const toggleMethod = (key: ValuationMethodKey) => {
        const next = enabledMethods.includes(key)
            ? enabledMethods.filter((k) => k !== key)
            : [...enabledMethods, key];
        updateValuationMethods(project.id, next);
    };

    // Filter cards: show if methodKey is null (always) or if methodKey is in enabledMethods
    const visibleCards = moduleCards.filter(
        (mod) => mod.methodKey === null || enabledMethods.includes(mod.methodKey),
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/projects">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {project.valuationDate || '—'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {project.propertyType || '—'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Ruler className="h-3.5 w-3.5" />
                                {project.gfa !== null ? `${formatCurrency(project.gfa)} ㎡` : '—'}
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {project.address || '—'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {project.status.isDirty ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                            Data Changed
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                            Up-to-date
                        </Badge>
                    )}
                </div>
            </div>

            {/* Valuation Method Settings */}
            <Card className="border-dashed">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-base">估价方法设置</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        启用或禁用估价方法。禁用不会删除已录入的数据，仅隐藏入口。
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        {(Object.entries(VALUATION_METHODS) as [ValuationMethodKey, string][]).map(
                            ([key, label]) => (
                                <label
                                    key={key}
                                    className={`flex items-center gap-2.5 rounded-lg border px-4 py-2.5 cursor-pointer transition-all duration-200 hover:shadow-sm ${enabledMethods.includes(key)
                                            ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/20 shadow-sm'
                                            : 'border-border hover:bg-accent/50'
                                        }`}
                                >
                                    <Checkbox
                                        id={`setting-method-${key}`}
                                        checked={enabledMethods.includes(key)}
                                        onCheckedChange={() => toggleMethod(key)}
                                    />
                                    <span className="text-sm font-medium select-none">{label}</span>
                                </label>
                            ),
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Module Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visibleCards.map((mod) => (
                    <Link key={mod.key} href={`/projects/${project.id}/${mod.key}`}>
                        <Card className="group relative overflow-hidden border border-border/50 hover:border-transparent hover:shadow-xl transition-all duration-300 cursor-pointer h-full">
                            <div className={`absolute inset-0 bg-gradient-to-br ${mod.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity`} />
                            <CardHeader className="pb-3">
                                <div className="flex items-center gap-4">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${mod.gradient} text-white shadow-lg ${mod.shadow}`}>
                                        <mod.icon className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
                                            {mod.label}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground mt-0.5">
                                            {mod.description}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
