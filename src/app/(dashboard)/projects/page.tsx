'use client';

import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin, Calendar, Ruler, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function ProjectsPage() {
    const projects = useSmartValStore((s) => s.projects);
    const deleteProjectViaAPI = useSmartValStore((s) => s.deleteProjectViaAPI);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground mt-1">
                        管理你的估价项目
                    </p>
                </div>
                <Link href="/projects/new">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Button>
                </Link>
            </div>

            {/* Project Grid */}
            {projects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mb-4">
                            <Building2 className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">No Projects Yet</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            创建你的第一个估价项目
                        </p>
                        <Link href="/projects/new">
                            <Button variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Project
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Card
                            key={project.id}
                            className="group relative overflow-hidden border border-border/50 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300"
                        >
                            {/* Gradient accent top */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <Link href={`/projects/${project.id}`} className="flex-1">
                                        <CardTitle className="text-lg hover:text-blue-600 transition-colors cursor-pointer">
                                            {project.name}
                                        </CardTitle>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        {project.status.isDirty && (
                                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                                                未保存
                                            </Badge>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => {
                                                if (confirm('确定要删除此项目吗？')) {
                                                    deleteProjectViaAPI(project.id);
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>

                            <Link href={`/projects/${project.id}`}>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{project.valuationDate || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Building2 className="h-3.5 w-3.5" />
                                            <span>{project.propertyType || '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Ruler className="h-3.5 w-3.5" />
                                            <span>{project.gfa !== null ? `${formatCurrency(project.gfa)} ㎡` : '—'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <MapPin className="h-3.5 w-3.5" />
                                            <span className="truncate">{project.address || '—'}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Link>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
