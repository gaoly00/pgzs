'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Building2, AlertTriangle } from 'lucide-react';
import { parseNumberInput, formatNumberForInput, formatCurrency } from '@/lib/format';
import {
    calcSalesCompUnitPrice,
    calcSalesCompTotalValue,
    calcCostUnitPrice,
    calcCostTotalValue,
    calcFinalUnitPrice,
    calcFinalTotalValue,
} from '@/lib/calculations';

export default function ConclusionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));
    const updateConclusion = useSmartValStore((s) => s.updateConclusion);

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

    // Prefer FortuneSheet extracted results; fallback to legacy calculation
    const salesResult = project.salesResult ?? { unitPrice: null, totalValue: null };
    const hasSalesSheetResult = salesResult.unitPrice !== null || salesResult.totalValue !== null;

    const salesCompUnitPrice = hasSalesSheetResult
        ? (salesResult.unitPrice ?? 0)
        : calcSalesCompUnitPrice(project.salesCompCases);
    const salesCompTotalValue = hasSalesSheetResult
        ? (salesResult.totalValue ?? 0)
        : calcSalesCompTotalValue(project.salesCompCases, project.gfa);
    const costUnitPrice = calcCostUnitPrice(project);
    const costTotalValue = calcCostTotalValue(project);

    const finalUnitPrice = calcFinalUnitPrice(project);
    const finalTotalValue = calcFinalTotalValue(project);

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
                    <h1 className="text-2xl font-bold tracking-tight">Conclusion</h1>
                    <p className="text-muted-foreground text-sm">
                        估价结论 — {project.name}
                    </p>
                </div>
            </div>

            {/* Sales Result Warning */}
            {!hasSalesSheetResult && (
                <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                        Sales Comparison result not extracted from spreadsheet.
                        <Link href={`/projects/${id}/sales-comp`} className="ml-1 font-medium underline underline-offset-2 hover:text-amber-900">
                            Go to Sales Comp →
                        </Link>
                        {' '}to calculate and set anchors.
                    </AlertDescription>
                </Alert>
            )}

            {/* Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sales Comp Result */}
                <Card className="border-blue-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-blue-700">比较法结果</CardTitle>
                        <CardDescription>Sales Comparison Approach</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">单价</span>
                            <span className="font-mono font-semibold text-blue-700">
                                {formatCurrency(salesCompUnitPrice)} 元/㎡
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">总价</span>
                            <span className="font-mono font-semibold text-blue-700">
                                {formatCurrency(salesCompTotalValue)} 元
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Cost Result */}
                <Card className="border-emerald-100">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-emerald-700">成本法结果</CardTitle>
                        <CardDescription>Cost Approach</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">单价</span>
                            <span className="font-mono font-semibold text-emerald-700">
                                {formatCurrency(costUnitPrice)} 元/㎡
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">总价</span>
                            <span className="font-mono font-semibold text-emerald-700">
                                {formatCurrency(costTotalValue)} 元
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Method Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">最终取值方法</CardTitle>
                    <CardDescription>选择评估结论采用的估价方法</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <RadioGroup
                        value={project.conclusion.selectedMethod}
                        onValueChange={(value) =>
                            updateConclusion(id, {
                                selectedMethod: value as 'salesComp' | 'cost' | 'manual',
                            })
                        }
                        className="space-y-3"
                    >
                        <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="salesComp" id="salesComp" />
                            <Label htmlFor="salesComp" className="flex-1 cursor-pointer">
                                <span className="font-medium">比较法 (Sales Comparison)</span>
                                <p className="text-sm text-muted-foreground">
                                    采用比较法计算结果作为最终估价
                                </p>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="cost" id="cost" />
                            <Label htmlFor="cost" className="flex-1 cursor-pointer">
                                <span className="font-medium">成本法 (Cost Approach)</span>
                                <p className="text-sm text-muted-foreground">
                                    采用成本法计算结果作为最终估价
                                </p>
                            </Label>
                        </div>
                        <div className="flex items-center space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="manual" id="manual" />
                            <Label htmlFor="manual" className="flex-1 cursor-pointer">
                                <span className="font-medium">手动取值 (Manual)</span>
                                <p className="text-sm text-muted-foreground">
                                    手动输入最终估价单价
                                </p>
                            </Label>
                        </div>
                    </RadioGroup>

                    {/* Manual Input */}
                    {project.conclusion.selectedMethod === 'manual' && (
                        <div className="space-y-4 rounded-lg border border-dashed p-4 bg-muted/20">
                            <div className="space-y-2">
                                <Label htmlFor="manualUnitPrice">最终单价 (元/㎡)</Label>
                                <Input
                                    id="manualUnitPrice"
                                    type="number"
                                    step="0.01"
                                    placeholder="请输入最终单价"
                                    value={formatNumberForInput(project.conclusion.manualUnitPrice)}
                                    onChange={(e) =>
                                        updateConclusion(id, {
                                            manualUnitPrice: parseNumberInput(e.target.value),
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="manualReason">取值理由</Label>
                                <Textarea
                                    id="manualReason"
                                    placeholder="请说明手动取值的理由..."
                                    value={project.conclusion.manualReason}
                                    onChange={(e) =>
                                        updateConclusion(id, { manualReason: e.target.value })
                                    }
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Final Results */}
            <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50/50 to-purple-50/50">
                <CardHeader>
                    <CardTitle className="text-lg text-violet-700">最终估价结论</CardTitle>
                    <CardDescription>
                        采用方法：
                        {project.conclusion.selectedMethod === 'salesComp'
                            ? '比较法'
                            : project.conclusion.selectedMethod === 'cost'
                                ? '成本法'
                                : '手动取值'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">最终单价</p>
                            <p className="text-3xl font-bold font-mono text-violet-700">
                                {formatCurrency(finalUnitPrice)}
                            </p>
                            <p className="text-xs text-muted-foreground">元/㎡</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">最终总价</p>
                            <p className="text-3xl font-bold font-mono text-violet-700">
                                {formatCurrency(finalTotalValue)}
                            </p>
                            <p className="text-xs text-muted-foreground">元</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
