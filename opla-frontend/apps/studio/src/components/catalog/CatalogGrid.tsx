import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EyeOff, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import {
    buildColumnSuggestions,
    createEmptyRowData,
    entryToRowData,
    slugifyCatalogKey,
} from '../../utils/catalogUtils';
import type { CatalogField } from '../../utils/catalogUtils';

export type CatalogGridEntry = {
    id: string;
    submission_id?: string;
    key_value?: string;
    data?: Record<string, unknown>;
    created_at?: string;
};

type GridRow = {
    rowId: string;
    entryId: string | null;
    originalKey: string | null;
    isNew: boolean;
    data: Record<string, string>;
    baselineData: Record<string, string>;
    dirty: boolean;
    saving: boolean;
};

export type CatalogGridProps = {
    formId: string;
    catalogTitle: string;
    catalogStatus?: string;
    keyFieldId?: string | null;
    labelFieldId?: string | null;
    fields: CatalogField[];
    entries: CatalogGridEntry[];
    loading?: boolean;
    unpublishedFieldCount?: number;
    onSaveEntry: (data: Record<string, string>) => Promise<void>;
    onHideEntry: (entry: CatalogGridEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
    onDeleteEntry: (entry: CatalogGridEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
    onNotify: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
};

const NEW_ROW_ID = '__catalog_new_row__';

function rowsAreEqual(a: Record<string, string>, b: Record<string, string>) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if ((a[key] ?? '') !== (b[key] ?? '')) {
            return false;
        }
    }
    return true;
}

const CatalogGrid: React.FC<CatalogGridProps> = ({
    formId,
    catalogStatus,
    keyFieldId,
    labelFieldId,
    fields,
    entries,
    loading = false,
    unpublishedFieldCount = 0,
    onSaveEntry,
    onHideEntry,
    onDeleteEntry,
    onNotify,
}) => {
    const [rows, setRows] = useState<GridRow[]>([]);

    const buildRowsFromEntries = useCallback((sourceEntries: CatalogGridEntry[]): GridRow[] => {
        const existingRows: GridRow[] = sourceEntries.map((entry) => {
            const data = entryToRowData(entry, fields);
            const keyVal = keyFieldId ? String(data[keyFieldId] ?? entry.key_value ?? '') : '';
            return {
                rowId: entry.id,
                entryId: entry.id,
                originalKey: keyVal || null,
                isNew: false,
                data,
                baselineData: data,
                dirty: false,
                saving: false,
            };
        });

        const emptyRow = createEmptyRowData(fields);
        return [
            ...existingRows,
            {
                rowId: NEW_ROW_ID,
                entryId: null,
                originalKey: null,
                isNew: true,
                data: emptyRow,
                baselineData: emptyRow,
                dirty: false,
                saving: false,
            },
        ];
    }, [fields, keyFieldId]);

    useEffect(() => {
        setRows(buildRowsFromEntries(entries));
    }, [entries, buildRowsFromEntries]);

    const allRowData = useMemo(() => rows.map((row) => row.data), [rows]);

    const columnSuggestions = useMemo(() => {
        const map: Record<string, string[]> = {};
        fields.forEach((field) => {
            const bind = String(field.bind);
            map[bind] = buildColumnSuggestions(allRowData, bind, field);
        });
        return map;
    }, [allRowData, fields]);

    const updateRowData = (rowId: string, bind: string, value: string) => {
        setRows((prev) =>
            prev.map((row) => {
                if (row.rowId !== rowId) {
                    return row;
                }
                const nextData = { ...row.data, [bind]: value };
                return {
                    ...row,
                    data: nextData,
                    dirty: !rowsAreEqual(nextData, row.baselineData),
                };
            }),
        );
    };

    const validateRow = (data: Record<string, string>) => {
        if (!keyFieldId || !labelFieldId) {
            onNotify('Catalog not configured', 'Key and label fields must be designated in the builder.', 'error');
            return false;
        }
        if (!data[keyFieldId]?.trim() || !data[labelFieldId]?.trim()) {
            onNotify('Required fields missing', 'Key and label values are required.', 'info');
            return false;
        }
        return true;
    };

    const saveRow = async (rowId: string) => {
        const row = rows.find((item) => item.rowId === rowId);
        if (!row || row.saving || !row.dirty) {
            return;
        }
        if (!validateRow(row.data)) {
            return;
        }

        setRows((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, saving: true } : item)));
        try {
            await onSaveEntry(row.data);
            onNotify(row.isNew ? 'Entry added' : 'Entry updated', 'Catalog record saved.', 'success');
        } catch (error: any) {
            onNotify('Save failed', error?.response?.data?.detail || error?.message || 'Could not save catalog entry.', 'error');
        } finally {
            setRows((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, saving: false } : item)));
        }
    };

    const handleCellBlur = (rowId: string) => {
        const row = rows.find((item) => item.rowId === rowId);
        if (!row?.dirty || row.saving) {
            return;
        }
        void saveRow(rowId);
    };

    const generateKeyFromLabel = (rowId: string) => {
        if (!keyFieldId || !labelFieldId) {
            return;
        }
        const row = rows.find((item) => item.rowId === rowId);
        if (!row) {
            return;
        }
        const labelValue = row.data[labelFieldId]?.trim() ?? '';
        if (!labelValue) {
            onNotify('Label required', 'Enter a label value in this row first.', 'info');
            return;
        }
        const slug = slugifyCatalogKey(labelValue);
        if (!slug) {
            onNotify('Invalid label', 'The label must contain at least one letter or number.', 'info');
            return;
        }
        updateRowData(rowId, keyFieldId, slug);
    };

    const renderCellEditor = (row: GridRow, field: CatalogField) => {
        const bind = String(field.bind);
        const isKey = keyFieldId === bind;
        const isLabel = labelFieldId === bind;
        const keyLocked = isKey && !row.isNew;
        const datalistId = `catalog-${formId}-${bind}-suggestions`;
        const suggestions = columnSuggestions[bind] || [];
        const value = row.data[bind] ?? '';
        const inputClassName =
            'w-full min-w-[120px] bg-transparent border-0 outline-none text-xs text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-tertiary))] focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed';

        if (field.type === 'toggle') {
            return (
                <select
                    disabled={keyLocked || row.saving}
                    value={value === 'true' ? 'true' : value === 'false' ? 'false' : ''}
                    onChange={(e) => updateRowData(row.rowId, bind, e.target.value)}
                    onBlur={() => handleCellBlur(row.rowId)}
                    className={inputClassName}
                >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            );
        }

        const input = (
            <input
                type={field.type === 'input_number' ? 'number' : 'text'}
                list={suggestions.length > 0 ? datalistId : undefined}
                disabled={keyLocked || row.saving}
                value={value}
                placeholder={field.placeholder || (isKey ? 'Key' : isLabel ? 'Label' : 'Enter value...')}
                onChange={(e) => updateRowData(row.rowId, bind, e.target.value)}
                onBlur={() => handleCellBlur(row.rowId)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                className={`${inputClassName}${isKey ? ' font-mono' : ''}`}
            />
        );

        if (isKey && row.isNew) {
            return (
                <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">{input}</div>
                    <button
                        type="button"
                        disabled={row.saving || !(row.data[labelFieldId || '']?.trim())}
                        onClick={() => generateKeyFromLabel(row.rowId)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--primary))]/40 hover:bg-[hsl(var(--primary))]/10 hover:text-[hsl(var(--primary))] disabled:opacity-40"
                        title="Generate key from label"
                        aria-label="Generate key from label"
                    >
                        <Wand2 className="w-3 h-3" />
                    </button>
                </div>
            );
        }

        return input;
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
            </div>
        );
    }

    if (fields.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-xs italic text-[hsl(var(--text-tertiary))]">
                No fields defined in form canvas. Add fields in the catalog builder first.
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {catalogStatus !== 'live' && (
                <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 lg:mx-5">
                    Publish this catalog in the Form Builder before adding records.
                </div>
            )}
            {unpublishedFieldCount > 0 && (
                <div className="mx-4 mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-700 lg:mx-5">
                    {unpublishedFieldCount} unpublished field{unpublishedFieldCount === 1 ? '' : 's'} in the builder. Save and publish to show {unpublishedFieldCount === 1 ? 'it' : 'them'} here.
                </div>
            )}

            <div className="flex-1 overflow-auto p-4 lg:p-5">
                <div className="overflow-x-auto border border-[hsl(var(--border))]/50 rounded-xl bg-[hsl(var(--surface))]">
                    <table className="w-full border-collapse text-xs min-w-[720px]">
                        <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-elevated))]/95 backdrop-blur-sm">
                            <tr className="border-b border-[hsl(var(--border))]/50 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                <th className="w-8 p-2 text-center">#</th>
                                {fields.map((field) => {
                                    const bind = String(field.bind);
                                    const isKey = keyFieldId === bind;
                                    const isLabel = labelFieldId === bind;
                                    return (
                                        <th key={bind} className="p-2 text-left whitespace-nowrap min-w-[140px]">
                                            {field.label || bind}
                                            {isKey && <span className="ml-1 text-amber-600">⚿</span>}
                                            {isLabel && <span className="ml-1 text-blue-600">🏷</span>}
                                        </th>
                                    );
                                })}
                                <th className="p-2 text-right whitespace-nowrap w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[hsl(var(--border))]/40">
                            {rows.map((row, index) => (
                                <tr
                                    key={row.rowId}
                                    className={`group transition-colors ${
                                        row.isNew
                                            ? 'bg-[hsl(var(--primary))]/[0.03]'
                                            : row.dirty
                                                ? 'bg-amber-500/[0.04]'
                                                : 'hover:bg-[hsl(var(--surface-elevated))]/20'
                                    }`}
                                >
                                    <td className="p-2 text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                                        {row.isNew ? <Plus className="w-3 h-3 mx-auto text-[hsl(var(--primary))]" /> : index + 1}
                                    </td>
                                    {fields.map((field) => {
                                        const bind = String(field.bind);
                                        return (
                                            <td key={bind} className="p-1.5 align-middle border-r border-[hsl(var(--border))]/20 last:border-r-0">
                                                <div className="rounded-md border border-transparent px-2 py-1 focus-within:border-[hsl(var(--primary))]/30 focus-within:bg-[hsl(var(--surface))]">
                                                    {renderCellEditor(row, field)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="p-2 text-right align-middle">
                                        {row.isNew ? (
                                            <span className="text-[10px] text-[hsl(var(--text-tertiary))] italic">New row</span>
                                        ) : (
                                            <div className="inline-flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100">
                                                {row.saving ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(var(--primary))]" />
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                const entry = entries.find((item) => item.id === row.entryId);
                                                                if (entry) {
                                                                    onHideEntry(entry, event);
                                                                }
                                                            }}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--border))]/60 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]"
                                                            title="Hide from lookups"
                                                            aria-label="Hide from lookups"
                                                        >
                                                            <EyeOff className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                const entry = entries.find((item) => item.id === row.entryId);
                                                                if (entry) {
                                                                    onDeleteEntry(entry, event);
                                                                }
                                                            }}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-500/25 bg-rose-500/5 text-rose-600 hover:bg-rose-500/15"
                                                            title="Delete permanently"
                                                            aria-label="Delete permanently"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {fields.map((field) => {
                    const bind = String(field.bind);
                    const suggestions = columnSuggestions[bind] || [];
                    if (suggestions.length === 0) {
                        return null;
                    }
                    return (
                        <datalist key={bind} id={`catalog-${formId}-${bind}-suggestions`}>
                            {suggestions.map((option) => (
                                <option key={option} value={option} />
                            ))}
                        </datalist>
                    );
                })}
            </div>

            <div className="border-t border-[hsl(var(--border))] px-4 py-2 text-[10px] text-[hsl(var(--text-tertiary))] lg:px-5">
                Edit cells inline. Values from existing rows appear as suggestions. Changes save automatically when you leave a row.
            </div>
        </div>
    );
};

export default CatalogGrid;
