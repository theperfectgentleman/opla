import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Columns3, FlaskConical, Link2, Loader2, Plus, Save, Search, Table2, Trash2, Unlink, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { analyticsAPI } from '../../lib/api';
import { defaultSource } from './queryUtils';
import type { AnalyticsToolProps } from './types';
import { evaluateCalculatedColumn, validateFormula } from './excelFormulas';
import FormulaEditor from './FormulaEditor';
import {
	applyPrepFormulas,
	clampPrepColumnWidth,
	columnsFromDerivedMeta,
	fieldsToPrepColumns,
	loadPrepColumnWidths,
	PREP_DEFAULT_COL_WIDTH,
	PREP_INDEX_COL_WIDTH,
	savePrepColumnWidths,
	savePrepSession,
	sourceLabel,
	type PrepColumn,
} from './prepSession';
import { PrepCell, isImageFieldType, resolveCellKind } from './prepCellFormat';
import {
	buildValueLabelMaps,
	resolveDisplayValue,
	type DisplayMode,
} from './valueLabels';
import { analyticsButtonClass, analyticsGhostButtonClass, analyticsInputClass, analyticsLabelClass } from './ui';

const ROW_LIMIT = 5000;

type ColumnFilterMode = 'all' | 'selected' | 'unselected';

function CompactColumnPicker({
	columns,
	selectedKeys,
	onToggle,
	onSelectKeys,
	onClearKeys,
	autoFocusSearch = false,
	maxHeightClass = 'max-h-80',
	emptyLabel = 'No columns match.',
}: {
	columns: PrepColumn[];
	selectedKeys: Set<string> | string[];
	onToggle: (column: PrepColumn, enabled: boolean) => void;
	/** Select these keys (usually the currently filtered set). */
	onSelectKeys: (keys: string[]) => void;
	onClearKeys: (keys: string[]) => void;
	autoFocusSearch?: boolean;
	maxHeightClass?: string;
	emptyLabel?: string;
}) {
	const searchRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState('');
	const [filterMode, setFilterMode] = useState<ColumnFilterMode>('all');

	const selectedSet = useMemo(
		() => (selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys)),
		[selectedKeys],
	);

	useEffect(() => {
		if (autoFocusSearch) {
			const id = window.setTimeout(() => searchRef.current?.focus(), 40);
			return () => window.clearTimeout(id);
		}
	}, [autoFocusSearch]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return columns.filter(column => {
			const checked = selectedSet.has(column.key);
			if (filterMode === 'selected' && !checked) return false;
			if (filterMode === 'unselected' && checked) return false;
			if (!q) return true;
			return (
				column.label.toLowerCase().includes(q) ||
				column.key.toLowerCase().includes(q) ||
				String(column.field_type || '')
					.toLowerCase()
					.includes(q)
			);
		});
	}, [columns, filterMode, query, selectedSet]);

	const filteredKeys = useMemo(() => filtered.map(column => column.key), [filtered]);
	const filteredSelectedCount = filtered.filter(column => selectedSet.has(column.key)).length;
	const totalSelected = columns.reduce((count, column) => count + (selectedSet.has(column.key) ? 1 : 0), 0);

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-[12rem] flex-1">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
					<input
						ref={searchRef}
						value={query}
						onChange={event => setQuery(event.target.value)}
						placeholder="Search columns…"
						className="h-8 w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100"
					/>
					{query ? (
						<button
							type="button"
							onClick={() => setQuery('')}
							className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
							aria-label="Clear search"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					) : null}
				</div>
				<div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold">
					{(
						[
							['all', 'All'],
							['selected', 'On'],
							['unselected', 'Off'],
						] as const
					).map(([mode, label]) => (
						<button
							key={mode}
							type="button"
							onClick={() => setFilterMode(mode)}
							className={`rounded px-2 py-1 ${
								filterMode === mode ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
							}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
				<span>
					{totalSelected.toLocaleString()} of {columns.length.toLocaleString()} selected
					{query || filterMode !== 'all'
						? ` · showing ${filtered.length.toLocaleString()} (${filteredSelectedCount} on)`
						: ''}
				</span>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => onSelectKeys(filteredKeys)}
						disabled={!filteredKeys.length}
						className="rounded border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
					>
						Select shown
					</button>
					<button
						type="button"
						onClick={() => onClearKeys(filteredKeys)}
						disabled={!filteredKeys.length}
						className="rounded border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
					>
						Clear shown
					</button>
				</div>
			</div>

			<div className={`overflow-auto rounded-md border border-slate-200 bg-white ${maxHeightClass}`}>
				{filtered.length === 0 ? (
					<div className="px-3 py-8 text-center text-xs text-slate-500">{emptyLabel}</div>
				) : (
					<ul className="divide-y divide-slate-100">
						{filtered.map(column => {
							const checked = selectedSet.has(column.key);
							return (
								<li key={column.key}>
									<label
										className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm hover:bg-slate-50 ${
											checked ? 'bg-emerald-50/40' : ''
										}`}
									>
										<input
											type="checkbox"
											checked={checked}
											onChange={event => onToggle(column, event.target.checked)}
											className="shrink-0"
										/>
										<span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={column.label}>
											{column.label}
										</span>
										<span className="hidden max-w-[9rem] truncate font-mono text-[10px] text-slate-400 sm:inline" title={column.key}>
											{column.key}
										</span>
										{column.field_type ? (
											<span className="hidden shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 md:inline">
												{String(column.field_type).replace(/_/g, ' ').slice(0, 12)}
											</span>
										) : null}
										{column.calculated ? (
											<span className="shrink-0 text-[10px] font-semibold text-emerald-700">calc</span>
										) : null}
									</label>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

export default function PrepTable({ orgId, projectId, sources, initialSource, onSourcesChanged }: AnalyticsToolProps) {
	const navigate = useNavigate();
	const fallback = defaultSource(sources, initialSource);
	const [datasetId, setDatasetId] = useState(fallback?.dataset_id ?? '');
	const [columns, setColumns] = useState<PrepColumn[]>([]);
	/** Source fields available to toggle on/off (excludes calculated). */
	const [availableColumns, setAvailableColumns] = useState<PrepColumn[]>([]);
	const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [formulaName, setFormulaName] = useState('');
	const [formulaText, setFormulaText] = useState('=');
	const [formulaError, setFormulaError] = useState<string | null>(null);
	const [showFormula, setShowFormula] = useState(false);
	const [showColumns, setShowColumns] = useState(false);

	const [showSave, setShowSave] = useState(false);
	const [saveName, setSaveName] = useState('');
	const [saveMode, setSaveMode] = useState<'snapshot' | 'linked'>('snapshot');
	const [saveSelectedKeys, setSaveSelectedKeys] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
	const [displayMode, setDisplayMode] = useState<DisplayMode>('label');
	const columnWidthsRef = useRef(columnWidths);
	const resizeStateRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
	columnWidthsRef.current = columnWidths;

	const selectedSource = useMemo(
		() => sources.find(source => source.dataset_id === datasetId) ?? null,
		[datasetId, sources],
	);

	const formulaColumns = useMemo(() => columns, [columns]);

	const valueLabelMaps = useMemo(() => buildValueLabelMaps(columns), [columns]);
	const hasChoiceFields = valueLabelMaps.size > 0;

	const selectedKeySet = useMemo(() => new Set(columns.map(column => column.key)), [columns]);

	const tableMinWidth = useMemo(() => {
		const cols = columns.reduce(
			(sum, column) => sum + (columnWidths[column.key] ?? PREP_DEFAULT_COL_WIDTH),
			0,
		);
		return cols + PREP_INDEX_COL_WIDTH;
	}, [columnWidths, columns]);

	useEffect(() => {
		if (!datasetId && fallback) setDatasetId(fallback.dataset_id);
	}, [datasetId, fallback]);

	useEffect(() => {
		if (!orgId || !datasetId) {
			setColumnWidths({});
			return;
		}
		setColumnWidths(loadPrepColumnWidths(orgId, datasetId));
	}, [orgId, datasetId]);

	useEffect(() => {
		const onMove = (event: MouseEvent) => {
			const state = resizeStateRef.current;
			if (!state) return;
			const next = clampPrepColumnWidth(state.startWidth + (event.clientX - state.startX));
			setColumnWidths(prev => {
				if (prev[state.key] === next) return prev;
				return { ...prev, [state.key]: next };
			});
		};
		const onUp = () => {
			if (!resizeStateRef.current) return;
			resizeStateRef.current = null;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			if (orgId && datasetId) {
				savePrepColumnWidths(orgId, datasetId, columnWidthsRef.current);
			}
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	}, [datasetId, orgId]);

	function startColumnResize(key: string, event: ReactMouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const startWidth = columnWidths[key] ?? PREP_DEFAULT_COL_WIDTH;
		resizeStateRef.current = { key, startX: event.clientX, startWidth };
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function resetColumnWidth(key: string) {
		setColumnWidths(prev => {
			const next = { ...prev };
			delete next[key];
			if (orgId && datasetId) savePrepColumnWidths(orgId, datasetId, next);
			return next;
		});
	}

	function widthFor(key: string) {
		return columnWidths[key] ?? PREP_DEFAULT_COL_WIDTH;
	}

	useEffect(() => {
		if (!selectedSource) return;

		let cancelled = false;
		const load = async () => {
			setLoading(true);
			setError(null);
			setShowFormula(false);
			setShowColumns(false);
			try {
				const isLinked = selectedSource.derived?.mode === 'linked';
				const parentSource = selectedSource.derived?.parent_dataset_id
					? sources.find(source => source.dataset_id === selectedSource.derived?.parent_dataset_id) ?? null
					: null;

				// Full source field catalog for the column picker
				const catalog: PrepColumn[] = parentSource
					? fieldsToPrepColumns(parentSource.fields)
					: fieldsToPrepColumns(
							selectedSource.fields.filter(field => !field.field_key.startsWith('calc_')),
						);

				// Load all catalog fields so users can add/remove without re-fetching
				const selectKeys = catalog.length
					? catalog.map(column => column.key)
					: selectedSource.fields.map(field => field.field_key);

				const response = await analyticsAPI.runQuery(orgId, {
					dataset_id: selectedSource.dataset_id,
					select_fields: selectKeys,
					limit: ROW_LIMIT,
					offset: 0,
				});
				if (cancelled) return;

				const responseDerived = response.derived as typeof selectedSource.derived | undefined;
				const metaColumns = columnsFromDerivedMeta(
					responseDerived?.columns || selectedSource.derived?.columns,
				);

				// If this is a saved derived table, restore its column selection; otherwise start with all.
				const catalogByKey = new Map(catalog.map(column => [column.key, column]));
				let nextColumns: PrepColumn[] =
					metaColumns.length > 0
						? metaColumns.map(column => ({
								...column,
								options: column.options ?? catalogByKey.get(column.key)?.options ?? null,
							}))
						: catalog.length > 0
							? catalog
							: fieldsToPrepColumns(selectedSource.fields);
				let nextRows: Array<Record<string, unknown>> = response.rows ?? [];

				if (isLinked || responseDerived?.mode === 'linked') {
					const applied = applyPrepFormulas(nextRows, nextColumns);
					if (applied.error) {
						setError(applied.error);
					}
					nextRows = applied.rows;
				}

				// Expand catalog with any base fields present in the derived selection
				const catalogKeys = new Set(catalog.map(column => column.key));
				const mergedCatalog = [...catalog];
				for (const column of nextColumns) {
					if (!column.calculated && !catalogKeys.has(column.key)) {
						mergedCatalog.push({
							key: column.key,
							label: column.label,
							field_type: column.field_type,
							calculated: false,
						});
						catalogKeys.add(column.key);
					}
				}

				setAvailableColumns(mergedCatalog);
				setColumns(nextColumns);
				setRows(nextRows);
				if (!nextRows.length) setError('Dataset has no rows yet.');
			} catch (loadError: any) {
				if (cancelled) return;
				setAvailableColumns([]);
				setColumns([]);
				setRows([]);
				setError(loadError?.response?.data?.detail || loadError?.message || 'Could not load dataset.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		void load();
		return () => {
			cancelled = true;
		};
	}, [orgId, selectedSource, sources]);

	function handleAddCalculatedColumn() {
		const name = formulaName.trim() || 'Calculated';
		const key = `calc_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field'}`;
		if (columns.some(column => column.key === key || column.label.toLowerCase() === name.toLowerCase())) {
			setFormulaError('A column with that name already exists.');
			return;
		}

		const invalid = validateFormula(formulaText, columns);
		if (invalid) {
			setFormulaError(invalid);
			return;
		}

		const { values, error: evalError } = evaluateCalculatedColumn(rows, columns, formulaText);
		if (evalError) {
			setFormulaError(evalError);
			return;
		}

		const nextColumn: PrepColumn = {
			key,
			label: name,
			field_type: 'number',
			calculated: true,
			formula: formulaText.trim().startsWith('=') ? formulaText.trim() : `=${formulaText.trim()}`,
		};

		setColumns(prev => [...prev, nextColumn]);
		setRows(prev => prev.map((row, index) => ({ ...row, [key]: values[index] })));
		setFormulaName('');
		setFormulaText('=');
		setFormulaError(null);
		setShowFormula(false);
	}

	function handleRemoveColumn(key: string) {
		setColumns(prev => prev.filter(column => column.key !== key));
		const removed = columns.find(column => column.key === key);
		if (removed?.calculated) {
			setRows(prev =>
				prev.map(row => {
					const next = { ...row };
					delete next[key];
					return next;
				}),
			);
		}
	}

	function toggleSourceColumn(column: PrepColumn, enabled: boolean) {
		if (enabled) {
			setColumns(prev => {
				if (prev.some(item => item.key === column.key)) return prev;
				// Insert source columns before calculated ones to keep a natural order
				const calc = prev.filter(item => item.calculated);
				const base = prev.filter(item => !item.calculated);
				return [...base, column, ...calc];
			});
			return;
		}
		handleRemoveColumn(column.key);
	}

	function selectSourceColumnKeys(keys: string[]) {
		const enable = new Set(keys);
		setColumns(prev => {
			const existing = new Set(prev.map(item => item.key));
			const calc = prev.filter(item => item.calculated);
			const base = prev.filter(item => !item.calculated);
			const additions = availableColumns.filter(item => enable.has(item.key) && !existing.has(item.key));
			return [...base, ...additions, ...calc];
		});
	}

	function clearSourceColumnKeys(keys: string[]) {
		const remove = new Set(keys);
		setColumns(prev => prev.filter(item => item.calculated || !remove.has(item.key)));
	}

	function setAllSourceColumns(enabled: boolean) {
		const calc = columns.filter(column => column.calculated);
		setColumns(enabled ? [...availableColumns, ...calc] : [...calc]);
	}

	function handleOpenInWalker() {
		if (!selectedSource || !rows.length || !columns.length) return;
		const projectedRows = rows.map(row => {
			const next: Record<string, unknown> = {};
			for (const column of columns) {
				next[column.key] = row[column.key];
			}
			return next;
		});
		savePrepSession({
			orgId,
			datasetId: selectedSource.dataset_id,
			datasetLabel: sourceLabel(selectedSource),
			columns,
			rows: projectedRows,
			displayMode,
			createdAt: new Date().toISOString(),
		});
		navigate('/dashboard?tab=analysis&tool=lab&from=prep');
	}

	function openSaveModal() {
		const base = selectedSource ? sourceLabel(selectedSource).replace(/ \((snapshot|linked)\)$/, '') : 'Prepared table';
		setSaveName(`${base} prepared`);
		setSaveMode('snapshot');
		setSaveSelectedKeys(columns.map(column => column.key));
		setSaveError(null);
		setShowSave(true);
		setShowColumns(false);
	}

	function toggleSaveColumn(key: string, enabled: boolean) {
		setSaveSelectedKeys(prev => {
			if (enabled) return prev.includes(key) ? prev : [...prev, key];
			return prev.filter(item => item !== key);
		});
	}

	async function handleSaveTable() {
		if (!selectedSource || !columns.length) return;
		const name = saveName.trim();
		if (!name) {
			setSaveError('Enter a name for the table.');
			return;
		}

		const selectedColumns = columns.filter(column => saveSelectedKeys.includes(column.key));
		if (!selectedColumns.length) {
			setSaveError('Select at least one column to save.');
			return;
		}

		const targetProjectId = projectId || selectedSource.project_id;
		if (!targetProjectId) {
			setSaveError('This dataset has no project. Open Analysis from a project workspace to save.');
			return;
		}

		setSaving(true);
		setSaveError(null);
		try {
			const projectedRows =
				saveMode === 'snapshot'
					? rows.map(row => {
							const next: Record<string, unknown> = {};
							for (const column of selectedColumns) {
								next[column.key] = row[column.key];
							}
							return next;
						})
					: [];

			const result = await analyticsAPI.saveDerivedDataset(orgId, {
				name,
				mode: saveMode,
				parent_dataset_id: selectedSource.derived?.parent_dataset_id || selectedSource.dataset_id,
				project_id: targetProjectId,
				columns: selectedColumns.map(column => ({
					key: column.key,
					label: column.label,
					field_type: column.field_type,
					calculated: Boolean(column.calculated),
					formula: column.formula || null,
				})),
				rows: projectedRows,
			});
			await onSourcesChanged?.();
			setShowSave(false);
			if (result?.dataset_id) {
				setDatasetId(result.dataset_id);
			}
		} catch (err: any) {
			setSaveError(err?.response?.data?.detail || err?.message || 'Could not save table.');
		} finally {
			setSaving(false);
		}
	}

	if (sources.length === 0) {
		return <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">No datasets yet.</div>;
	}

	return (
		<div className="flex min-h-[calc(100vh-11rem)] flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
				<span className="inline-flex items-center gap-1 px-1 text-xs font-semibold text-slate-500">
					<Table2 className="h-3.5 w-3.5" />
					Prep
				</span>

				<select
					value={datasetId}
					onChange={event => setDatasetId(event.target.value)}
					className="h-8 min-w-[14rem] flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-100 sm:max-w-md"
					aria-label="Dataset"
				>
					{sources.map(source => (
						<option key={source.dataset_id} value={source.dataset_id}>
							{sourceLabel(source)} ({source.record_count.toLocaleString()})
						</option>
					))}
				</select>

				<span className="hidden text-xs text-slate-500 sm:inline">
					{loading ? 'Loading…' : `${rows.length.toLocaleString()} rows · ${columns.length} cols`}
					{selectedSource?.derived?.mode === 'linked' ? ' · live-linked' : null}
					{selectedSource?.derived?.mode === 'snapshot' ? ' · snapshot' : null}
				</span>

				<div className="ml-auto flex items-center gap-1.5">
					{error ? <span className="max-w-[14rem] truncate text-xs text-rose-600" title={error}>{error}</span> : null}
					{hasChoiceFields ? (
						<div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-0.5" title="Toggle choice codes vs readable labels">
							<button
								type="button"
								onClick={() => setDisplayMode('label')}
								className={`rounded px-2 py-1 text-[11px] font-semibold ${displayMode === 'label' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
							>
								Labels
							</button>
							<button
								type="button"
								onClick={() => setDisplayMode('value')}
								className={`rounded px-2 py-1 text-[11px] font-semibold ${displayMode === 'value' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
							>
								Values
							</button>
						</div>
					) : (
						<div
							className="flex items-center gap-1 rounded-md border border-dashed border-slate-200 px-2 py-1 text-[11px] text-slate-400"
							title="No choice options found on this dataset yet"
						>
							Labels/Values
						</div>
					)}
					<button
						type="button"
						onClick={() => {
							setShowColumns(prev => !prev);
							setShowFormula(false);
							setShowSave(false);
						}}
						disabled={!availableColumns.length || loading}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						<Columns3 className="h-3.5 w-3.5" />
						Columns
					</button>
					<button
						type="button"
						onClick={() => {
							setShowFormula(true);
							setShowColumns(false);
						}}
						disabled={!rows.length || loading || !columns.length}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						<Plus className="h-3.5 w-3.5" />
						Column
					</button>
					<button
						type="button"
						onClick={openSaveModal}
						disabled={!rows.length || loading || !columns.length}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
					>
						<Save className="h-3.5 w-3.5" />
						Save table
					</button>
					<button
						type="button"
						onClick={handleOpenInWalker}
						disabled={!rows.length || loading || !columns.length}
						className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-700 px-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
					>
						<FlaskConical className="h-3.5 w-3.5" />
						Open in Lab
					</button>
				</div>
			</div>

			{showColumns ? (
				<div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
					<div className="mb-3 flex flex-wrap items-start justify-between gap-2">
						<div>
							<h3 className="text-sm font-bold text-slate-800">Choose columns</h3>
							<p className="mt-0.5 text-xs text-slate-500">
								Search and toggle fields from the live table. Works well with large forms (100+ columns).
							</p>
						</div>
						<div className="flex items-center gap-1.5">
							<button
								type="button"
								onClick={() => setAllSourceColumns(true)}
								className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
							>
								Select all
							</button>
							<button
								type="button"
								onClick={() => setAllSourceColumns(false)}
								className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
							>
								Clear all
							</button>
							<button type="button" onClick={() => setShowColumns(false)} className={analyticsGhostButtonClass}>
								Done
							</button>
						</div>
					</div>

					<CompactColumnPicker
						columns={availableColumns}
						selectedKeys={selectedKeySet}
						onToggle={toggleSourceColumn}
						onSelectKeys={selectSourceColumnKeys}
						onClearKeys={clearSourceColumnKeys}
						autoFocusSearch={showColumns}
						maxHeightClass="max-h-[min(28rem,55vh)]"
					/>

					{columns.some(column => column.calculated) ? (
						<div className="mt-3 border-t border-slate-100 pt-3">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Calculated</p>
							<div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
								{columns.filter(column => column.calculated).map(column => (
									<span
										key={column.key}
										className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900"
									>
										{column.label}
										<button
											type="button"
											onClick={() => handleRemoveColumn(column.key)}
											className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100 hover:text-rose-600"
											title="Remove calculated column"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</span>
								))}
							</div>
						</div>
					) : null}
				</div>
			) : null}

			{showSave ? (
				<div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
					<div className="mb-3">
						<h3 className="text-sm font-bold text-slate-800">Save prepared table</h3>
						<p className="mt-1 text-xs text-slate-500">
							Choose whether to freeze today’s rows, or keep a live link so new source submissions appear here too.
						</p>
					</div>

					<label className="block">
						<span className={analyticsLabelClass}>Table name</span>
						<input
							value={saveName}
							onChange={event => setSaveName(event.target.value)}
							className={analyticsInputClass}
							placeholder="Feedback prepared"
						/>
					</label>

					<div className="mt-3 grid gap-2 sm:grid-cols-2">
						<button
							type="button"
							onClick={() => setSaveMode('snapshot')}
							className={`rounded-lg border p-3 text-left transition ${
								saveMode === 'snapshot'
									? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-200'
									: 'border-slate-200 bg-white hover:bg-slate-50'
							}`}
						>
							<div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<Unlink className="h-4 w-4 text-emerald-700" />
								Detached snapshot
							</div>
							<p className="mt-1 text-xs leading-relaxed text-slate-500">
								Copies the current {rows.length.toLocaleString()} rows as they are now. Won’t change when the live survey grows.
							</p>
						</button>
						<button
							type="button"
							onClick={() => setSaveMode('linked')}
							className={`rounded-lg border p-3 text-left transition ${
								saveMode === 'linked'
									? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-200'
									: 'border-slate-200 bg-white hover:bg-slate-50'
							}`}
						>
							<div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
								<Link2 className="h-4 w-4 text-emerald-700" />
								Linked to live
							</div>
							<p className="mt-1 text-xs leading-relaxed text-slate-500">
								Keeps your columns and formulas, and always reads from the live source — new responses show up automatically.
							</p>
						</button>
					</div>

					<div className="mt-4">
						<span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
							Columns to include
						</span>
						<CompactColumnPicker
							columns={columns}
							selectedKeys={saveSelectedKeys}
							onToggle={(column, enabled) => toggleSaveColumn(column.key, enabled)}
							onSelectKeys={keys =>
								setSaveSelectedKeys(prev => Array.from(new Set([...prev, ...keys])))
							}
							onClearKeys={keys => {
								const remove = new Set(keys);
								setSaveSelectedKeys(prev => prev.filter(key => !remove.has(key)));
							}}
							maxHeightClass="max-h-52"
							emptyLabel="No matching columns in the current prep table."
						/>
					</div>

					{saveError ? <p className="mt-3 text-xs font-medium text-rose-600">{saveError}</p> : null}

					<div className="mt-4 flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={() => setShowSave(false)}
							disabled={saving}
							className={analyticsGhostButtonClass}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => void handleSaveTable()}
							disabled={saving || saveSelectedKeys.length === 0}
							className={analyticsButtonClass}
						>
							{saving ? (
								<>
									<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
									Saving…
								</>
							) : (
								<>Save as {saveMode === 'snapshot' ? 'snapshot' : 'linked table'}</>
							)}
						</button>
					</div>
				</div>
			) : null}

			{showFormula ? (
				<div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm">
					<div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
						<div>
							<label className={analyticsLabelClass}>Name</label>
							<input
								value={formulaName}
								onChange={event => setFormulaName(event.target.value)}
								placeholder="Gross Pay"
								className={analyticsInputClass}
							/>
						</div>
						<FormulaEditor
							value={formulaText}
							onChange={setFormulaText}
							columns={formulaColumns}
							sampleRow={rows[0] ?? null}
							evalError={formulaError}
						/>
						<div className="flex items-end gap-2">
							<button type="button" onClick={handleAddCalculatedColumn} className={analyticsButtonClass}>
								Add
							</button>
							<button type="button" onClick={() => { setShowFormula(false); setFormulaError(null); }} className={analyticsGhostButtonClass}>
								Cancel
							</button>
						</div>
					</div>
					<p className="mt-2 text-xs text-slate-500">
						Type <kbd className="rounded bg-slate-100 px-1">[</kbd> for columns. Functions insert as snippets
						(<span className="font-mono">LEFT()</span>) with the cursor inside. Autocomplete ranks by type,
						recents, and aliases. Shift+Enter for a new line.
					</p>
					{formulaError ? <p className="mt-2 text-xs font-medium text-rose-600">{formulaError}</p> : null}
				</div>
			) : null}

			<div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 bg-white shadow-sm">
				{loading ? (
					<div className="flex min-h-[28rem] items-center justify-center text-sm text-slate-500">
						<Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-700" />
						Loading table…
					</div>
				) : rows.length === 0 ? (
					<div className="flex min-h-[28rem] items-center justify-center text-sm text-slate-500">No rows to show.</div>
				) : (
					<table className="border-collapse text-left text-sm" style={{ tableLayout: 'fixed', width: tableMinWidth, minWidth: '100%' }}>
						<colgroup>
							<col style={{ width: PREP_INDEX_COL_WIDTH }} />
							{columns.map(column => (
								<col key={column.key} style={{ width: widthFor(column.key) }} />
							))}
						</colgroup>
						<thead className="sticky top-0 z-10 bg-slate-50">
							<tr>
								<th className="border-b border-slate-200 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
									#
								</th>
								{columns.map(column => (
									<th
										key={column.key}
										className="relative border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
										style={{ width: widthFor(column.key) }}
										title="Drag the right edge to resize · double-click edge to reset"
									>
										<div className="flex min-w-0 items-center gap-2 pr-2">
											<span className="truncate">{column.label}</span>
											{isImageFieldType(column.field_type) ? (
												<span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
													img
												</span>
											) : null}
											<button
												type="button"
												onClick={() => handleRemoveColumn(column.key)}
												className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-rose-600"
												title={column.calculated ? column.formula || 'Remove calculated column' : 'Hide column'}
											>
												<Trash2 className="h-3 w-3" />
											</button>
										</div>
										{column.formula ? (
											<div className="mt-0.5 truncate pr-2 font-mono text-[10px] font-normal text-emerald-700" title={column.formula}>
												{column.formula}
											</div>
										) : null}
										<span
											role="separator"
											aria-orientation="vertical"
											aria-label={`Resize ${column.label}`}
											onMouseDown={event => startColumnResize(column.key, event)}
											onDoubleClick={event => {
												event.preventDefault();
												event.stopPropagation();
												resetColumnWidth(column.key);
											}}
											className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none hover:bg-emerald-500/30 active:bg-emerald-600/40"
										/>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.slice(0, 500).map((row, rowIndex) => (
								<tr key={rowIndex} className="odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/40">
									<td className="border-b border-slate-100 px-2 py-1.5 text-xs text-slate-400">{rowIndex + 1}</td>
									{columns.map(column => {
										const kind = resolveCellKind(row[column.key], column.field_type);
										const allowWrap = kind === 'image' || kind === 'object' || kind === 'list';
										const displayValue = resolveDisplayValue(
											row[column.key],
											valueLabelMaps.get(column.key),
											displayMode,
										);
										return (
										<td
											key={column.key}
											className={`border-b border-slate-100 px-3 py-1.5 align-middle overflow-hidden ${
												allowWrap ? '' : 'whitespace-nowrap'
											} ${column.calculated ? 'font-medium text-emerald-900' : 'text-slate-700'}`}
											style={{ width: widthFor(column.key), maxWidth: widthFor(column.key) }}
										>
											<div className={allowWrap ? '' : 'truncate'}>
												<PrepCell
													value={displayValue}
													fieldType={column.field_type}
													label={column.label}
												/>
											</div>
										</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				)}
				{rows.length > 500 ? (
					<div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
						Showing first 500 of {rows.length.toLocaleString()} rows. All rows are included when opening in Lab.
					</div>
				) : null}
			</div>
		</div>
	);
}
