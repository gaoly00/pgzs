'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSmartValStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Plus,
    Building2,
    MapPin,
    Calendar,
    Ruler,
    Trash2,
    Search,
    ArrowUpDown,
    Filter,
    LayoutGrid,
    LayoutList,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { ProjectValuationType } from '@/types';

type SortKey = 'updatedAt' | 'createdAt' | 'name';
type ViewMode = 'grid' | 'list';

export default function ProjectsPage() {
    const projects = useSmartValStore((s) => s.projects);
    const deleteProjectViaAPI = useSmartValStore((s) => s.deleteProjectViaAPI);

    // 搜索、筛选、排序状态
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | ProjectValuationType>('all');
    const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
    const [sortAsc, setSortAsc] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');

    // 计算过滤和排序后的项目列表
    const filteredProjects = useMemo(() => {
        let result = [...projects];

        // 搜索过滤
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.projectNumber ?? '').toLowerCase().includes(q) ||
                    p.address.toLowerCase().includes(q),
            );
        }

        // 类型过滤
        if (typeFilter !== 'all') {
            result = result.filter((p) => p.projectType === typeFilter);
        }

        // 排序
        result.sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') {
                cmp = a.name.localeCompare(b.name, 'zh-CN');
            } else if (sortKey === 'createdAt') {
                cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else {
                cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
            }
            return sortAsc ? cmp : -cmp;
        });

        return result;
    }, [projects, search, typeFilter, sortKey, sortAsc]);

    // 统计数据
    const stats = useMemo(() => ({
        total: projects.length,
        realEstate: projects.filter((p) => p.projectType === 'real-estate').length,
        land: projects.filter((p) => p.projectType === 'land').length,
    }), [projects]);

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
                    <p className="text-muted-foreground mt-1">
                        管理你的估价项目 · 共 {stats.total} 个项目
                    </p>
                </div>
                <Link href="/projects/new">
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25">
                        <Plus className="mr-2 h-4 w-4" />
                        新建项目
                    </Button>
                </Link>
            </div>

            {/* 统计摘要卡片 */}
            {stats.total > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-slate-900">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.total}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">全部项目</div>
                        </CardContent>
                    </Card>
                    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.realEstate}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">房地产项目</div>
                        </CardContent>
                    </Card>
                    <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900">
                        <CardContent className="pt-4 pb-3 px-4">
                            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.land}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">土地项目</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* 搜索和筛选工具栏 */}
            {stats.total > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    {/* 搜索框 */}
                    <div className="relative flex-1 min-w-[200px] max-w-[400px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索项目名称、编号、地址..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9"
                        />
                    </div>

                    {/* 类型筛选 */}
                    <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                        <SelectTrigger className="w-[140px] h-9">
                            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部类型</SelectItem>
                            <SelectItem value="real-estate">房地产</SelectItem>
                            <SelectItem value="land">土地</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* 排序 */}
                    <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                        <SelectTrigger className="w-[140px] h-9">
                            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="updatedAt">更新时间</SelectItem>
                            <SelectItem value="createdAt">创建时间</SelectItem>
                            <SelectItem value="name">项目名称</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* 升序/降序切换 */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-3"
                        onClick={() => setSortAsc(!sortAsc)}
                    >
                        {sortAsc ? '升序 ↑' : '降序 ↓'}
                    </Button>

                    {/* 视图模式 */}
                    <div className="flex items-center border rounded-md">
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-r-none"
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-9 w-9 rounded-l-none"
                            onClick={() => setViewMode('list')}
                        >
                            <LayoutList className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* 项目列表 */}
            {projects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 mb-4">
                            <Building2 className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold mb-1">暂无项目</h3>
                        <p className="text-muted-foreground text-sm mb-4">
                            创建你的第一个估价项目
                        </p>
                        <Link href="/projects/new">
                            <Button variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                新建项目
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : filteredProjects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Search className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground text-sm">
                            没有找到匹配的项目
                        </p>
                        <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(''); setTypeFilter('all'); }}>
                            清除筛选
                        </Button>
                    </CardContent>
                </Card>
            ) : viewMode === 'grid' ? (
                /* 网格视图 */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map((project) => (
                        <Card
                            key={project.id}
                            className="group relative overflow-hidden border border-border/50 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-600/5 transition-all duration-300"
                        >
                            {/* 顶部渐变装饰线 */}
                            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${project.projectType === 'land'
                                    ? 'from-amber-500 to-yellow-500'
                                    : 'from-blue-600 to-indigo-600'
                                } opacity-0 group-hover:opacity-100 transition-opacity`} />

                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <Link href={`/projects/${project.id}`} className="flex-1">
                                        <CardTitle className="text-lg hover:text-blue-600 transition-colors cursor-pointer">
                                            {project.name}
                                        </CardTitle>
                                        {project.projectNumber && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                编号：{project.projectNumber}
                                            </p>
                                        )}
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={`text-[10px] ${project.projectType === 'land'
                                                ? 'text-amber-600 border-amber-200 bg-amber-50'
                                                : 'text-blue-600 border-blue-200 bg-blue-50'
                                            }`}>
                                            {project.projectType === 'land' ? '土地' : '房地产'}
                                        </Badge>
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
                                    {/* 估价方法标签 */}
                                    <div className="flex flex-wrap gap-1">
                                        {(project.valuationMethods ?? []).slice(0, 3).map((m) => (
                                            <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                {m}
                                            </span>
                                        ))}
                                        {(project.valuationMethods ?? []).length > 3 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                +{(project.valuationMethods ?? []).length - 3}
                                            </span>
                                        )}
                                    </div>
                                </CardContent>
                            </Link>
                        </Card>
                    ))}
                </div>
            ) : (
                /* 列表视图 */
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b">
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">项目名称</th>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">类型</th>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">地址</th>
                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">估价日期</th>
                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProjects.map((project) => (
                                <tr key={project.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <Link href={`/projects/${project.id}`} className="font-medium hover:text-blue-600 transition-colors">
                                            {project.name}
                                        </Link>
                                        {project.projectNumber && (
                                            <span className="text-xs text-muted-foreground ml-2">#{project.projectNumber}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <Badge variant="outline" className={`text-[10px] ${project.projectType === 'land'
                                                ? 'text-amber-600 border-amber-200 bg-amber-50'
                                                : 'text-blue-600 border-blue-200 bg-blue-50'
                                            }`}>
                                            {project.projectType === 'land' ? '土地' : '房地产'}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell truncate max-w-[200px]">
                                        {project.address || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                        {project.valuationDate || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 底部统计 */}
            {filteredProjects.length > 0 && filteredProjects.length !== projects.length && (
                <p className="text-sm text-muted-foreground text-center">
                    显示 {filteredProjects.length} / {projects.length} 个项目
                </p>
            )}
        </div>
    );
}
