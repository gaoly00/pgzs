'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { parseNumberInput } from '@/lib/format';
import { VALUATION_METHODS, type ValuationMethodKey } from '@/types';

const PROPERTY_TYPES = ['住宅', '商业', '办公', '工业', '综合', '其他'];

export default function NewProjectPage() {
    const router = useRouter();
    const createProject = useSmartValStore((s) => s.createProject);

    const [name, setName] = useState('');
    const [valuationDate, setValuationDate] = useState('');
    const [propertyType, setPropertyType] = useState('');
    const [gfaStr, setGfaStr] = useState('');
    const [address, setAddress] = useState('');
    const [selectedMethods, setSelectedMethods] = useState<ValuationMethodKey[]>(['sales-comp']);

    const toggleMethod = (key: ValuationMethodKey) => {
        setSelectedMethods((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const id = createProject({
            name: name.trim(),
            valuationDate,
            propertyType,
            gfa: parseNumberInput(gfaStr),
            address: address.trim(),
            valuationMethods: selectedMethods,
        });

        router.push(`/projects/${id}`);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/projects">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Create New Project</h1>
                    <p className="text-muted-foreground text-sm">填写项目基础信息</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                    <CardDescription>请填写估价项目的基本信息</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label htmlFor="name">项目名称 *</Label>
                            <Input
                                id="name"
                                placeholder="例如：XX花园估价项目"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        {/* Valuation Date */}
                        <div className="space-y-2">
                            <Label htmlFor="valuationDate">估价日期</Label>
                            <Input
                                id="valuationDate"
                                type="date"
                                value={valuationDate}
                                onChange={(e) => setValuationDate(e.target.value)}
                            />
                        </div>

                        {/* Property Type */}
                        <div className="space-y-2">
                            <Label htmlFor="propertyType">物业类型</Label>
                            <Select value={propertyType} onValueChange={setPropertyType}>
                                <SelectTrigger id="propertyType">
                                    <SelectValue placeholder="选择物业类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROPERTY_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* GFA */}
                        <div className="space-y-2">
                            <Label htmlFor="gfa">建筑面积 (㎡)</Label>
                            <Input
                                id="gfa"
                                type="number"
                                step="0.01"
                                placeholder="例如：120.50"
                                value={gfaStr}
                                onChange={(e) => setGfaStr(e.target.value)}
                            />
                        </div>

                        {/* Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address">地址</Label>
                            <Input
                                id="address"
                                placeholder="例如：北京市朝阳区XX路XX号"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                            />
                        </div>

                        {/* Valuation Methods */}
                        <div className="space-y-3">
                            <Label>估价方法 *</Label>
                            <p className="text-xs text-muted-foreground">选择该项目需要使用的估价方法，可在项目中随时更改</p>
                            <div className="grid grid-cols-2 gap-3">
                                {(Object.entries(VALUATION_METHODS) as [ValuationMethodKey, string][]).map(
                                    ([key, label]) => (
                                        <label
                                            key={key}
                                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50 ${selectedMethods.includes(key)
                                                    ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                                                    : 'border-border'
                                                }`}
                                        >
                                            <Checkbox
                                                id={`method-${key}`}
                                                checked={selectedMethods.includes(key)}
                                                onCheckedChange={() => toggleMethod(key)}
                                            />
                                            <span className="text-sm font-medium">{label}</span>
                                        </label>
                                    ),
                                )}
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end gap-3 pt-4">
                            <Link href="/projects">
                                <Button type="button" variant="outline">
                                    Cancel
                                </Button>
                            </Link>
                            <Button
                                type="submit"
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                                disabled={!name.trim()}
                            >
                                <Save className="mr-2 h-4 w-4" />
                                Create Project
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
