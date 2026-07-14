import { HyperFormula, DetailedCellError } from 'hyperformula';

import type { PrepColumn } from './prepSession';

function columnLetter(index: number): string {
	let n = index;
	let label = '';
	while (n >= 0) {
		label = String.fromCharCode((n % 26) + 65) + label;
		n = Math.floor(n / 26) - 1;
	}
	return label;
}

function coerceCellValue(value: unknown): string | number | boolean | null {
	if (value == null || value === '') return null;
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed === '') return null;
		if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
		if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
		return trimmed;
	}
	return String(value);
}

/** Rewrite =IF([Hours]>8, …) into Excel cell refs for a 1-based sheet row. */
export function rewriteColumnFormula(formula: string, columns: PrepColumn[], rowNumber: number): string {
	let next = formula.trim();
	if (!next) return '';
	if (!next.startsWith('=')) next = `=${next}`;

	const ranked = columns
		.map((column, index) => ({ column, index }))
		.sort((a, b) => Math.max(b.column.label.length, b.column.key.length) - Math.max(a.column.label.length, a.column.key.length));

	for (const { column, index } of ranked) {
		const ref = `${columnLetter(index)}${rowNumber}`;
		next = next.split(`[${column.label}]`).join(ref);
		next = next.split(`[${column.key}]`).join(ref);
	}

	return next;
}

export function evaluateCalculatedColumn(
	rows: Array<Record<string, unknown>>,
	columns: PrepColumn[],
	formula: string,
): { values: unknown[]; error?: string } {
	if (!rows.length) return { values: [] };

	const sheet: Array<Array<string | number | boolean | null>> = rows.map((row, rowIndex) => {
		const values = columns.map(column => coerceCellValue(row[column.key]));
		const excelFormula = rewriteColumnFormula(formula, columns, rowIndex + 1);
		return [...values, excelFormula];
	});

	try {
		const hf = HyperFormula.buildFromArray(sheet, {
			licenseKey: 'gpl-v3',
			useColumnIndex: true,
		});
		const formulaCol = columns.length;
		const values = rows.map((_, rowIndex) => {
			const cell = hf.getCellValue({ sheet: 0, row: rowIndex, col: formulaCol });
			if (cell instanceof DetailedCellError) {
				return `#${cell.type}`;
			}
			return cell;
		});
		hf.destroy();
		return { values };
	} catch (error: any) {
		return { values: rows.map(() => null), error: error?.message || 'Formula could not be evaluated.' };
	}
}

export function validateFormula(formula: string, columns: PrepColumn[]): string | null {
	const trimmed = formula.trim();
	if (!trimmed) return 'Enter a formula.';
	const sample = rewriteColumnFormula(trimmed, columns, 1);
	if (/\[[^\]]+\]/.test(sample)) {
		return 'Unknown column reference. Use [Column Name] from the field list.';
	}
	return null;
}
