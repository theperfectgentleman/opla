import { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

/** Normalize analytics field types (blueprint widget types + schema types). */
export type PrepCellKind =
	| 'empty'
	| 'image'
	| 'date'
	| 'time'
	| 'datetime'
	| 'boolean'
	| 'number'
	| 'gps'
	| 'list'
	| 'object'
	| 'text';

function normalizeType(fieldType?: string | null): string {
	return String(fieldType || '')
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_');
}

export function isImageFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return (
		t === 'photo_capture' ||
		t === 'image' ||
		t === 'photo' ||
		t === 'file_upload' ||
		t.includes('photo') ||
		t.includes('image')
	);
}

export function isDateFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return t === 'date' || t === 'date_picker' || t.endsWith('_date');
}

export function isTimeFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return t === 'time' || t === 'time_picker' || t === 'time_range';
}

export function isDateTimeFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return t === 'datetime' || t === 'timestamp' || t.includes('datetime');
}

export function isGpsFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return t === 'gps_capture' || t === 'gps' || t === 'location' || t.includes('geo');
}

export function isBooleanFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return t === 'boolean' || t === 'toggle' || t === 'bool';
}

export function isNumberFieldType(fieldType?: string | null): boolean {
	const t = normalizeType(fieldType);
	return (
		t === 'number' ||
		t === 'integer' ||
		t === 'decimal' ||
		t === 'float' ||
		t === 'input_number' ||
		t === 'rating_scale' ||
		t === 'generic_range'
	);
}

/** Try to parse JSON strings that analytics may return from JSONB. */
export function parseJsonish(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	const trimmed = value.trim();
	if (!trimmed) return value;
	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return value;
		}
	}
	// JSON-encoded string (quoted)
	if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed);
		} catch {
			return value;
		}
	}
	return value;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)(\?|#|$)/i;

export function extractImageUrl(value: unknown): string | null {
	const parsed = parseJsonish(value);
	if (parsed == null || parsed === '') return null;

	if (typeof parsed === 'string') {
		const s = parsed.trim();
		if (!s) return null;
		if (/^(https?:|data:image\/|blob:|synthetic:)/i.test(s)) return s;
		if (IMAGE_EXT.test(s) || s.startsWith('/') || s.startsWith('file:')) return s;
		return null;
	}

	if (typeof parsed === 'object' && !Array.isArray(parsed)) {
		const obj = parsed as Record<string, unknown>;
		for (const key of ['uri', 'url', 'src', 'href', 'image_url', 'photo', 'path']) {
			const candidate = obj[key];
			if (typeof candidate === 'string' && candidate.trim()) {
				return candidate.trim();
			}
		}
	}

	return null;
}

export function extractGps(value: unknown): { lat: number; lng: number; accuracy?: number } | null {
	const parsed = parseJsonish(value);
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
	const obj = parsed as Record<string, unknown>;
	const lat = Number(obj.lat ?? obj.latitude);
	const lng = Number(obj.lng ?? obj.longitude ?? obj.lon);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	const accuracy = obj.accuracy != null ? Number(obj.accuracy) : undefined;
	return {
		lat,
		lng,
		accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
	};
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const TIME_ONLY = /^\d{1,2}:\d{2}(:\d{2})?$/;

function formatDateValue(value: string): string {
	if (ISO_DATE.test(value)) {
		const d = new Date(`${value}T00:00:00`);
		if (Number.isNaN(d.getTime())) return value;
		return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTimeValue(value: string): string {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function formatTimeValue(value: unknown): string {
	const parsed = parseJsonish(value);
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
		const obj = parsed as Record<string, unknown>;
		const start = obj.start != null ? String(obj.start) : '';
		const end = obj.end != null ? String(obj.end) : '';
		if (start || end) return [start, end].filter(Boolean).join(' – ');
	}
	const s = String(parsed ?? '').trim();
	if (!s) return '';
	if (TIME_ONLY.test(s)) {
		const [h, m] = s.split(':');
		const d = new Date();
		d.setHours(Number(h), Number(m), 0, 0);
		return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
	}
	if (ISO_DATETIME.test(s)) {
		const d = new Date(s);
		if (!Number.isNaN(d.getTime())) {
			return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		}
	}
	return s;
}

function formatNumber(value: unknown): string {
	const n = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(n)) return String(value);
	return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatBoolean(value: unknown): string {
	if (typeof value === 'boolean') return value ? 'Yes' : 'No';
	const s = String(value).trim().toLowerCase();
	if (s === 'true' || s === '1' || s === 'yes') return 'Yes';
	if (s === 'false' || s === '0' || s === 'no') return 'No';
	return String(value);
}

export function resolveCellKind(value: unknown, fieldType?: string | null): PrepCellKind {
	const parsed = parseJsonish(value);
	if (parsed == null || parsed === '') return 'empty';

	if (isImageFieldType(fieldType)) {
		return extractImageUrl(parsed) ? 'image' : 'text';
	}
	if (extractImageUrl(parsed)) return 'image';

	if (isGpsFieldType(fieldType) || extractGps(parsed)) {
		if (extractGps(parsed)) return 'gps';
	}

	if (isBooleanFieldType(fieldType)) return 'boolean';
	if (isNumberFieldType(fieldType)) return 'number';
	if (isDateTimeFieldType(fieldType)) return 'datetime';
	if (isDateFieldType(fieldType)) return 'date';
	if (isTimeFieldType(fieldType)) return 'time';

	if (typeof parsed === 'boolean') return 'boolean';
	if (typeof parsed === 'number' && Number.isFinite(parsed)) return 'number';

	if (typeof parsed === 'string') {
		const s = parsed.trim();
		if (ISO_DATE.test(s)) return 'date';
		if (ISO_DATETIME.test(s)) return 'datetime';
		if (TIME_ONLY.test(s)) return 'time';
	}

	if (Array.isArray(parsed)) return 'list';
	if (typeof parsed === 'object') {
		if (extractGps(parsed)) return 'gps';
		return 'object';
	}
	return 'text';
}

export function formatPrepCellText(value: unknown, fieldType?: string | null): string {
	const kind = resolveCellKind(value, fieldType);
	const parsed = parseJsonish(value);

	switch (kind) {
		case 'empty':
			return '';
		case 'boolean':
			return formatBoolean(parsed);
		case 'number':
			return formatNumber(parsed);
		case 'date':
			return formatDateValue(String(parsed));
		case 'datetime':
			return formatDateTimeValue(String(parsed));
		case 'time':
			return formatTimeValue(parsed);
		case 'gps': {
			const gps = extractGps(parsed);
			if (!gps) return String(parsed);
			const base = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`;
			return gps.accuracy != null ? `${base} (±${gps.accuracy.toFixed(0)}m)` : base;
		}
		case 'list':
			return (parsed as unknown[])
				.map(item => {
					if (item == null) return '';
					if (typeof item === 'object') return JSON.stringify(item);
					return String(item);
				})
				.filter(Boolean)
				.join(', ');
		case 'object':
			try {
				return JSON.stringify(parsed);
			} catch {
				return String(parsed);
			}
		case 'image':
			return extractImageUrl(parsed) || String(parsed);
		default:
			if (typeof parsed === 'number') return formatNumber(parsed);
			if (typeof parsed === 'boolean') return formatBoolean(parsed);
			return String(parsed ?? '');
	}
}

function ImageThumb({ url, alt }: { url: string; alt: string }) {
	const [failed, setFailed] = useState(false);
	const isSynthetic = url.startsWith('synthetic:');

	if (failed || isSynthetic) {
		return (
			<span
				className="inline-flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[9px] font-semibold uppercase tracking-wide text-slate-400"
				title={url}
			>
				Img
			</span>
		);
	}

	return (
		<a
			href={url}
			target="_blank"
			rel="noreferrer"
			className="group relative inline-flex"
			title={url}
			onClick={event => event.stopPropagation()}
		>
			<img
				src={url}
				alt={alt}
				loading="lazy"
				onError={() => setFailed(true)}
				className="h-10 w-10 rounded border border-slate-200 object-cover bg-slate-50"
			/>
			<span className="pointer-events-none absolute -right-1 -top-1 hidden rounded-full bg-white p-0.5 shadow group-hover:inline-flex">
				<ExternalLink className="h-2.5 w-2.5 text-slate-500" />
			</span>
		</a>
	);
}

export function PrepCell({
	value,
	fieldType,
	label,
}: {
	value: unknown;
	fieldType?: string | null;
	label?: string;
}) {
	const kind = resolveCellKind(value, fieldType);
	const parsed = parseJsonish(value);

	if (kind === 'empty') {
		return <span className="text-slate-300">—</span>;
	}

	if (kind === 'image') {
		const url = extractImageUrl(parsed);
		if (!url) return <span className="text-slate-400">No image</span>;
		return (
			<span className="inline-flex items-center gap-2">
				<ImageThumb url={url} alt={label || 'Photo'} />
				<span className="max-w-[8rem] truncate font-mono text-[10px] text-slate-400" title={url}>
					{url.replace(/^https?:\/\//, '').slice(0, 28)}
				</span>
			</span>
		);
	}

	if (kind === 'gps') {
		const gps = extractGps(parsed);
		if (!gps) return <span>{formatPrepCellText(value, fieldType)}</span>;
		const maps = `https://www.google.com/maps?q=${gps.lat},${gps.lng}`;
		return (
			<a
				href={maps}
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1.5 text-emerald-800 hover:underline"
				title={`${gps.lat}, ${gps.lng}`}
			>
				<MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
				<span className="font-mono text-xs">
					{gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
				</span>
			</a>
		);
	}

	if (kind === 'boolean') {
		const yes = formatBoolean(parsed) === 'Yes';
		return (
			<span
				className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${
					yes ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'
				}`}
			>
				{formatBoolean(parsed)}
			</span>
		);
	}

	const text = formatPrepCellText(value, fieldType);
	const mono = kind === 'number' || kind === 'date' || kind === 'time' || kind === 'datetime';

	return (
		<span
			className={mono ? 'font-mono text-[13px] tabular-nums text-slate-700' : 'text-slate-700'}
			title={typeof parsed === 'string' ? parsed : text}
		>
			{text}
		</span>
	);
}
