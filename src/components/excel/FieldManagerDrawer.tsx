'use client';

import * as React from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Link as LinkIcon, Unlink, Check, ChevronDown, ChevronRight, Save, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSmartValStore } from '@/store';
import { STANDARD_FIELDS, type StandardFieldDef, type FieldCategory } from '@/lib/valuation-schema';
import { rcToA1 } from '@/lib/excel-coords';
import type { SalesAnchor, CustomFieldDef } from '@/types';
import { toast } from 'sonner';

interface FieldManagerDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    currentSelection: { sheetId: string; sheetName: string; r: number; c: number } | null;
    onCaptureSelection: () => void;
    getCurrentSelection: () => { sheetId: string; sheetName: string; r: number; c: number } | null;
    onSaveAndExtract: () => void;
}

export function FieldManagerDrawer({
    open,
    onOpenChange,
    projectId,
    currentSelection,
    onCaptureSelection,
    getCurrentSelection,
    onSaveAndExtract,
}: FieldManagerDrawerProps) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [collapsedCategories, setCollapsedCategories] = React.useState<Set<string>>(new Set());

    // Custom Field State
    const [customLabel, setCustomLabel] = React.useState('');
    const [customType, setCustomType] = React.useState<'number' | 'text'>('number');
    const [isAddingCustom, setIsAddingCustom] = React.useState(false);

    const project = useSmartValStore((s) => s.projects.find((p) => p.id === projectId));
    const bindAnchor = useSmartValStore((s) => s.bindAnchor);
    const unbindAnchor = useSmartValStore((s) => s.unbindAnchor);
    const addCustomField = useSmartValStore((s) => s.addCustomField);
    const removeCustomField = useSmartValStore((s) => s.removeCustomField);

    const salesAnchors = project?.salesAnchors || {};
    const customFields = project?.customFields || [];

    // Group fields
    const groupedFields = React.useMemo(() => {
        const groups: Record<string, (StandardFieldDef | CustomFieldDef)[]> = {};

        // 1. Standard Fields
        STANDARD_FIELDS.forEach((field) => {
            if (searchQuery && !field.label.toLowerCase().includes(searchQuery.toLowerCase())) return;
            if (!groups[field.category]) groups[field.category] = [];
            groups[field.category].push(field);
        });

        // 2. Custom Fields (Group under 'Custom')
        if (customFields.length > 0) {
            groups['Custom'] = [];
            customFields.forEach(field => {
                if (searchQuery && !field.label.toLowerCase().includes(searchQuery.toLowerCase())) return;
                groups['Custom'].push(field);
            });
        }

        return groups;
    }, [searchQuery, customFields]);

    const categories: string[] = ['Results', 'Subject', 'Comparables', 'Other', 'Custom'];

    const toggleCategory = (cat: string) => {
        const next = new Set(collapsedCategories);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        setCollapsedCategories(next);
    };

    // --- Binding Logic ---
    const handleBind = (fieldKey: string) => {
        // Direct read from ref via callback
        const sel = getCurrentSelection();

        if (!sel) {
            toast.error("Please click a cell in the spreadsheet first.");
            return;
        }

        const anchor: SalesAnchor = {
            ...sel,
            a1: rcToA1(sel.r, sel.c),
        };

        bindAnchor(projectId, fieldKey, anchor);

        // Debug Log per request
        console.log('[BIND]', fieldKey, sel);

        // Optionally update the UI's "Current Selection" to match what we just bound
        // calling onCaptureSelection triggers re-read from ref and updates parent state
        onCaptureSelection();

        toast.success(`Bound to ${sel.sheetName}!${anchor.a1}`);
    };

    const handleUnbind = (fieldKey: string) => {
        unbindAnchor(projectId, fieldKey);
    };

    // --- Custom Field Logic ---
    const handleAddCustomField = () => {
        if (!customLabel.trim()) return;

        // Generate a safe key
        const slug = customLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 20);
        const uniqueKey = `custom:${slug}_${Date.now().toString(36)}`;

        addCustomField(projectId, {
            key: uniqueKey,
            label: customLabel,
            valueType: customType,
        });

        setCustomLabel('');
        setIsAddingCustom(false);
        toast.success("Custom field added");
    };

    const handleRemoveCustomField = (key: string) => {
        removeCustomField(projectId, key);
        toast.success("Custom field removed");
    };

    const selectionA1 = currentSelection ? rcToA1(currentSelection.r, currentSelection.c) : 'None';
    const selectionLabel = currentSelection
        ? `${currentSelection.sheetName}!${selectionA1}`
        : 'No selection captured';

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[500px] h-full max-h-screen overflow-hidden flex flex-col p-0 gap-0">
                <SheetHeader className="px-6 py-4 border-b bg-muted/10 shrink-0">
                    <SheetTitle className="flex items-center gap-2">
                        📊 Field Manager
                    </SheetTitle>
                    <SheetDescription>
                        Bind cells to standard or custom fields.
                    </SheetDescription>
                </SheetHeader>

                {/* Toolbar */}
                <div className="p-4 border-b bg-background space-y-4">
                    {/* Capture Section */}
                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                Current Selection
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "font-mono text-sm font-medium",
                                    currentSelection ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {selectionLabel}
                                </span>
                            </div>
                        </div>
                        <Button
                            variant={currentSelection ? "secondary" : "default"}
                            size="sm"
                            onClick={onCaptureSelection}
                            className="shrink-0 h-8"
                            title="Update current selection from spreadsheet"
                        >
                            <MousePointerClick className="mr-2 h-3.5 w-3.5" />
                            {currentSelection ? 'Re-Capture' : 'Capture Cell'}
                        </Button>
                    </div>

                    {/* Search & Custom Field Action */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search fields..."
                                className="pl-9 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0"
                            onClick={() => setIsAddingCustom(true)}
                            title="Add Custom Field"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Fields List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {categories.map((cat) => {
                        const fields = groupedFields[cat];
                        if (!fields || fields.length === 0) {
                            // Show "Add Custom" prompt if Custom category is empty
                            if (cat === 'Custom' && customFields.length === 0) {
                                return (
                                    <div key={cat} className="space-y-2">
                                        <div className="flex items-center gap-2 p-1">
                                            <h3 className="font-semibold text-sm">Custom Fields</h3>
                                        </div>
                                        <div className="p-4 border border-dashed rounded-lg text-center">
                                            <p className="text-sm text-muted-foreground mb-2">No custom fields yet.</p>
                                            <Button variant="outline" size="sm" onClick={() => setIsAddingCustom(true)}>
                                                <Plus className="h-3 w-3 mr-1" /> Add Field
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }
                        const isCollapsed = collapsedCategories.has(cat);

                        return (
                            <div key={cat} className="space-y-2">
                                <div
                                    className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded"
                                    onClick={() => toggleCategory(cat)}
                                >
                                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    <h3 className="font-semibold text-sm">{cat == 'Custom' ? 'Custom Fields' : cat}</h3>
                                    <Badge variant="outline" className="ml-auto text-xs h-5">
                                        {fields.length}
                                    </Badge>
                                </div>

                                {!isCollapsed && (
                                    <div className="space-y-1 pl-2 border-l-2 ml-2 border-slate-100 dark:border-slate-800">
                                        {fields.map((field) => {
                                            const anchor = salesAnchors[field.key];
                                            const isBound = !!anchor;
                                            const isCustom = field.key.startsWith('custom:');

                                            return (
                                                <div
                                                    key={field.key}
                                                    className={cn(
                                                        "flex flex-col gap-2 p-3 rounded-md border text-sm transition-all",
                                                        isBound ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900"
                                                            : "bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex flex-col gap-0.5 overflow-hidden">
                                                            <span className="font-medium truncate" title={field.label}>
                                                                {field.label.split('(')[0].trim()}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                                    {field.valueType === 'number' ? '#' : 'Aa'}
                                                                    {isCustom && (
                                                                        <span className="bg-purple-100 text-purple-600 px-1 rounded text-[10px] dark:bg-purple-900 dark:text-purple-300">Custom</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="shrink-0 flex items-center gap-1">
                                                            {isBound ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                    onClick={() => handleUnbind(field.key)}
                                                                    title="Unbind"
                                                                >
                                                                    <Unlink className="h-3.5 w-3.5" />
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-7 text-xs"
                                                                    onClick={() => handleBind(field.key)}
                                                                >
                                                                    <LinkIcon className="mr-1.5 h-3 w-3" />
                                                                    Bind
                                                                </Button>
                                                            )}

                                                            {isCustom && !isBound && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
                                                                    onClick={() => handleRemoveCustomField(field.key)}
                                                                    title="Delete Field"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isBound && (
                                                        <div className="flex items-center gap-2 mt-1 text-xs bg-green-100/50 dark:bg-green-900/40 p-1.5 rounded text-green-800 dark:text-green-300">
                                                            <Check className="h-3 w-3" />
                                                            <span className="font-mono">
                                                                {anchor?.sheetName}!{anchor?.a1}
                                                            </span>
                                                            <span className="ml-auto opacity-70 italic">
                                                                {project?.extractedMetrics?.[field.key]
                                                                    ? `Val: ${project.extractedMetrics[field.key]}`
                                                                    : 'Pending extract'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Add Custom Button at end of Custom group */}
                                        {cat === 'Custom' && (
                                            <div className="pt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full border border-dashed text-muted-foreground h-8"
                                                    onClick={() => setIsAddingCustom(true)}
                                                >
                                                    <Plus className="h-3 w-3 mr-2" /> Add Custom Field
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Add Custom Field Dialog (Inline Overlay) */}
                {isAddingCustom && (
                    <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-background border rounded-lg shadow-xl w-full max-w-sm p-4 space-y-4">
                            <h3 className="font-semibold text-lg">Add Custom Field</h3>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Field Label</label>
                                    <Input
                                        value={customLabel}
                                        onChange={e => setCustomLabel(e.target.value)}
                                        placeholder="e.g. Noise Coefficient"
                                        autoFocus
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">Type</label>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={customType === 'number' ? 'default' : 'outline'}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setCustomType('number')}
                                        >
                                            # Number
                                        </Button>
                                        <Button
                                            variant={customType === 'text' ? 'default' : 'outline'}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setCustomType('text')}
                                        >
                                            Aa Text
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setIsAddingCustom(false)}>Cancel</Button>
                                <Button onClick={handleAddCustomField}>Add Field</Button>
                            </div>
                        </div>
                    </div>
                )}

                <SheetFooter className="p-4 border-t bg-background shrink-0 gap-2 flex-col sm:flex-row">
                    <p className="text-[10px] text-muted-foreground mr-auto text-center sm:text-left w-full sm:w-auto mt-2 sm:mt-0 order-2 sm:order-1">
                        * Values update only after Save & Extract.
                    </p>
                    <Button onClick={onSaveAndExtract} className="w-full sm:w-auto order-1 sm:order-2">
                        <Save className="mr-2 h-4 w-4" />
                        Save & Extract
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
