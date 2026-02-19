'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { ProjectValuationType, VALUATION_METHODS_CONFIG, ValuationMethodKey } from '@/types';

export default function NewProjectPage() {
    const router = useRouter();
    const createProject = useSmartValStore((s) => s.createProject);

    const [name, setName] = useState('');
    const [projectNumber, setProjectNumber] = useState('');
    const [projectType, setProjectType] = useState<ProjectValuationType>('real-estate');
    // Ensure initial state has defaults, or start empty? User said "allow checking which means default state...".
    // Usually better to have defaults selected.
    const [selectedMethods, setSelectedMethods] = useState<ValuationMethodKey[]>(
        VALUATION_METHODS_CONFIG['real-estate'].map(m => m.key)
    );

    const handleProjectTypeChange = (type: ProjectValuationType) => {
        setProjectType(type);
        // Reset methods to defaults for the new type? Or clear? 
        // "Render ... allow checking". 
        // Let's reset to defaults for convenience.
        const defaultMethods = VALUATION_METHODS_CONFIG[type].map(m => m.key);
        setSelectedMethods(defaultMethods);
    };

    const toggleMethod = (key: ValuationMethodKey) => {
        setSelectedMethods((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const id = createProject({
            name: name.trim(),
            projectNumber: projectNumber.trim(),
            projectType,
            valuationMethods: selectedMethods // Use selected checkboxes
        });

        // Redirect to Basic Info page (Module 1)
        router.push(`/projects/${id}/basic-info`);
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
                    <p className="text-muted-foreground text-sm">仅需填写核心信息即可快速创建项目</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Project Basics</CardTitle>
                    <CardDescription>核心识别信息与类型</CardDescription>
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

                        {/* Project Number */}
                        <div className="space-y-2">
                            <Label htmlFor="projectNumber">项目编号</Label>
                            <Input
                                id="projectNumber"
                                placeholder="例如：2024-VJ-001"
                                value={projectNumber}
                                onChange={(e) => setProjectNumber(e.target.value)}
                            />
                        </div>

                        {/* Project Type */}
                        <div className="space-y-2">
                            <Label htmlFor="projectType">项目类型 *</Label>
                            <Select
                                value={projectType}
                                onValueChange={(v) => handleProjectTypeChange(v as ProjectValuationType)}
                            >
                                <SelectTrigger id="projectType">
                                    <SelectValue placeholder="选择项目类型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="real-estate">房地产项目</SelectItem>
                                    <SelectItem value="land">土地项目</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Valuation Methods Checkboxes (Conditional Rendering) */}
                        <div className="space-y-3 pt-2">
                            <Label>适用估价方法</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border rounded-md bg-slate-50 dark:bg-slate-900/50">
                                {VALUATION_METHODS_CONFIG[projectType].map((m) => (
                                    <label
                                        key={m.key}
                                        className={`flex items-center gap-2 cursor-pointer p-2 rounded transition-colors ${selectedMethods.includes(m.key)
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                            : 'hover:bg-slate-200 dark:hover:bg-slate-800'
                                            }`}
                                    >
                                        <Checkbox
                                            checked={selectedMethods.includes(m.key)}
                                            onCheckedChange={() => toggleMethod(m.key)}
                                            className="data-[state=checked]:bg-blue-600"
                                        />
                                        <span className="text-sm font-medium">{m.label}</span>
                                    </label>
                                ))}
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
                                disabled={!name.trim() || selectedMethods.length === 0}
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
