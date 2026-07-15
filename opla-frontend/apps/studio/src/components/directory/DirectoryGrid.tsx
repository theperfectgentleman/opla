import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, EyeOff, FileSpreadsheet, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import DirectoryCsvImportModal from './DirectoryCsvImportModal';
import {
    buildColumnSuggestions,
    createEmptyRowData,
    entryToRowData,
    slugifyDirectoryKey,
} from '../../utils/directoryUtils';
import type { DirectoryField } from '../../utils/directoryUtils';

export type DirectoryGridEntry = {
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

export type DirectoryGridProps = {
    formId: string;
    directoryTitle: string;
    directoryStatus?: string;
    keyFieldId?: string | null;
    labelFieldId?: string | null;
    fields: DirectoryField[];
    entries: DirectoryGridEntry[];
    loading?: boolean;
    unpublishedFieldCount?: number;
    onSaveEntry: (data: Record<string, string>) => Promise<void>;
    onHideEntry: (entry: DirectoryGridEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
    onDeleteEntry: (entry: DirectoryGridEntry, event: React.MouseEvent<HTMLButtonElement>) => void;
    onNotify: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
};

const NEW_ROW_ID = '__directory_new_row__';

const cellInputClassName =
    'w-full min-w-[120px] bg-transparent border-0 outline-none text-xs text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-tertiary))] focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed';

const themedSelectClassName =
    'w-full min-w-[120px] rounded-md border-0 bg-transparent text-xs text-[hsl(var(--text-primary))] outline-none focus:ring-0 disabled:opacity-60 disabled:cursor-not-allowed';

function rowsAreEqual(a: Record<string, string>, b: Record<string, string>) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
        if ((a[key] ?? '') !== (b[key] ?? '')) {
            return false;
        }
    }
    return true;
}

type DirectorySuggestInputProps = {
    value: string;
    suggestions: string[];
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    onChange: (value: string) => void;
    onEnter: () => void;
};

const DirectorySuggestInput: React.FC<DirectorySuggestInputProps> = ({
    value,
    suggestions,
    disabled,
    placeholder,
    className = '',
    onChange,
    onEnter,
}) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredSuggestions = useMemo(() => {
        const query = value.trim().toLowerCase();
        const pool = query
            ? suggestions.filter((item) => item.toLowerCase().includes(query))
            : suggestions;
        return pool.slice(0, 12);
    }, [suggestions, value]);

    useEffect(() => {
        setActiveIndex(0);
    }, [filteredSuggestions]);

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    const pickSuggestion = (suggestion: string) => {
        onChange(suggestion);
        setOpen(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            setOpen(false);
            onEnter();
            return;
        }

        if (!open || filteredSuggestions.length === 0) {
            if (event.key === 'ArrowDown' && suggestions.length > 0) {
                setOpen(true);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((prev) => (prev + 1) % filteredSuggestions.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        } else if (event.key === 'Escape') {
            setOpen(false);
        } else if (event.key === 'Tab' && filteredSuggestions[activeIndex]) {
            event.preventDefault();
            pickSuggestion(filteredSuggestions[activeIndex]);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <input
                type="text"
                disabled={disabled}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => setOpen(suggestions.length > 0)}
                onKeyDown={handleKeyDown}
                className={`${cellInputClassName} ${className}`}
                autoComplete="off"
            />
            {open && filteredSuggestions.length > 0 && (
                <ul
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))] py-1 shadow-lg"
                    role="listbox"
                >
                    {filteredSuggestions.map((suggestion, index) => (
                        <li key={suggestion} role="option" aria-selected={index === activeIndex}>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickSuggestion(suggestion)}
                                className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors ${
                                    index === activeIndex
                                        ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                        : 'text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))]'
                                }`}
                            >
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const DirectoryGrid: React.FC<DirectoryGridProps> = ({
    directoryStatus,
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
    const [importOpen, setImportOpen] = useState(false);

    const buildRowsFromEntries = useCallback((sourceEntries: DirectoryGridEntry[]): GridRow[] => {
        return sourceEntries.map((entry) => {
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
    }, [fields, keyFieldId]);

    useEffect(() => {
        setRows(buildRowsFromEntries(entries));
    }, [entries, buildRowsFromEntries]);

    const hasDraftNewRow = rows.some((row) => row.isNew);

    const savedRowData = useMemo(
        () => rows.filter((row) => !row.isNew).map((row) => row.data),
        [rows],
    );

    const columnSuggestions = useMemo(() => {
        const map: Record<string, string[]> = {};
        fields.forEach((field) => {
            const bind = String(field.bind);
            if (bind === keyFieldId) {
                map[bind] = [];
                return;
            }
            map[bind] = buildColumnSuggestions(savedRowData, bind, field);
        });
        return map;
    }, [fields, keyFieldId, savedRowData]);

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
            onNotify('Directory not configured', 'Key and label fields must be designated in the builder.', 'error');
            return false;
        }
        if (!data[keyFieldId]?.trim()) {
            onNotify('Key required', 'Enter a unique key value before saving.', 'info');
            return false;
        }
        if (!data[labelFieldId]?.trim()) {
            onNotify('Label required', 'Enter a label value before saving.', 'info');
            return false;
        }
        for (const field of fields) {
            const bind = String(field.bind);
            if (field.required && !data[bind]?.trim()) {
                onNotify('Required field missing', `${field.label || bind} is required.`, 'info');
                return false;
            }
        }
        return true;
    };

    const saveRow = async (rowId: string) => {
        const rowToSave = rows.find((item) => item.rowId === rowId);
        if (!rowToSave || rowToSave.saving || !rowToSave.dirty) {
            return;
        }

        if (!validateRow(rowToSave.data)) {
            return;
        }

        setRows((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, saving: true } : item)));

        try {
            await onSaveEntry(rowToSave.data);
            onNotify(rowToSave.isNew ? 'Entry added' : 'Entry updated', 'Directory record saved.', 'success');
        } catch (error: any) {
            onNotify('Save failed', error?.response?.data?.detail || error?.message || 'Could not save directory entry.', 'error');
            setRows((prev) => prev.map((item) => (item.rowId === rowId ? { ...item, saving: false } : item)));
        }
    };

    const addNewRow = () => {
        if (hasDraftNewRow) {
            return;
        }
        const emptyRow = createEmptyRowData(fields);
        setRows((prev) => [
            ...prev,
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
        ]);
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
        const slug = slugifyDirectoryKey(labelValue);
        if (!slug) {
            onNotify('Invalid label', 'The label must contain at least one letter or number.', 'info');
            return;
        }
        updateRowData(rowId, keyFieldId, slug);
    };

    const renderCellEditor = (row: GridRow, field: DirectoryField) => {
        const bind = String(field.bind);
        const isKey = keyFieldId === bind;
        const isLabel = labelFieldId === bind;
        const keyLocked = isKey && !row.isNew;
        const suggestions = columnSuggestions[bind] || [];
        const value = row.data[bind] ?? '';
        const handleEnter = () => void saveRow(row.rowId);

        if (field.type === 'toggle') {
            return (
                <select
                    disabled={keyLocked || row.saving}
                    value={value === 'true' ? 'true' : value === 'false' ? 'false' : ''}
                    onChange={(e) => updateRowData(row.rowId, bind, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void saveRow(row.rowId);
                        }
                    }}
                    className={themedSelectClassName}
                >
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </select>
            );
        }

        const plainInput = (
            <input
                type={field.type === 'input_number' ? 'number' : 'text'}
                disabled={keyLocked || row.saving}
                value={value}
                placeholder={field.placeholder || (isKey ? 'Key' : isLabel ? 'Label' : 'Enter value...')}
                onChange={(e) => updateRowData(row.rowId, bind, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void saveRow(row.rowId);
                    }
                }}
                className={`${cellInputClassName}${isKey ? ' font-mono' : ''}`}
                autoComplete="off"
            />
        );

        const suggestInput = (
            <DirectorySuggestInput
                value={value}
                suggestions={suggestions}
                disabled={keyLocked || row.saving}
                placeholder={field.placeholder || (isLabel ? 'Label' : 'Enter value...')}
                className={isKey ? 'font-mono' : ''}
                onChange={(next) => updateRowData(row.rowId, bind, next)}
                onEnter={handleEnter}
            />
        );

        const input = isKey || suggestions.length === 0 ? plainInput : suggestInput;

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

    const renderRowActions = (row: GridRow) => {
        if (row.saving) {
            return <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(var(--primary))]" />;
        }

        if (row.isNew) {
            return (
                <button
                    type="button"
                    onClick={() => void saveRow(row.rowId)}
                    disabled={!row.dirty}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    title="Save new record"
                    aria-label="Save new record"
                >
                    <Check className="w-3.5 h-3.5" />
                </button>
            );
        }

        return (
            <div className="inline-flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100">
                {row.dirty && (
                    <button
                        type="button"
                        onClick={() => void saveRow(row.rowId)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-colors"
                        title="Save changes"
                        aria-label="Save changes"
                    >
                        <Check className="w-3.5 h-3.5" />
                    </button>
                )}
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
            </div>
        );
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
                No fields defined in form canvas. Add fields in the directory builder first.
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {directoryStatus !== 'live' && (
                <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 lg:mx-5">
                    Publish this directory in the Form Builder before adding records.
                </div>
            )}
            {unpublishedFieldCount > 0 && (
                <div className="mx-4 mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-700 lg:mx-5">
                    {unpublishedFieldCount} unpublished field{unpublishedFieldCount === 1 ? '' : 's'} in the builder. Save and publish to show {unpublishedFieldCount === 1 ? 'it' : 'them'} here.
                </div>
            )}

            <div className="flex items-center justify-end gap-2 px-4 pt-4 lg:px-5">
                <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    disabled={!keyFieldId || !labelFieldId || directoryStatus !== 'live'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface-elevated))]/50 px-2.5 py-1.5 text-[11px] font-semibold text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                        directoryStatus !== 'live'
                            ? 'Publish the directory before importing'
                            : !keyFieldId || !labelFieldId
                                ? 'Designate key and label fields in the builder first'
                                : 'Paste CSV or JSON to import records'
                    }
                >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Import CSV
                </button>
                <button
                    type="button"
                    onClick={addNewRow}
                    disabled={hasDraftNewRow}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    title={hasDraftNewRow ? 'Finish the current new row first' : 'Add a new record'}
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add record
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 lg:p-5 pt-3">
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
                            {rows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={fields.length + 2}
                                        className="p-8 text-center text-[11px] italic text-[hsl(var(--text-tertiary))]"
                                    >
                                        No records yet. Click Add record to create the first entry.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, index) => (
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
                                            {row.isNew ? '·' : index + 1}
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
                                        <td className="p-2 text-right align-middle">{renderRowActions(row)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="border-t border-[hsl(var(--border))] px-4 py-2 text-[10px] text-[hsl(var(--text-tertiary))] lg:px-5">
                Use Add record or Import CSV to add rows. Other columns suggest values from existing data. Press Enter or click save when key, label, and required fields are filled.
            </div>

            <DirectoryCsvImportModal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                fields={fields}
                keyFieldId={keyFieldId}
                labelFieldId={labelFieldId}
                onSaveEntry={onSaveEntry}
                onNotify={onNotify}
            />
        </div>
    );
};

export default DirectoryGrid;
