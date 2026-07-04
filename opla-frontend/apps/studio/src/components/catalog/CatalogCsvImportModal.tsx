import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, FileSpreadsheet, Loader2, Save, Wand2, X } from 'lucide-react';
import type { CatalogField } from '../../utils/catalogUtils';
import { slugifyCatalogKey } from '../../utils/catalogUtils';
import {
    autoMatchCatalogColumns,
    buildCatalogImportRows,
    decodeMappingValue,
    encodeGeneratorMapping,
    extractGeneratorTargets,
    getDirectlyMappedFieldBinds,
    isGeneratorMappingValue,
    parseCatalogPaste,
    validateCatalogImportRow,
    type CatalogColumnMapping,
    type CatalogFieldGeneratorType,
    type CatalogImportRow,
    type CatalogOrphanGenerators,
} from '../../utils/catalogCsvImport';

export type CatalogCsvImportModalProps = {
    open: boolean;
    onClose: () => void;
    fields: CatalogField[];
    keyFieldId?: string | null;
    labelFieldId?: string | null;
    onSaveEntry: (data: Record<string, string>) => Promise<void>;
    onNotify: (title: string, message?: string, type?: 'success' | 'error' | 'info') => void;
};

const pastePlaceholder = `CSV (comma or tab-separated):
Region,District
Greater Accra,Accra Metropolitan

Or JSON array:
[
  {"Region": "Greater Accra", "District": "Accra Metropolitan"}
]`;

function getFieldLabel(field: CatalogField | undefined, bind: string, keyFieldId?: string | null, labelFieldId?: string | null) {
    const name = field?.label || bind;
    if (bind === keyFieldId) {
        return `${name} (Key)`;
    }
    if (bind === labelFieldId) {
        return `${name} (Label)`;
    }
    return name;
}

function getMappingHelperText(
    value: string,
    fieldByBind: Map<string, CatalogField>,
    keyFieldId?: string | null,
    labelFieldId?: string | null,
): string | null {
    const decoded = decodeMappingValue(value);
    if (decoded.kind === 'generator') {
        const target = fieldByBind.get(decoded.bind);
        const targetLabel = getFieldLabel(target, decoded.bind, keyFieldId, labelFieldId);
        if (decoded.type === 'slug_from_label') {
            const labelName = labelFieldId ? getFieldLabel(fieldByBind.get(labelFieldId || ''), labelFieldId || '', keyFieldId, labelFieldId) : 'label';
            return `Slug from ${labelName} → ${targetLabel}`;
        }
        return `Auto ID → ${targetLabel} (item_0001, item_0002, …)`;
    }
    if (decoded.kind === 'field') {
        const field = fieldByBind.get(decoded.bind);
        if (decoded.bind === keyFieldId) {
            return 'Key field';
        }
        if (decoded.bind === labelFieldId) {
            return 'Label field';
        }
        return field?.required ? 'Required' : 'Optional';
    }
    return null;
}

type MappingSelectProps = {
    value: string;
    onChange: (value: string) => void;
    fields: CatalogField[];
    fieldByBind: Map<string, CatalogField>;
    keyFieldId?: string | null;
    labelFieldId?: string | null;
    usedFieldBinds: Set<string>;
    currentValue: string;
};

const MappingSelect: React.FC<MappingSelectProps> = ({
    value,
    onChange,
    fields,
    fieldByBind,
    keyFieldId,
    labelFieldId,
    usedFieldBinds,
    currentValue,
}) => {
    const isOptionDisabled = (optionValue: string) => {
        if (!optionValue || optionValue === currentValue) {
            return false;
        }
        const decoded = decodeMappingValue(optionValue);
        if (decoded.kind === 'skip') {
            return false;
        }
        return usedFieldBinds.has(decoded.bind);
    };

    const generatorOptions = fields
        .map((field) => String(field.bind || ''))
        .filter(Boolean)
        .flatMap((bind) => {
            const field = fieldByBind.get(bind);
            const fieldLabel = getFieldLabel(field, bind, keyFieldId, labelFieldId);
            const options: Array<{ value: string; label: string }> = [];

            if (bind === keyFieldId && labelFieldId) {
                options.push({
                    value: encodeGeneratorMapping('slug_from_label', bind),
                    label: `⚡ Slug from Label → ${fieldLabel}`,
                });
            }
            options.push({
                value: encodeGeneratorMapping('auto_id', bind),
                label: `⚡ Auto ID → ${fieldLabel}`,
            });
            return options;
        });

    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] px-2 py-1 text-xs outline-none focus:border-[hsl(var(--primary))]/50"
        >
            <option value="">— Skip —</option>
            {generatorOptions.length > 0 && (
                <optgroup label="Auto-generate">
                    {generatorOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={isOptionDisabled(opt.value)}>
                            {opt.label}
                        </option>
                    ))}
                </optgroup>
            )}
            <optgroup label="Catalog fields">
                {fields.map((field) => {
                    const bind = String(field.bind || '');
                    const isKey = bind === keyFieldId;
                    const isLabel = bind === labelFieldId;
                    return (
                        <option key={bind} value={bind} disabled={isOptionDisabled(bind)}>
                            {field.label || bind}
                            {isKey ? ' (Key)' : ''}
                            {isLabel ? ' (Label)' : ''}
                            {isOptionDisabled(bind) ? ' — in use' : ''}
                        </option>
                    );
                })}
            </optgroup>
        </select>
    );
};

const CatalogCsvImportModal: React.FC<CatalogCsvImportModalProps> = ({
    open,
    onClose,
    fields,
    keyFieldId,
    labelFieldId,
    onSaveEntry,
    onNotify,
}) => {
    const [pasteText, setPasteText] = useState('');
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [rawRows, setRawRows] = useState<Array<Record<string, string>>>([]);
    const [columnMapping, setColumnMapping] = useState<CatalogColumnMapping>({});
    const [orphanGenerators, setOrphanGenerators] = useState<CatalogOrphanGenerators>({});
    const [importRows, setImportRows] = useState<CatalogImportRow[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);
    const [savingAll, setSavingAll] = useState(false);

    const resetState = useCallback(() => {
        setPasteText('');
        setCsvHeaders([]);
        setRawRows([]);
        setColumnMapping({});
        setOrphanGenerators({});
        setImportRows([]);
        setParseError(null);
        setSavingAll(false);
    }, []);

    useEffect(() => {
        if (!open) {
            resetState();
        }
    }, [open, resetState]);

    const fieldByBind = useMemo(() => {
        const map = new Map<string, CatalogField>();
        fields.forEach((field) => {
            const bind = String(field.bind || '');
            if (bind) {
                map.set(bind, field);
            }
        });
        return map;
    }, [fields]);

    const generatorTargets = useMemo(
        () => extractGeneratorTargets(columnMapping, orphanGenerators),
        [columnMapping, orphanGenerators],
    );

    const usedFieldBinds = useMemo(() => {
        const binds = getDirectlyMappedFieldBinds(columnMapping);
        generatorTargets.forEach((_, bind) => binds.add(bind));
        return binds;
    }, [columnMapping, generatorTargets]);

    const unmappedFields = useMemo(() => {
        return fields.filter((field) => {
            const bind = String(field.bind || '');
            return bind && !usedFieldBinds.has(bind);
        });
    }, [fields, usedFieldBinds]);

    const refreshImportRows = useCallback((
        rows: Array<Record<string, string>>,
        mapping: CatalogColumnMapping,
        orphans: CatalogOrphanGenerators,
        preserveStatuses?: Map<string, CatalogImportRow['status']>,
    ) => {
        const built = buildCatalogImportRows(rows, mapping, fields, keyFieldId, labelFieldId, orphans);
        setImportRows((prev) => {
            const prevById = new Map(prev.map((row) => [row.id, row]));
            return built.map((row) => {
                const existing = prevById.get(row.id);
                const preservedStatus = preserveStatuses?.get(row.id) ?? existing?.status;
                if (preservedStatus === 'saved' || preservedStatus === 'failed') {
                    return {
                        ...row,
                        status: preservedStatus,
                        saveError: existing?.saveError,
                        generatorOverrides: existing?.generatorOverrides,
                    };
                }
                return row;
            });
        });
    }, [fields, keyFieldId, labelFieldId]);

    const handleParse = () => {
        const result = parseCatalogPaste(pasteText, fields, keyFieldId, labelFieldId);
        if (result.error) {
            setParseError(result.error);
            setCsvHeaders([]);
            setRawRows([]);
            setColumnMapping({});
            setOrphanGenerators({});
            setImportRows([]);
            return;
        }
        setParseError(null);
        setCsvHeaders(result.parsed.headers);
        setRawRows(result.parsed.rows);
        setColumnMapping(result.mapping);
        setOrphanGenerators(result.orphanGenerators);
        refreshImportRows(result.parsed.rows, result.mapping, result.orphanGenerators);
    };

    const clearOrphanForBind = (bind: string, orphans: CatalogOrphanGenerators) => {
        if (!orphans[bind]) {
            return orphans;
        }
        const next = { ...orphans };
        delete next[bind];
        return next;
    };

    const handleMappingChange = (csvHeader: string, value: string) => {
        const nextMapping = { ...columnMapping, [csvHeader]: value };
        let nextOrphans = { ...orphanGenerators };
        const decoded = decodeMappingValue(value);
        if (decoded.kind === 'field' || decoded.kind === 'generator') {
            nextOrphans = clearOrphanForBind(decoded.bind, nextOrphans);
        }
        setColumnMapping(nextMapping);
        setOrphanGenerators(nextOrphans);
        refreshImportRows(rawRows, nextMapping, nextOrphans);
    };

    const handleOrphanGeneratorChange = (bind: string, generator: CatalogFieldGeneratorType | '') => {
        let nextOrphans = { ...orphanGenerators };
        if (!generator) {
            delete nextOrphans[bind];
        } else {
            nextOrphans[bind] = generator;
        }
        const nextMapping = { ...columnMapping };
        Object.keys(nextMapping).forEach((header) => {
            const decoded = decodeMappingValue(nextMapping[header]);
            if (decoded.kind === 'generator' && decoded.bind === bind) {
                nextMapping[header] = '';
            }
        });
        setOrphanGenerators(nextOrphans);
        setColumnMapping(nextMapping);
        refreshImportRows(rawRows, nextMapping, nextOrphans);
    };

    const handleRematch = () => {
        const nextMapping = autoMatchCatalogColumns(csvHeaders, fields, keyFieldId, labelFieldId);
        let nextOrphans: CatalogOrphanGenerators = {};
        if (keyFieldId && labelFieldId) {
            const directBinds = getDirectlyMappedFieldBinds(nextMapping);
            if (!directBinds.has(keyFieldId) && directBinds.has(labelFieldId)) {
                nextOrphans[keyFieldId] = 'slug_from_label';
            }
        }
        setColumnMapping(nextMapping);
        setOrphanGenerators(nextOrphans);
        refreshImportRows(rawRows, nextMapping, nextOrphans);
    };

    const updateImportRowData = (rowId: string, bind: string, value: string) => {
        setImportRows((prev) =>
            prev.map((row) => {
                if (row.id !== rowId || row.status === 'saved' || row.status === 'saving') {
                    return row;
                }

                const overrides = new Set(row.generatorOverrides || []);
                if (generatorTargets.has(bind)) {
                    overrides.add(bind);
                }

                let nextData = { ...row.data, [bind]: value };

                if (
                    bind === labelFieldId
                    && keyFieldId
                    && generatorTargets.get(keyFieldId) === 'slug_from_label'
                    && !overrides.has(keyFieldId)
                ) {
                    nextData = { ...nextData, [keyFieldId]: slugifyCatalogKey(value) };
                }

                const errors = validateCatalogImportRow(nextData, fields, keyFieldId, labelFieldId);
                return {
                    ...row,
                    data: nextData,
                    errors,
                    generatorOverrides: overrides,
                    status: row.status === 'failed' ? 'pending' : row.status,
                    saveError: undefined,
                };
            }),
        );
    };

    const saveImportRow = async (rowId: string) => {
        const row = importRows.find((item) => item.id === rowId);
        if (!row || row.status === 'saving' || row.status === 'saved' || row.errors.length > 0) {
            return;
        }

        setImportRows((prev) => prev.map((item) => (item.id === rowId ? { ...item, status: 'saving' } : item)));

        try {
            await onSaveEntry(row.data);
            setImportRows((prev) =>
                prev.map((item) => (item.id === rowId ? { ...item, status: 'saved', saveError: undefined } : item)),
            );
            onNotify('Row saved', `Record ${row.sourceIndex} imported successfully.`, 'success');
        } catch (error: any) {
            const message = error?.response?.data?.detail || error?.message || 'Could not save catalog entry.';
            setImportRows((prev) =>
                prev.map((item) => (item.id === rowId ? { ...item, status: 'failed', saveError: message } : item)),
            );
            onNotify('Save failed', message, 'error');
        }
    };

    const saveAllImportRows = async () => {
        const pendingRows = importRows.filter(
            (row) => row.status === 'pending' || row.status === 'failed',
        ).filter((row) => row.errors.length === 0);

        if (pendingRows.length === 0) {
            onNotify('Nothing to save', 'No valid rows ready to import.', 'info');
            return;
        }

        setSavingAll(true);
        let saved = 0;
        let failed = 0;
        const skipped = importRows.filter((row) => row.errors.length > 0).length;

        for (const row of pendingRows) {
            setImportRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, status: 'saving' } : item)));
            try {
                await onSaveEntry(row.data);
                saved += 1;
                setImportRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, status: 'saved', saveError: undefined } : item)),
                );
            } catch (error: any) {
                failed += 1;
                const message = error?.response?.data?.detail || error?.message || 'Could not save catalog entry.';
                setImportRows((prev) =>
                    prev.map((item) => (item.id === row.id ? { ...item, status: 'failed', saveError: message } : item)),
                );
            }
        }

        setSavingAll(false);

        const parts = [`${saved} saved`];
        if (failed > 0) {
            parts.push(`${failed} failed`);
        }
        if (skipped > 0) {
            parts.push(`${skipped} skipped (validation)`);
        }
        onNotify(
            'Import complete',
            parts.join(', ') + '.',
            failed > 0 ? 'info' : 'success',
        );
    };

    const savableCount = importRows.filter(
        (row) => (row.status === 'pending' || row.status === 'failed') && row.errors.length === 0,
    ).length;
    const savedCount = importRows.filter((row) => row.status === 'saved').length;
    const hasParsedData = csvHeaders.length > 0 && importRows.length > 0;

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-5 py-4 border-b border-[hsl(var(--border))] flex items-center justify-between shrink-0 bg-[hsl(var(--surface-elevated))]/60">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[hsl(var(--text-primary))]">Import from CSV</h2>
                            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">
                                Paste data, map columns or use slug / auto ID generators. Save rows individually or all at once.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] p-1"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <section className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                Paste CSV or JSON
                            </label>
                            <button
                                type="button"
                                onClick={handleParse}
                                disabled={!pasteText.trim()}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 disabled:opacity-40"
                            >
                                Parse data
                            </button>
                        </div>
                        <textarea
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            className="w-full min-h-[120px] rounded-lg border border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] p-3 font-mono text-[11px] text-[hsl(var(--text-primary))] outline-none focus:border-[hsl(var(--primary))]/50 focus:ring-2 focus:ring-[hsl(var(--primary))]/10"
                            placeholder={pastePlaceholder}
                        />
                        {parseError && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-600">
                                {parseError}
                            </div>
                        )}
                    </section>

                    {hasParsedData && (
                        <>
                            <section className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                        Column mapping
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleRematch}
                                        className="text-[11px] font-semibold text-[hsl(var(--primary))] hover:underline"
                                    >
                                        Re-match columns
                                    </button>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]/50">
                                    <table className="w-full border-collapse text-xs min-w-[480px]">
                                        <thead className="bg-[hsl(var(--surface-elevated))]/80">
                                            <tr className="border-b border-[hsl(var(--border))]/50 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                                <th className="p-2 text-left">CSV column</th>
                                                <th className="p-2 text-left">Maps to</th>
                                                <th className="p-2 text-left">Sample</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[hsl(var(--border))]/40">
                                            {csvHeaders.map((header) => {
                                                const mappedValue = columnMapping[header] || '';
                                                const helperText = getMappingHelperText(mappedValue, fieldByBind, keyFieldId, labelFieldId);
                                                const isGenerator = isGeneratorMappingValue(mappedValue);
                                                const sample = isGenerator
                                                    ? '— (auto)'
                                                    : (rawRows[0]?.[header] ?? '');
                                                return (
                                                    <tr key={header}>
                                                        <td className="p-2 font-mono text-[hsl(var(--text-primary))]">{header}</td>
                                                        <td className="p-2">
                                                            <MappingSelect
                                                                value={mappedValue}
                                                                onChange={(next) => handleMappingChange(header, next)}
                                                                fields={fields}
                                                                fieldByBind={fieldByBind}
                                                                keyFieldId={keyFieldId}
                                                                labelFieldId={labelFieldId}
                                                                usedFieldBinds={usedFieldBinds}
                                                                currentValue={mappedValue}
                                                            />
                                                            {helperText && (
                                                                <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))] flex items-center gap-1">
                                                                    {isGenerator && <Wand2 className="w-3 h-3 shrink-0 text-[hsl(var(--primary))]" />}
                                                                    {helperText}
                                                                </p>
                                                            )}
                                                        </td>
                                                        <td className={`p-2 truncate max-w-[200px] ${isGenerator ? 'italic text-[hsl(var(--text-tertiary))]' : 'text-[hsl(var(--text-secondary))]'}`}>
                                                            {sample || '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {unmappedFields.length > 0 && (
                                <section className="space-y-2">
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                        Auto-fill unmapped fields
                                    </h3>
                                    <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                        These catalog fields are not mapped from any CSV column. Choose a generator or leave empty.
                                    </p>
                                    <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]/50">
                                        <table className="w-full border-collapse text-xs min-w-[480px]">
                                            <thead className="bg-[hsl(var(--surface-elevated))]/80">
                                                <tr className="border-b border-[hsl(var(--border))]/50 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                                    <th className="p-2 text-left">Catalog field</th>
                                                    <th className="p-2 text-left">Fill with</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[hsl(var(--border))]/40">
                                                {unmappedFields.map((field) => {
                                                    const bind = String(field.bind || '');
                                                    const currentOrphan = orphanGenerators[bind] || '';
                                                    return (
                                                        <tr key={bind}>
                                                            <td className="p-2 text-[hsl(var(--text-primary))]">
                                                                {getFieldLabel(field, bind, keyFieldId, labelFieldId)}
                                                            </td>
                                                            <td className="p-2">
                                                                <select
                                                                    value={currentOrphan}
                                                                    onChange={(e) => handleOrphanGeneratorChange(bind, e.target.value as CatalogFieldGeneratorType | '')}
                                                                    className="w-full rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--background))] px-2 py-1 text-xs outline-none focus:border-[hsl(var(--primary))]/50"
                                                                >
                                                                    <option value="">— Leave empty —</option>
                                                                    {bind === keyFieldId && labelFieldId && (
                                                                        <option value="slug_from_label">⚡ Slug from Label</option>
                                                                    )}
                                                                    <option value="auto_id">⚡ Auto ID (sequential)</option>
                                                                </select>
                                                                {currentOrphan === 'slug_from_label' && (
                                                                    <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))] flex items-center gap-1">
                                                                        <Wand2 className="w-3 h-3 text-[hsl(var(--primary))]" />
                                                                        Lowercase label with underscores (e.g. accra_metropolitan)
                                                                    </p>
                                                                )}
                                                                {currentOrphan === 'auto_id' && (
                                                                    <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))] flex items-center gap-1">
                                                                        <Wand2 className="w-3 h-3 text-[hsl(var(--primary))]" />
                                                                        item_0001, item_0002, … per row
                                                                    </p>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            <section className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                        Preview ({importRows.length} rows)
                                    </h3>
                                    <div className="flex items-center gap-2 text-[10px] text-[hsl(var(--text-tertiary))]">
                                        {savedCount > 0 && <span className="text-emerald-600">{savedCount} saved</span>}
                                        {savableCount > 0 && <span>{savableCount} ready</span>}
                                    </div>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]/50 max-h-[320px] overflow-y-auto">
                                    <table className="w-full border-collapse text-xs min-w-[720px]">
                                        <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-elevated))]/95">
                                            <tr className="border-b border-[hsl(var(--border))]/50 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                                <th className="w-8 p-2 text-center">#</th>
                                                <th className="w-20 p-2 text-left">Status</th>
                                                {fields.map((field) => {
                                                    const bind = String(field.bind || '');
                                                    const isGenerated = generatorTargets.has(bind);
                                                    return (
                                                        <th key={bind} className="p-2 text-left whitespace-nowrap min-w-[120px]">
                                                            {field.label || bind}
                                                            {isGenerated && (
                                                                <span className="ml-1 text-[hsl(var(--primary))]" title="Auto-generated">⚡</span>
                                                            )}
                                                        </th>
                                                    );
                                                })}
                                                <th className="p-2 text-right w-16">Save</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[hsl(var(--border))]/40">
                                            {importRows.map((row) => {
                                                const canSave = row.errors.length === 0 && (row.status === 'pending' || row.status === 'failed');
                                                return (
                                                    <tr
                                                        key={row.id}
                                                        className={
                                                            row.status === 'saved'
                                                                ? 'bg-emerald-500/[0.04]'
                                                                : row.errors.length > 0
                                                                    ? 'bg-amber-500/[0.04]'
                                                                    : row.status === 'failed'
                                                                        ? 'bg-red-500/[0.04]'
                                                                        : ''
                                                        }
                                                    >
                                                        <td className="p-2 text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                                                            {row.sourceIndex}
                                                        </td>
                                                        <td className="p-2">
                                                            {row.status === 'saving' && (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[hsl(var(--primary))]" />
                                                            )}
                                                            {row.status === 'saved' && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                                                                    <Check className="w-3 h-3" /> Saved
                                                                </span>
                                                            )}
                                                            {row.status === 'failed' && (
                                                                <span className="text-[10px] font-semibold text-red-600" title={row.saveError}>
                                                                    Failed
                                                                </span>
                                                            )}
                                                            {row.status === 'pending' && row.errors.length > 0 && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700" title={row.errors.join(', ')}>
                                                                    <AlertCircle className="w-3 h-3" /> Invalid
                                                                </span>
                                                            )}
                                                            {row.status === 'pending' && row.errors.length === 0 && (
                                                                <span className="text-[10px] text-[hsl(var(--text-tertiary))]">Ready</span>
                                                            )}
                                                        </td>
                                                        {fields.map((field) => {
                                                            const bind = String(field.bind || '');
                                                            const isSaved = row.status === 'saved' || row.status === 'saving';
                                                            const isGenerated = generatorTargets.has(bind) && !row.generatorOverrides?.has(bind);
                                                            return (
                                                                <td key={bind} className="p-1.5">
                                                                    <input
                                                                        type="text"
                                                                        disabled={isSaved}
                                                                        value={row.data[bind] ?? ''}
                                                                        onChange={(e) => updateImportRowData(row.id, bind, e.target.value)}
                                                                        title={isGenerated ? 'Auto-generated — edit to override' : undefined}
                                                                        className={`w-full min-w-[100px] rounded border border-transparent bg-transparent px-2 py-1 text-xs outline-none focus:border-[hsl(var(--primary))]/30 focus:bg-[hsl(var(--surface))] disabled:opacity-60 ${
                                                                            isGenerated ? 'italic text-[hsl(var(--primary))]/80 font-mono' : ''
                                                                        }`}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="p-2 text-right">
                                                            <button
                                                                type="button"
                                                                disabled={!canSave || row.status === 'saving'}
                                                                onClick={() => void saveImportRow(row.id)}
                                                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/20 disabled:opacity-40"
                                                                title={row.errors.length > 0 ? row.errors.join(', ') : 'Save this row'}
                                                            >
                                                                {row.status === 'saving' ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <Check className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {importRows.some((row) => row.errors.length > 0) && (
                                    <p className="text-[10px] text-amber-700">
                                        Rows with missing key, label, or required fields cannot be saved until you fix them, map columns, or use generators.
                                    </p>
                                )}
                            </section>
                        </>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-[hsl(var(--border))] flex items-center justify-between gap-3 shrink-0 bg-[hsl(var(--surface-elevated))]/40">
                    <p className="text-[10px] text-[hsl(var(--text-tertiary))] max-w-md">
                        Use slug or auto ID when your CSV has no key column. Save all imports valid rows and skips the rest.
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]"
                        >
                            {savedCount > 0 ? 'Done' : 'Cancel'}
                        </button>
                        {hasParsedData && (
                            <button
                                type="button"
                                disabled={savingAll || savableCount === 0}
                                onClick={() => void saveAllImportRows()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] disabled:opacity-40"
                            >
                                {savingAll ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Save className="w-3.5 h-3.5" />
                                )}
                                Save all ({savableCount})
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CatalogCsvImportModal;
