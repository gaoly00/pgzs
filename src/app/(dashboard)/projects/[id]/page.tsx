'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { VALUATION_METHODS, type ValuationMethodKey, VALUATION_METHODS_CONFIG, ProjectValuationType } from '@/types';
import { toast } from 'sonner';

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
            key: 'basic-info',
            methodKey: null,
            label: 'Basic Information',
            description: '基础信息 — 项目核心信息管理',
            icon: Building2,
            gradient: 'from-gray-500 to-slate-500',
            shadow: 'shadow-gray-500/20',
        },
        // --- Real Estate Methods ---
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
        // --- Land Methods ---
        {
            key: 'benchmark-land-price',
            methodKey: 'benchmark-land-price',
            label: 'Benchmark Land Price',
            description: '公示地价系数修正法',
            icon: MapPin,
            gradient: 'from-indigo-500 to-purple-500',
            shadow: 'shadow-indigo-500/20',
        },
        {
            key: 'residual-method',
            methodKey: 'residual-method',
            label: 'Residual Method',
            description: '剩余法',
            icon: Ruler,
            gradient: 'from-rose-500 to-red-500',
            shadow: 'shadow-rose-500/20',
        },
        {
            key: 'land-sales-comp', // Route? Might be same as 'sales-comp' but different logic? Using separate key for now.
            methodKey: 'land-sales-comp',
            label: 'Market Comparison (Land)',
            description: '市场比较法 (土地)',
            icon: BarChart3,
            gradient: 'from-blue-500 to-cyan-500',
            shadow: 'shadow-blue-500/20',
        },
        {
            key: 'land-income',
            methodKey: 'land-income',
            label: 'Income Approach (Land)',
            description: '收益还原法',
            icon: TrendingUp,
            gradient: 'from-amber-500 to-yellow-500',
            shadow: 'shadow-amber-500/20',
        },
        {
            key: 'cost-approach-land',
            methodKey: 'cost-approach-land',
            label: 'Cost Approach (Land)',
            description: '成本逼近法',
            icon: Calculator,
            gradient: 'from-emerald-500 to-teal-500',
            shadow: 'shadow-emerald-500/20',
        },
        // --- Common ---
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
    // Unwrap params using React.use() for Next.js 15 compatibility
    const unwrappedParams = use(params);

    const id = unwrappedParams?.id;

    // Use hooks at top level regardless of id presence (rules of hooks), but guard data access
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));
    const updateProject = useSmartValStore((s) => s.updateProject);
    const updateValuationMethods = useSmartValStore((s) => s.updateValuationMethods);

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editType, setEditType] = useState<ProjectValuationType>('real-estate');
    const [editMethods, setEditMethods] = useState<ValuationMethodKey[]>([]);

    useEffect(() => {
        if (project && isEditOpen) {
            setEditType(project.projectType || 'real-estate');
            setEditMethods(project.valuationMethods || []);
        }
    }, [project, isEditOpen]);

    const handleEditTypeChange = (type: ProjectValuationType) => {
        setEditType(type);
        // Auto-select defaults for new type
        const defaults = VALUATION_METHODS_CONFIG[type].map(m => m.key);
        setEditMethods(defaults);
    };

    const toggleEditMethod = (key: ValuationMethodKey) => {
        setEditMethods((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const handleSaveSettings = () => {
        if (!project) return;
        updateProject(project.id, { projectType: editType });
        updateValuationMethods(project.id, editMethods);
        setIsEditOpen(false);
        toast.success("Project settings updated");
    };

    // Loading state for unwrapped params
    if (!unwrappedParams) {
        return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
    }

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

    // Filter cards: show if methodKey is null (always) or if methodKey is in enabledMethods
    // Also ensuring backward compatibility if valuationMethods is undefined
    const currentMethods = project.valuationMethods ?? ['sales-comp'];
    const visibleCards = moduleCards.filter(
        (mod) => mod.methodKey === null || currentMethods.includes(mod.methodKey),
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
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="hidden sm:inline-flex h-6 text-xs text-muted-foreground hover:text-blue-600">
                                        <Settings2 className="h-3 w-3 mr-1" />
                                        修改项目类型和方法
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>项目配置</DialogTitle>
                                        <DialogDescription>
                                            修改项目类型及适用的估价方法。
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                        {/* Type */}
                                        <div className="space-y-2">
                                            <Label>项目类型</Label>
                                            <Select
                                                value={editType}
                                                onValueChange={(v) => handleEditTypeChange(v as ProjectValuationType)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="real-estate">房地产项目</SelectItem>
                                                    <SelectItem value="land">土地项目</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Methods */}
                                        <div className="space-y-2">
                                            <Label>估价方法</Label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50">
                                                {VALUATION_METHODS_CONFIG[editType].map((m) => (
                                                    <label
                                                        key={m.key}
                                                        className={`flex items-center gap-2 cursor-pointer p-2 rounded transition-colors ${editMethods.includes(m.key)
                                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                                            : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                                                            }`}
                                                    >
                                                        <Checkbox
                                                            checked={editMethods.includes(m.key)}
                                                            onCheckedChange={() => toggleEditMethod(m.key)}
                                                        />
                                                        <span className="text-sm font-medium">{m.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>取消</Button>
                                        <Button onClick={handleSaveSettings}>保存修改</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                {project.valuationDate || '—'}
                            </span>
                            <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {project.propertyType || '—'}
                            </span>
                            {project.projectNumber && (
                                <span className="flex items-center gap-1">
                                    <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                        {project.projectNumber}
                                    </span>
                                </span>
                            )}
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

            {/* Module Cards Only - No more Settings Card */}
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
