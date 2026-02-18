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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Loader2,
    RefreshCw,
    Check,
    MapPin,
    AlertCircle,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SuggestedAnchor } from '@/lib/auto-scanner';
import type { SalesAnchors, SalesAnchor } from '@/types';
import { STANDARD_FIELDS } from '@/lib/valuation-schema';

interface AutoScanReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isScanning: boolean;
    suggestions: SuggestedAnchor[];
    existingAnchors: SalesAnchors;
    onReScan: (mode: 'current' | 'all') => void;
    onApply: (selections: Map<string, SuggestedAnchor>, allowOverwrite: boolean) => void;
    onHighlight: (sheetId: string, r: number, c: number) => void;
    debugInfo?: {
        sheetName: string;
        sheetId: string;
        celldataLen: number;
        checks: Array<{
            labelCoord: string;
            labelRaw: string;
            labelNorm: string;
            valueCoord: string;
            valueRaw: any;
            valueNum: any;
        }>;
    } | null;
}

export function AutoScanReviewDialog({
    open,
    onOpenChange,
    isScanning,
    suggestions,
    existingAnchors,
    onReScan,
    onApply,
    onHighlight,
    debugInfo,
}: AutoScanReviewDialogProps) {
    // State
    const [scanMode, setScanMode] = React.useState<'current' | 'all'>('current');
    const [allowOverwrite, setAllowOverwrite] = React.useState(false);

    // Selections: originalFieldKey -> SuggestedAnchor
    const [selections, setSelections] = React.useState<Map<string, SuggestedAnchor>>(new Map());

    // Custom Key Edits: originalFieldKey -> newKeyName
    const [customKeyEdits, setCustomKeyEdits] = React.useState<Map<string, string>>(new Map());

    // Group suggestions by fieldKey (memoized)
    const groupedSuggestions = React.useMemo(() => {
        const groups = new Map<string, SuggestedAnchor[]>();
        suggestions.forEach((s) => {
            const list = groups.get(s.fieldKey) ?? [];
            list.push(s);
            groups.set(s.fieldKey, list);
        });
        return groups;
    }, [suggestions]);

    // Separate Standard vs Custom groups
    const { standardGroups, customGroups } = React.useMemo(() => {
        const standard = new Map<string, SuggestedAnchor[]>();
        const custom = new Map<string, SuggestedAnchor[]>();

        groupedSuggestions.forEach((items, key) => {
            if (items[0]?.type === 'custom') {
                custom.set(key, items);
            } else {
                standard.set(key, items);
            }
        });
        return { standardGroups: standard, customGroups: custom };
    }, [groupedSuggestions]);

    // Initialize selections when suggestions change
    React.useEffect(() => {
        const newSelections = new Map<string, SuggestedAnchor>();

        groupedSuggestions.forEach((items, fieldKey) => {
            // Check if already bound
            const isBound = !!existingAnchors[fieldKey];

            // Auto-select logic
            if (!isBound) {
                const top = items[0];
                // For standard: high confidence (>0.8)
                // For custom: maybe explicit selection is safer? Let's auto-select high confidence ones (only numbers)
                if (top && top.confidence > 0.6) {
                    newSelections.set(fieldKey, top);
                }
            }
        });

        setSelections(newSelections);
        setCustomKeyEdits(new Map()); // Reset edits
    }, [suggestions, existingAnchors, groupedSuggestions]);

    // Handlers
    const handleReScan = () => {
        onReScan(scanMode);
    };

    const handleApply = () => {
        // Construct final map: FinalKey -> Anchor
        const finalMap = new Map<string, SuggestedAnchor>();

        selections.forEach((anchor, originalKey) => {
            if (anchor.type === 'custom') {
                // Use the edited key, or default to cleaned original key
                const userKey = customKeyEdits.get(originalKey);
                const finalKey = userKey ? userKey.trim() : originalKey;
                if (finalKey) {
                    finalMap.set(finalKey, anchor);
                }
            } else {
                finalMap.set(originalKey, anchor);
            }
        });

        onApply(finalMap, allowOverwrite);
        onOpenChange(false);
    };

    const handleSelect = (fieldKey: string, suggestion: SuggestedAnchor) => {
        const next = new Map(selections);
        next.set(fieldKey, suggestion);
        setSelections(next);
        onHighlight(suggestion.sheetId, suggestion.valueCell.r, suggestion.valueCell.c);
    };

    const clearSelection = (fieldKey: string) => {
        const next = new Map(selections);
        next.delete(fieldKey);
        setSelections(next);
    };

    const handleCustomKeyChange = (originalKey: string, newKey: string) => {
        const next = new Map(customKeyEdits);
        next.set(originalKey, newKey);
        setCustomKeyEdits(next);
    };

    // Calculate unused standard fields for dropdown
    const unusedStandardFields = React.useMemo(() => {
        const usedKeys = new Set<string>();
        // Add keys from existing anchors
        Object.keys(existingAnchors).forEach(k => usedKeys.add(k));
        // Add keys from current standard suggestions
        standardGroups.forEach((_, k) => usedKeys.add(k));

        return STANDARD_FIELDS.filter(f => !usedKeys.has(f.key));
    }, [existingAnchors, standardGroups]);

    const totalFound = suggestions.length;

    // Helper to render a group of suggestions
    const renderGroup = (fieldKey: string, items: SuggestedAnchor[]) => {
        if (items.length === 0) return null;
        const firstItem = items[0];
        const isBound = !!existingAnchors[fieldKey];
        const selectedId = selections.get(fieldKey);
        const getValId = (s: SuggestedAnchor) => `${s.sheetId}|${s.valueCell.r}|${s.valueCell.c}`;

        const isCustom = firstItem.type === 'custom';
        const currentEditKey = customKeyEdits.get(fieldKey) ?? '';

        return (
            <div key={fieldKey} className="space-y-3 p-3 border rounded-lg bg-card shadow-sm">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {isCustom ? (
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">Custom</Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Standard</Badge>
                            )}
                            <span className="font-semibold text-sm">
                                {isCustom ? `Found: "${firstItem.fieldLabel}"` : firstItem.fieldLabel}
                            </span>
                            {isBound && (
                                <Badge variant="outline" className="text-[10px] px-1 h-4 bg-gray-100 text-gray-600">
                                    Bound
                                </Badge>
                            )}
                        </div>
                        {selectedId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-destructive"
                                onClick={() => clearSelection(fieldKey)}
                            >
                                Clear
                            </Button>
                        )}
                    </div>

                    {/* Custom Key Editor */}
                    {isCustom && selectedId && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Map to:</span>
                            {/* Unified Input combining text and select behavior logic via two elements for simplicity */}
                            <div className="flex-1 flex gap-2">
                                <select
                                    className="h-7 text-xs border rounded px-2 bg-background w-1/2"
                                    onChange={(e) => {
                                        if (e.target.value) handleCustomKeyChange(fieldKey, e.target.value);
                                    }}
                                    value=""
                                >
                                    <option value="" disabled>Select Standard Field...</option>
                                    {unusedStandardFields.map(f => (
                                        <option key={f.key} value={f.key}>{f.label}</option>
                                    ))}
                                </select>
                                <Input
                                    className="h-7 text-xs flex-1"
                                    placeholder="Or type custom key..."
                                    value={currentEditKey || (fieldKey.startsWith('custom_') ? fieldKey : fieldKey)}
                                    onChange={(e) => handleCustomKeyChange(fieldKey, e.target.value)}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Candidates List */}
                <RadioGroup
                    value={selectedId ? getValId(selectedId) : ''}
                    onValueChange={(val) => {
                        const match = items.find(i => getValId(i) === val);
                        if (match) handleSelect(fieldKey, match);
                    }}
                    className="gap-2"
                >
                    {items.map((suggestion, idx) => {
                        const valId = getValId(suggestion);
                        const isSelected = selectedId && getValId(selectedId) === valId;

                        return (
                            <div
                                key={idx}
                                className={cn(
                                    "relative flex items-center space-x-3 rounded border p-2 hover:bg-accent/50 transition-colors cursor-pointer",
                                    isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/30"
                                )}
                                onClick={() => handleSelect(fieldKey, suggestion)}
                            >
                                <RadioGroupItem value={valId} id={valId} className="mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor={valId} className="font-medium cursor-pointer truncate text-sm">
                                            {suggestion.value !== null ? String(suggestion.value) : 'Empty'}
                                        </Label>
                                        <div className="flex items-center gap-1">
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal text-muted-foreground border-slate-200">
                                                {suggestion.confidence.toFixed(2)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                        <MapPin className="h-3 w-3" />
                                        <span>R{suggestion.valueCell.r}C{suggestion.valueCell.c}</span>
                                        <span className="mx-1">•</span>
                                        <span className="truncate">{suggestion.reason}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </RadioGroup>
            </div>
        );
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
                <SheetHeader className="px-6 py-4 border-b bg-muted/10">
                    <SheetTitle className="flex items-center gap-2">
                        ✨ Auto-Scan Review
                        <Badge variant="secondary" className="font-mono text-xs">
                            {totalFound} Found
                        </Badge>
                    </SheetTitle>
                    <SheetDescription>
                        Review suggestions. Rename custom fields or map to standard keys.
                    </SheetDescription>
                </SheetHeader>

                {/* Controls */}
                <div className="p-4 border-b bg-background space-y-3 shadow-sm z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Scope:</span>
                            <div className="flex items-center bg-muted rounded-md p-0.5">
                                <Button
                                    variant={scanMode === 'current' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setScanMode('current')}
                                    className="h-6 text-[10px] px-2"
                                >
                                    Current
                                </Button>
                                <Button
                                    variant={scanMode === 'all' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setScanMode('all')}
                                    className="h-6 text-[10px] px-2"
                                >
                                    All Sheets
                                </Button>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleReScan}
                            disabled={isScanning}
                            className="h-7 text-xs"
                        >
                            {isScanning ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                            Re-Scan
                        </Button>
                    </div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/10">
                    {debugInfo && (
                        <div className="m-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-xs font-mono space-y-2">
                            <div className="flex items-center justify-between border-b border-yellow-200/50 pb-2">
                                <span className="font-bold text-yellow-800 dark:text-yellow-200">🔎 Debug Info</span>
                                <span className="text-[10px] text-yellow-600 dark:text-yellow-400">
                                    Sheet: {debugInfo.sheetName} (ID:{debugInfo.sheetId})
                                </span>
                            </div>
                            <div>celldata.length: {debugInfo.celldataLen}</div>

                            <div className="space-y-1">
                                <div className="font-bold text-[10px] opacity-70">Check Specific Cells:</div>
                                {debugInfo.checks.map((check, i) => (
                                    <div key={i} className="bg-white/50 dark:bg-black/20 p-1.5 rounded space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-200 px-1 rounded text-[10px]">{check.labelCoord}</span>
                                            <span className={check.labelRaw ? "text-green-600" : "text-red-500 font-bold"}>
                                                Raw: {JSON.stringify(check.labelRaw)}
                                            </span>
                                        </div>
                                        <div className="pl-4 border-l-2 border-slate-200 ml-1">
                                            <div>Norm: "{check.labelNorm}"</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="bg-slate-200 px-1 rounded text-[10px]">Val {check.valueCoord}</span>
                                                <span>Num: {JSON.stringify(check.valueNum)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="text-[10px] text-yellow-700/80 italic mt-2">
                                * Using excel-utils adapters from latest scan snapshot.
                            </div>
                        </div>
                    )}

                    {isScanning ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p className="text-sm">Universal Discovery running...</p>
                        </div>
                    ) : totalFound === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground m-6 border-2 border-dashed rounded-lg bg-background">
                            <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
                            <p className="text-sm">No suggestions found.</p>
                            <p className="text-xs opacity-70 mt-1">Try "All Sheets" mode.</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-6">
                            {/* Standard Section */}
                            {standardGroups.size > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        🎯 Standard Matches ({standardGroups.size})
                                    </h3>
                                    {Array.from(standardGroups.entries()).map(([key, items]) => renderGroup(key, items))}
                                </div>
                            )}

                            {/* Custom Section */}
                            {customGroups.size > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            ❓ Found Custom Data ({customGroups.size})
                                        </h3>
                                        <Badge variant="outline" className="text-[10px] h-4">New</Badge>
                                    </div>
                                    <div className="text-[10px] text-muted-foreground px-1">
                                        These items matched a label and a number but aren't in the standard schema.
                                    </div>
                                    {Array.from(customGroups.entries()).map(([key, items]) => renderGroup(key, items))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <SheetFooter className="p-4 border-t bg-background">
                    <div className="flex items-center space-x-2 mr-auto">
                        <Checkbox
                            id="allow-overwrite"
                            checked={allowOverwrite}
                            onCheckedChange={(c) => setAllowOverwrite(!!c)}
                        />
                        <Label htmlFor="allow-overwrite" className="text-xs cursor-pointer">
                            Allow overwrite
                        </Label>
                    </div>
                    <Button onClick={handleApply} disabled={isScanning || selections.size === 0}>
                        <Check className="mr-2 h-4 w-4" />
                        Apply {selections.size}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
