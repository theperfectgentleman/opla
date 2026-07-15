/**
 * Path-aware synthetic survey response generator.
 * Walks sections like a respondent, respecting rules, cascades, and directories.
 */
import {
  evaluateAllRules,
  isFieldVisibleByRules,
  isSectionVisibleByRules,
  getFilteredOptionsByRules,
  getSetValueEffects,
  getJumpToSectionTarget,
} from '../../../../mobile/src/utils/rulesEngine';
import { fieldUsesDirectoryOptionResolver, resolveDirectoryFormFieldOptions } from '@opla/types';

// ─── Public types ────────────────────────────────────────────────────────────

export interface FieldWeight {
  value: string;
  percent: number;
}

/** Ratio / distribution constraint applied across the batch. */
export interface RatioRule {
  id: string;
  fieldBind: string;
  mode: 'weights' | 'range';
  /** Optional parent gate: only force this rule when parent equals `whenValue`. */
  whenFieldBind?: string;
  whenValue?: string;
  weights?: FieldWeight[];
  rangeMin?: number;
  rangeMax?: number;
  /**
   * For range (or conditional) rules: % of total records that should satisfy
   * the when-gate (if any) AND land in the numeric range / preferred weights.
   * Defaults to 100 for unconditional weights (handled via weight percents).
   */
  percentOfTotal?: number;
}

export interface GenerateOptions {
  count: number;
  seed?: number;
  ratioRules?: RatioRule[];
  /** Max object_collection items per field */
  maxCollectionItems?: number;
}

export interface GeneratedResponse {
  data: Record<string, unknown>;
  path: string[];
}

export interface GenerateBatchResult {
  responses: GeneratedResponse[];
  warnings: string[];
}

// ─── RNG ─────────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createRng(seed?: number) {
  if (seed === undefined || seed === null || Number.isNaN(seed)) {
    return Math.random;
  }
  return mulberry32(Math.floor(seed));
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function optionValue(opt: unknown): string {
  if (opt && typeof opt === 'object' && 'value' in (opt as object)) {
    return String((opt as { value: unknown }).value);
  }
  return String(opt ?? '');
}

function optionLabel(opt: unknown): string {
  if (opt && typeof opt === 'object' && 'label' in (opt as object)) {
    return String((opt as { label: unknown }).label);
  }
  return String(opt ?? '');
}

// ─── Field / blueprint helpers ───────────────────────────────────────────────

type AnyField = Record<string, any>;
type AnyBlueprint = {
  ui?: Array<{ id: string; title?: string; children?: AnyField[]; render_mode?: string }>;
  rules?: any[];
  logic?: any[];
  meta?: { title?: string };
};

function fieldKey(field: AnyField): string {
  return String(field.bind || field.id || '');
}

function flattenFields(blueprint: AnyBlueprint): AnyField[] {
  const out: AnyField[] = [];
  for (const section of blueprint.ui || []) {
    for (const field of section.children || []) {
      if (fieldKey(field)) out.push(field);
    }
  }
  return out;
}

export function listGeneratableFields(blueprint: AnyBlueprint): Array<{
  bind: string;
  label: string;
  type: string;
  options: Array<{ label: string; value: string }>;
  isNumeric: boolean;
  isChoice: boolean;
}> {
  return flattenFields(blueprint)
    .filter((f) => !SKIP_TYPES.has(String(f.type)))
    .map((f) => {
      const type = String(f.type || 'input_text');
      const rawOpts = resolveStaticOptions(f);
      return {
        bind: fieldKey(f),
        label: String(f.label || fieldKey(f)),
        type,
        options: rawOpts.map((o) => ({ label: optionLabel(o), value: optionValue(o) })),
        isNumeric: NUMERIC_TYPES.has(type) || type === 'rating_scale' || type === 'generic_range',
        isChoice: CHOICE_TYPES.has(type),
      };
    });
}

const SKIP_TYPES = new Set(['form_link', 'signature_pad', 'file_upload', 'audio_recorder', 'photo_capture']);
const CHOICE_TYPES = new Set([
  'dropdown',
  'radio_group',
  'checkbox_group',
  'multi_select_dropdown',
  'lookup_list',
  'toggle',
]);
const NUMERIC_TYPES = new Set(['input_number', 'rating_scale', 'generic_range']);
const MULTI_TYPES = new Set(['checkbox_group', 'multi_select_dropdown']);

/** Resolve options that don't depend on live responses (static / unfiltered directory). */
function resolveStaticOptions(field: AnyField): any[] {
  if (fieldUsesDirectoryOptionResolver(field as any) && field.directory_runtime_entries?.length) {
    // Without parent filter — unique values if requested
    return resolveDirectoryFormFieldOptions(field as any, {});
  }
  if (field.cascade_options_map && typeof field.cascade_options_map === 'object') {
    const seen = new Set<string>();
    const all: any[] = [];
    for (const opts of Object.values(field.cascade_options_map) as any[][]) {
      for (const opt of opts || []) {
        const v = optionValue(opt);
        if (!seen.has(v)) {
          seen.add(v);
          all.push(opt);
        }
      }
    }
    if (all.length) return all;
  }
  if (Array.isArray(field.options) && field.options.length) return field.options;
  if (field.type === 'lookup_list') return parseLookupOptions(field);
  if (field.type === 'toggle') {
    return [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ];
  }
  return [];
}

function parseLookupOptions(field: AnyField): any[] {
  let options: any[] = [];
  if (field.lookup_source_type === 'preset') {
    if (field.lookup_preset_id === 'global_countries') {
      options = [
        { label: 'Ghana', value: 'gh' },
        { label: 'Nigeria', value: 'ng' },
        { label: 'USA', value: 'us' },
        { label: 'United Kingdom', value: 'uk' },
      ];
    } else if (field.lookup_preset_id === 'african_countries') {
      options = [
        { label: 'Ghana', value: 'gh' },
        { label: 'Nigeria', value: 'ng' },
        { label: 'Kenya', value: 'ke' },
      ];
    } else if (field.lookup_preset_id === 'us_states') {
      options = [
        { label: 'California', value: 'ca' },
        { label: 'New York', value: 'ny' },
        { label: 'Texas', value: 'tx' },
      ];
    }
    return options;
  }

  if (field.lookup_source_type !== 'custom' || !field.lookup_custom_data) return [];

  const dataString = String(field.lookup_custom_data || '');
  const separator = field.lookup_separator || ',';
  const trimmed = dataString.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const labelKey = String(field.lookup_label_column || '');
        const valueKey = String(field.lookup_value_column || '');
        return parsed.map((item, index) => {
          if (item && typeof item === 'object') {
            const keys = Object.keys(item);
            const label =
              (labelKey && item[labelKey] !== undefined
                ? String(item[labelKey])
                : String(item[keys[0]] ?? `Row ${index}`)) || `Row ${index}`;
            const value =
              valueKey && item[valueKey] !== undefined ? String(item[valueKey]) : label;
            return { label: label.trim(), value: value.trim(), row_data: item };
          }
          return { label: String(item), value: String(item), row_data: { value: item } };
        });
      }
    } catch {
      /* fall through to CSV */
    }
  }

  const lines = dataString
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l !== '');
  if (!lines.length) return [];

  const firstLineCols = lines[0].split(separator).map((c: string) => c.trim());
  const labelColVal = String(field.lookup_label_column || '1');
  const valueColVal = String(field.lookup_value_column || '1');
  const isLabelColNumeric = /^\d+$/.test(labelColVal);
  const isValueColNumeric = /^\d+$/.test(valueColVal);
  const normalizedFirstLine = firstLineCols.map((c: string) => c.toLowerCase());
  const hasHeader =
    (!isLabelColNumeric && labelColVal !== '') ||
    (!isValueColNumeric && valueColVal !== '') ||
    normalizedFirstLine.includes(labelColVal.toLowerCase()) ||
    normalizedFirstLine.includes(valueColVal.toLowerCase());

  const headers = hasHeader
    ? firstLineCols
    : firstLineCols.map((_: string, idx: number) => `Column ${idx + 1}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((row: string, index: number) => {
    const cols = row.split(separator).map((c: string) => c.trim());
    const row_data: Record<string, string> = {};
    headers.forEach((header: string, idx: number) => {
      row_data[header] = cols[idx] || '';
    });

    const resolveCol = (colVal: string) => {
      if (hasHeader) {
        const idx = headers.findIndex((h) => h.toLowerCase() === colVal.toLowerCase());
        if (idx >= 0) return cols[idx] || '';
      }
      const n = parseInt(colVal, 10);
      return !isNaN(n) && cols[n - 1] !== undefined ? cols[n - 1] : cols[0] || `Row ${index}`;
    };

    const label = resolveCol(labelColVal);
    const value = resolveCol(valueColVal) || label;
    return { label: label.trim(), value: value.trim(), row_cols: cols, row_data };
  });
}

/**
 * Resolve currently allowed options for a field given partial answers.
 */
export function resolveFieldOptions(
  field: AnyField,
  responses: Record<string, unknown>,
  blueprint: AnyBlueprint,
): any[] {
  const key = fieldKey(field);
  const rulesResult = evaluateAllRules(blueprint.rules || [], responses as any, blueprint);

  let options: any[] = [];

  if (fieldUsesDirectoryOptionResolver(field as any)) {
    options = resolveDirectoryFormFieldOptions(field as any, responses as any);
  } else if (field.cascade_parent_field_id && field.cascade_options_map) {
    const parentVal = responses[field.cascade_parent_field_id];
    if (parentVal !== undefined && parentVal !== null && String(parentVal) !== '') {
      options = field.cascade_options_map[String(parentVal)] || [];
    } else {
      options = [];
    }
  } else if (Array.isArray(field.options) && field.options.length) {
    options = field.options;
  } else if (field.type === 'lookup_list') {
    options = parseLookupOptions(field);
  } else if (field.type === 'toggle') {
    options = [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ];
  }

  const filtered = getFilteredOptionsByRules(key, rulesResult, responses as any, options);
  if (filtered !== null) return filtered;

  // Also try field.id if bind differed
  if (field.id && field.id !== key) {
    const filteredById = getFilteredOptionsByRules(field.id, rulesResult, responses as any, options);
    if (filteredById !== null) return filteredById;
  }

  return options;
}

function isFieldVisible(
  field: AnyField,
  responses: Record<string, unknown>,
  blueprint: AnyBlueprint,
): boolean {
  const key = fieldKey(field);
  const rulesResult = evaluateAllRules(blueprint.rules || [], responses as any, blueprint);
  const byRules = isFieldVisibleByRules(key, rulesResult);
  if (byRules !== null) return byRules;
  if (field.id && field.id !== key) {
    const byId = isFieldVisibleByRules(field.id, rulesResult);
    if (byId !== null) return byId;
  }

  // Legacy logic visibility
  const logicRules = (blueprint.logic || []).filter(
    (r: any) => r.type === 'field_visibility' && (r.target_id === key || r.target_id === field.id),
  );
  if (!logicRules.length) return true;
  return logicRules.some((r: any) => {
    const match = evaluateLegacyRule(r, responses);
    return r.action === 'show' ? match : !match;
  });
}

function isSectionVisible(
  sectionId: string,
  responses: Record<string, unknown>,
  blueprint: AnyBlueprint,
): boolean {
  const rulesResult = evaluateAllRules(blueprint.rules || [], responses as any, blueprint);
  const vis = isSectionVisibleByRules(sectionId, rulesResult);
  if (vis !== null) return vis;
  return true;
}

function evaluateLegacyRule(rule: any, responses: Record<string, unknown>): boolean {
  if (!rule.conditions?.length) return true;
  const results = rule.conditions.map((cond: any) => {
    const val = responses[cond.field];
    const targetVal = cond.value;
    switch (cond.operator) {
      case 'eq':
        return String(val ?? '') === String(targetVal);
      case 'neq':
        return String(val ?? '') !== String(targetVal);
      case 'contains':
        return String(val ?? '')
          .toLowerCase()
          .includes(String(targetVal).toLowerCase());
      case 'gt':
        return Number(val) > Number(targetVal);
      case 'lt':
        return Number(val) < Number(targetVal);
      default:
        return false;
    }
  });
  if (rule.logic_operator === 'OR') return results.some(Boolean);
  return results.every(Boolean);
}

function applySetValues(
  responses: Record<string, unknown>,
  blueprint: AnyBlueprint,
): Record<string, unknown> {
  const next = { ...responses };
  // Iterate a few times so chained SET_VALUE can settle
  for (let i = 0; i < 3; i++) {
    const result = evaluateAllRules(blueprint.rules || [], next as any, blueprint);
    const sets = getSetValueEffects(result);
    let changed = false;
    for (const { fieldId, value } of sets) {
      if (next[fieldId] !== value) {
        next[fieldId] = value;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return next;
}

// ─── Value generators ────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Ada', 'Kwame', 'Ama', 'Yaw', 'Abena', 'Kofi', 'Efua', 'Kojo', 'Akosua', 'Fiifi',
  'Maya', 'Noah', 'Lena', 'Omar', 'Zara', 'Ibrahim', 'Sofia', 'Daniel', 'Fatima', 'James',
];
const LAST_NAMES = [
  'Mensah', 'Owusu', 'Asante', 'Boateng', 'Appiah', 'Osei', 'Darko', 'Addo', 'Annan', 'Sarpong',
  'Johnson', 'Williams', 'Brown', 'Garcia', 'Patel', 'Nguyen', 'Kim', 'Ali', 'Chen', 'Okoro',
];

function randomInt(rng: () => number, min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function randomFloat(rng: () => number, min: number, max: number, decimals = 2): number {
  const v = min + rng() * (max - min);
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function randomDateISO(rng: () => number, yearsBack = 5): string {
  const now = Date.now();
  const past = now - Math.floor(rng() * yearsBack * 365.25 * 24 * 3600 * 1000);
  return new Date(past).toISOString().slice(0, 10);
}

function randomTime(rng: () => number): string {
  const h = String(randomInt(rng, 0, 23)).padStart(2, '0');
  const m = String(randomInt(rng, 0, 59)).padStart(2, '0');
  return `${h}:${m}`;
}

function generateText(rng: () => number, field: AnyField, index: number): string {
  const label = String(field.label || fieldKey(field)).toLowerCase();
  if (label.includes('email') || field.type === 'email_input') {
    const n = FIRST_NAMES[randomInt(rng, 0, FIRST_NAMES.length - 1)].toLowerCase();
    return `${n}.${index + 1}@example.test`;
  }
  if (label.includes('phone') || field.type === 'phone_input') {
    return `+233${randomInt(rng, 200000000, 599999999)}`;
  }
  if (label.includes('name')) {
    return `${FIRST_NAMES[randomInt(rng, 0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[randomInt(rng, 0, LAST_NAMES.length - 1)]}`;
  }
  if (field.mask) {
    return applySimpleMask(field.mask, rng);
  }
  const words = ['sample', 'test', 'field', 'response', 'alpha', 'beta', 'gamma'];
  return `${words[randomInt(rng, 0, words.length - 1)]} ${index + 1}`;
}

function applySimpleMask(mask: string, rng: () => number): string {
  let out = '';
  for (const ch of mask) {
    if (ch === '9') out += String(randomInt(rng, 0, 9));
    else if (ch === 'A') out += String.fromCharCode(65 + randomInt(rng, 0, 25));
    else if (ch === 'a') out += String.fromCharCode(97 + randomInt(rng, 0, 25));
    else if (ch === '*') out += String.fromCharCode(97 + randomInt(rng, 0, 25));
    else out += ch;
  }
  return out;
}

function generateNumeric(
  rng: () => number,
  field: AnyField,
  forcedRange?: { min: number; max: number },
): number {
  let min = field.has_no_min ? 0 : Number(field.min ?? 0);
  let max = field.has_no_max ? 100 : Number(field.max ?? 100);
  if (Number.isNaN(min)) min = 0;
  if (Number.isNaN(max)) max = min + 100;
  if (forcedRange) {
    min = Math.max(min, forcedRange.min);
    max = Math.min(max, forcedRange.max);
    if (min > max) {
      min = forcedRange.min;
      max = forcedRange.max;
    }
  }
  if (field.type === 'rating_scale') {
    return randomInt(rng, Math.floor(min) || 1, Math.floor(max) || 5);
  }
  const rangeType = field.range_type || 'NUMBER';
  if (rangeType === 'INTEGER' || rangeType === 'INDEX') {
    return randomInt(rng, min, max);
  }
  const decimals = typeof field.decimal_places === 'number' ? field.decimal_places : 2;
  return randomFloat(rng, min, max, decimals);
}

function pickFromOptions(
  rng: () => number,
  options: any[],
  multi: boolean,
  preferredValue?: string,
): unknown {
  if (!options.length) return multi ? [] : null;

  if (preferredValue !== undefined) {
    const match = options.find((o) => String(optionValue(o)) === String(preferredValue));
    if (match) {
      const v = optionValue(match);
      if (multi) return [v];
      // toggle may use boolean
      if (typeof (match as any).value === 'boolean') return (match as any).value;
      if (v === 'true') return true;
      if (v === 'false') return false;
      return (match as any).value !== undefined ? (match as any).value : v;
    }
  }

  if (multi) {
    const count = randomInt(rng, 1, Math.min(3, options.length));
    const shuffled = shuffleInPlace([...options], rng);
    return shuffled.slice(0, count).map(optionValue);
  }

  const opt = options[Math.floor(rng() * options.length)];
  const v = optionValue(opt);
  if (typeof (opt as any).value === 'boolean') return (opt as any).value;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return (opt as any).value !== undefined ? (opt as any).value : v;
}

function generateMatrix(rng: () => number, field: AnyField): Record<string, unknown> {
  const rows = field.table_rows || [];
  const cols = field.table_columns || [];
  const cellType = field.table_cell_type || 'radio';
  const result: Record<string, unknown> = {};

  for (const row of rows) {
    const rowId = row.id || row.value || row.label;
    if (cellType === 'radio') {
      if (cols.length) {
        const col = cols[Math.floor(rng() * cols.length)];
        result[rowId] = col.id || col.value || col.label;
      }
    } else if (cellType === 'checkbox') {
      const picked: string[] = [];
      for (const col of cols) {
        if (rng() > 0.5) picked.push(col.id || col.value || col.label);
      }
      result[rowId] = picked;
    } else if (cellType === 'number') {
      const rowVals: Record<string, number> = {};
      for (const col of cols) {
        rowVals[col.id || col.value || col.label] = randomInt(rng, 0, 10);
      }
      result[rowId] = rowVals;
    } else if (cellType === 'dropdown') {
      const rowVals: Record<string, string> = {};
      for (const col of cols) {
        const opts = col.options || ['A', 'B', 'C'];
        rowVals[col.id || col.value || col.label] = String(opts[Math.floor(rng() * opts.length)]);
      }
      result[rowId] = rowVals;
    } else {
      const rowVals: Record<string, string> = {};
      for (const col of cols) {
        rowVals[col.id || col.value || col.label] = `cell-${randomInt(rng, 1, 99)}`;
      }
      result[rowId] = rowVals;
    }
  }
  return result;
}

function generateObjectItem(rng: () => number, field: AnyField, directoryItems: any[]): Record<string, unknown> {
  const def = field.object_definition;
  const item: Record<string, unknown> = { _id: `syn_${Math.floor(rng() * 1e9)}` };
  if (!def?.properties?.length) {
    item.label = `Item ${randomInt(rng, 1, 999)}`;
    return item;
  }
  for (const prop of def.properties) {
    if (prop.edit_mode === 'hidden') continue;
    const key = prop.key || prop.id;
    if (!key) continue;
    if (prop.reference?.source_items?.length) {
      const src = prop.reference.source_items[Math.floor(rng() * prop.reference.source_items.length)];
      item[key] = src.sku_code || src.id || src.label;
    } else if (prop.reference?.source_type === 'directory' && directoryItems.length) {
      const src = directoryItems[Math.floor(rng() * directoryItems.length)];
      item[key] = src.sku_code || src.id || src.label;
    } else if (prop.type === 'number' || prop.type === 'integer' || prop.type === 'decimal') {
      item[key] = randomInt(rng, 1, 100);
    } else if (prop.type === 'boolean') {
      item[key] = rng() > 0.5;
    } else {
      item[key] = prop.default_value ?? `val_${randomInt(rng, 1, 99)}`;
    }
  }
  return item;
}

function generateFieldValue(
  rng: () => number,
  field: AnyField,
  responses: Record<string, unknown>,
  blueprint: AnyBlueprint,
  index: number,
  preferred?: { value?: string; range?: { min: number; max: number } },
  directoryItems: any[] = [],
  maxCollectionItems = 3,
): unknown {
  const type = String(field.type || 'input_text');

  if (SKIP_TYPES.has(type)) {
    if (type === 'photo_capture') return { simulated: true, uri: `synthetic://photo/${index}` };
    if (type === 'signature_pad') return { simulated: true };
    return null;
  }

  if (CHOICE_TYPES.has(type) || type === 'lookup_list') {
    const options = resolveFieldOptions(field, responses, blueprint);
    return pickFromOptions(rng, options, MULTI_TYPES.has(type), preferred?.value);
  }

  if (NUMERIC_TYPES.has(type)) {
    return generateNumeric(rng, field, preferred?.range);
  }

  if (type === 'date_picker') return randomDateISO(rng);
  if (type === 'time_picker') return randomTime(rng);
  if (type === 'time_range') {
    const start = randomTime(rng);
    return { start, end: randomTime(rng) };
  }
  if (type === 'gps_capture') {
    return {
      lat: randomFloat(rng, 5.5, 5.7, 6),
      lng: randomFloat(rng, -0.3, -0.1, 6),
      accuracy: randomFloat(rng, 5, 25, 1),
    };
  }
  if (type === 'barcode_scanner') {
    return `SYN${randomInt(rng, 100000, 999999)}`;
  }
  if (type === 'matrix_table') return generateMatrix(rng, field);
  if (type === 'object_instance') return generateObjectItem(rng, field, directoryItems);
  if (type === 'object_collection') {
    const n = randomInt(rng, 1, maxCollectionItems);
    return Array.from({ length: n }, () => generateObjectItem(rng, field, directoryItems));
  }
  if (type === 'textarea') return `Synthetic note for record ${index + 1}. Generated for testing.`;
  if (type === 'email_input' || type === 'phone_input' || type === 'input_text') {
    return generateText(rng, field, index);
  }

  // Fallback: try options, else text
  const options = resolveFieldOptions(field, responses, blueprint);
  if (options.length) return pickFromOptions(rng, options, false, preferred?.value);
  return generateText(rng, field, index);
}

// ─── Quota planning ──────────────────────────────────────────────────────────

interface SlotPlan {
  /** Forced field values for this record index */
  forced: Record<string, { value?: string; range?: { min: number; max: number } }>;
}

/**
 * Build per-record forced values from ratio rules so batch-level percentages land close to target.
 */
function planSlots(count: number, rules: RatioRule[], rng: () => number): SlotPlan[] {
  const slots: SlotPlan[] = Array.from({ length: count }, () => ({ forced: {} }));

  for (const rule of rules) {
    if (!rule.fieldBind) continue;

    if (rule.mode === 'weights' && rule.weights?.length) {
      const weights = rule.weights.filter((w) => w.percent > 0 && w.value !== '');
      if (!weights.length) continue;

      // Allocate integer counts from percentages. If sum < 100, leave remainder unforced (random).
      const totalPct = weights.reduce((s, w) => s + w.percent, 0);
      const scale = totalPct > 100 ? 100 / totalPct : 1;
      const forcedSlotCount = Math.round((Math.min(100, totalPct * scale) / 100) * count);

      let allocated = 0;
      const counts = weights.map((w, i) => {
        const raw = (w.percent * scale * count) / 100;
        const n =
          i === weights.length - 1
            ? Math.max(0, forcedSlotCount - allocated)
            : Math.round(raw);
        allocated += n;
        return { value: w.value, n: Math.max(0, n) };
      });
      let sum = counts.reduce((s, c) => s + c.n, 0);
      if (sum > forcedSlotCount && counts.length) {
        counts[counts.length - 1].n = Math.max(
          0,
          counts[counts.length - 1].n - (sum - forcedSlotCount),
        );
      } else if (sum < forcedSlotCount && counts.length) {
        counts[0].n += forcedSlotCount - sum;
      }

      const assignments: string[] = [];
      for (const c of counts) {
        for (let i = 0; i < c.n; i++) assignments.push(c.value);
      }
      shuffleInPlace(assignments, rng);

      // If conditional when-gate: only assign to a subset that will also get the when value
      if (rule.whenFieldBind && rule.whenValue !== undefined && rule.whenValue !== '') {
        const targetShare = clamp(rule.percentOfTotal ?? 100, 0, 100);
        const targetN = Math.round((targetShare / 100) * count);
        const indices = shuffleInPlace(
          Array.from({ length: count }, (_, i) => i),
          rng,
        ).slice(0, targetN);

        indices.forEach((idx, j) => {
          slots[idx].forced[rule.whenFieldBind!] = { value: String(rule.whenValue) };
          if (assignments.length) {
            slots[idx].forced[rule.fieldBind] = {
              value: assignments[j % assignments.length],
            };
          }
        });
      } else {
        const indices = shuffleInPlace(
          Array.from({ length: count }, (_, i) => i),
          rng,
        ).slice(0, assignments.length);
        indices.forEach((idx, j) => {
          slots[idx].forced[rule.fieldBind] = { value: assignments[j] };
        });
      }
      continue;
    }

    if (rule.mode === 'range' && rule.rangeMin !== undefined && rule.rangeMax !== undefined) {
      const targetShare = clamp(rule.percentOfTotal ?? 100, 0, 100);
      const targetN = Math.round((targetShare / 100) * count);
      const indices = shuffleInPlace(
        Array.from({ length: count }, (_, i) => i),
        rng,
      ).slice(0, targetN);

      for (const idx of indices) {
        if (rule.whenFieldBind && rule.whenValue !== undefined && rule.whenValue !== '') {
          slots[idx].forced[rule.whenFieldBind] = { value: String(rule.whenValue) };
        }
        slots[idx].forced[rule.fieldBind] = {
          range: { min: rule.rangeMin, max: rule.rangeMax },
        };
      }
    }
  }

  return slots;
}

// ─── Path walk ───────────────────────────────────────────────────────────────

function resolveNextSectionIndex(
  blueprint: AnyBlueprint,
  currentIndex: number,
  responses: Record<string, unknown>,
): number | 'end' {
  const sections = blueprint.ui || [];
  const current = sections[currentIndex];
  if (!current) return 'end';

  const rulesResult = evaluateAllRules(blueprint.rules || [], responses as any, blueprint);
  const jumpTarget = getJumpToSectionTarget(rulesResult);
  if (jumpTarget) {
    if (jumpTarget === 'end') return 'end';
    const idx = sections.findIndex((s) => s.id === jumpTarget);
    if (idx !== -1) return idx;
  }

  // Legacy section_jump
  const legacyJump = (blueprint.logic || []).find(
    (r: any) =>
      r.type === 'section_jump' &&
      r.source_id === current.id &&
      evaluateLegacyRule(r, responses),
  );
  if (legacyJump) {
    if (legacyJump.target_id === 'end') return 'end';
    const idx = sections.findIndex((s) => s.id === legacyJump.target_id);
    if (idx !== -1) return idx;
  }

  if (currentIndex >= sections.length - 1) return 'end';
  return currentIndex + 1;
}

/**
 * Generate one path-accurate response.
 */
export function generateOneResponse(
  blueprint: AnyBlueprint,
  index: number,
  rng: () => number,
  forced: SlotPlan['forced'] = {},
  directoryItems: any[] = [],
  maxCollectionItems = 3,
): GeneratedResponse {
  const sections = blueprint.ui || [];
  let responses: Record<string, unknown> = {};
  const path: string[] = [];
  const visited = new Set<number>();
  let sectionIndex = 0;
  let safety = 0;

  // Seed defaults
  for (const section of sections) {
    for (const field of section.children || []) {
      if (
        field.default_value !== undefined &&
        field.default_value !== null &&
        field.default_value !== ''
      ) {
        const key = fieldKey(field);
        if (field.type === 'toggle') {
          responses[key] = field.default_value === 'true' || field.default_value === true;
        } else if (field.type === 'checkbox_group') {
          try {
            responses[key] = JSON.parse(field.default_value);
          } catch {
            responses[key] = [field.default_value];
          }
        } else {
          responses[key] = field.default_value;
        }
      }
    }
  }

  // Apply forced parent values first so cascades see them
  for (const [bind, pref] of Object.entries(forced)) {
    if (pref.value !== undefined) responses[bind] = pref.value;
  }

  while (sectionIndex !== ('end' as any) && safety < 200) {
    safety++;
    if (visited.has(sectionIndex)) break;
    visited.add(sectionIndex);

    const section = sections[sectionIndex];
    if (!section) break;

    if (!isSectionVisible(section.id, responses, blueprint)) {
      const next = resolveNextSectionIndex(blueprint, sectionIndex, responses);
      if (next === 'end') break;
      sectionIndex = next;
      continue;
    }

    path.push(section.id);

    // Multiple passes so SHOW rules that unlock later fields get filled
    for (let pass = 0; pass < 3; pass++) {
      for (const field of section.children || []) {
        const key = fieldKey(field);
        if (!key) continue;
        if (!isFieldVisible(field, responses, blueprint)) {
          // Clear hidden answers so data matches real submissions
          if (pass === 2 && !(key in forced)) {
            delete responses[key];
          }
          continue;
        }

        // Don't overwrite SET_VALUE targets that were already set unless forced
        const preferred = forced[key];
        if (preferred?.value !== undefined && responses[key] !== undefined && pass > 0) {
          // ensure preferred still valid for cascades
          const opts = resolveFieldOptions(field, responses, blueprint);
          if (CHOICE_TYPES.has(String(field.type)) || field.type === 'lookup_list') {
            const ok = opts.some((o) => String(optionValue(o)) === String(preferred.value));
            if (!ok && opts.length) {
              responses[key] = pickFromOptions(rng, opts, MULTI_TYPES.has(String(field.type)));
            }
            continue;
          }
        }

        if (responses[key] !== undefined && preferred === undefined && pass > 0) {
          continue; // already filled
        }

        responses[key] = generateFieldValue(
          rng,
          field,
          responses,
          blueprint,
          index,
          preferred,
          directoryItems,
          maxCollectionItems,
        );
      }
      responses = applySetValues(responses, blueprint);
    }

    const next = resolveNextSectionIndex(blueprint, sectionIndex, responses);
    if (next === 'end') break;
    // Avoid infinite loop if jump goes backwards to visited
    if (typeof next === 'number' && visited.has(next) && next <= sectionIndex) break;
    sectionIndex = next as number;
  }

  // Final pass: strip values for fields that ended up hidden
  for (const section of sections) {
    for (const field of section.children || []) {
      const key = fieldKey(field);
      if (!key) continue;
      if (!isFieldVisible(field, responses, blueprint) && !(key in forced)) {
        delete responses[key];
      }
    }
  }

  responses = applySetValues(responses, blueprint);

  return { data: responses, path };
}

/**
 * Generate a batch of path-accurate synthetic responses.
 */
export function generateSyntheticBatch(
  blueprint: AnyBlueprint,
  options: GenerateOptions,
  directoryItems: any[] = [],
): GenerateBatchResult {
  const count = Math.max(1, Math.min(500, Math.floor(options.count || 1)));
  const rng = createRng(options.seed);
  const warnings: string[] = [];
  const rules = options.ratioRules || [];

  // Validate ratio weights roughly sum
  for (const rule of rules) {
    if (rule.mode === 'weights' && rule.weights?.length) {
      const sum = rule.weights.reduce((s, w) => s + (Number(w.percent) || 0), 0);
      if (sum > 105) {
        weightsWarning(warnings, rule.fieldBind, sum);
      }
    }
  }

  const slots = planSlots(count, rules, rng);
  const responses: GeneratedResponse[] = [];

  for (let i = 0; i < count; i++) {
    responses.push(
      generateOneResponse(
        blueprint,
        i,
        rng,
        slots[i].forced,
        directoryItems,
        options.maxCollectionItems ?? 3,
      ),
    );
  }

  return { responses, warnings };
}

function weightsWarning(warnings: string[], fieldBind: string, sum: number) {
  warnings.push(
    `Weights for "${fieldBind}" sum to ${sum}% (will be scaled to 100%).`,
  );
}

/** Summarize how often each value appears for a field (for UI preview). */
export function summarizeFieldDistribution(
  responses: GeneratedResponse[],
  fieldBind: string,
): Array<{ value: string; count: number; percent: number }> {
  const counts = new Map<string, number>();
  for (const r of responses) {
    const v = r.data[fieldBind];
    const key = v === undefined || v === null ? '(empty)' : Array.isArray(v) ? v.join(',') : String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = responses.length || 1;
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}
