'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Plus, Trash2, Building2 } from 'lucide-react';
import { parseNumberInput, formatNumberForInput, formatCurrency } from '@/lib/format';
import { calcCostTotal, calcCostUnitPrice, calcCostTotalValue } from '@/lib/calculations';

export default function CostPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const project = useSmartValStore((s) => s.projects.find((p) => p.id === id));
    const updateCostItem = useSmartValStore((s) => s.updateCostItem);
    const addCostItem = useSmartValStore((s) => s.addCostItem);
    const deleteCostItem = useSmartValStore((s) => s.deleteCostItem);

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

    const totalCost = calcCostTotal(project);
    const costUnitPrice = calcCostUnitPrice(project);
    const costTotalValue = calcCostTotalValue(project);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href={`/projects/${id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Cost Approach</h1>
                        <p className="text-muted-foreground text-sm">
                            成本法 — {project.name}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => addCostItem(id)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                </Button>
            </div>

            {/* Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">成本项明细</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-lg border overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-10 text-center">#</TableHead>
                                    <TableHead>成本项名称</TableHead>
                                    <TableHead className="text-right">金额 (元)</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {project.costItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            暂无成本项，点击右上方「Add Item」添加
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    project.costItems.map((item, idx) => (
                                        <TableRow key={item.id} className="group">
                                            <TableCell className="text-center text-muted-foreground font-mono text-sm">
                                                {idx + 1}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={item.name}
                                                    placeholder="成本项名称"
                                                    className="h-8 border-transparent hover:border-input focus:border-input bg-transparent"
                                                    onChange={(e) =>
                                                        updateCostItem(id, item.id, { name: e.target.value })
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={formatNumberForInput(item.amount)}
                                                    placeholder="0.00"
                                                    className="h-8 text-right border-transparent hover:border-input focus:border-input bg-transparent"
                                                    onChange={(e) =>
                                                        updateCostItem(id, item.id, {
                                                            amount: parseNumberInput(e.target.value),
                                                        })
                                                    }
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                                    onClick={() => deleteCostItem(id, item.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            {project.costItems.length > 0 && (
                                <TableFooter>
                                    <TableRow className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                                        <TableCell colSpan={2} className="font-semibold text-right">
                                            Total Cost
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono text-emerald-700">
                                            {formatCurrency(totalCost)} 元
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                    <TableRow className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                                        <TableCell colSpan={2} className="font-semibold text-right">
                                            Cost Unit Price (GFA: {project.gfa !== null ? formatCurrency(project.gfa) : '0'} ㎡)
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono text-emerald-700">
                                            {formatCurrency(costUnitPrice)} 元/㎡
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                    <TableRow className="bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
                                        <TableCell colSpan={2} className="font-semibold text-right">
                                            Cost Indicated Total Value
                                        </TableCell>
                                        <TableCell className="text-right font-bold font-mono text-emerald-700">
                                            {formatCurrency(costTotalValue)} 元
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
