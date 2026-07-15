import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormBlueprint, FormField } from '@opla/types';

import { agentFormAPI, publicFormAPI } from '../../services/api';

export type LookupContext = {
  mode: 'public' | 'agent';
  formId?: string;
  slug?: string;
};

export type LookupOption = {
  label: string;
  value: string;
  row_cols?: string[];
  row_data?: Record<string, any>;
};

const cacheKey = (context: LookupContext, field: FormField) => [
  'opla_lookup',
  context.mode,
  context.formId || context.slug || 'unknown',
  field.lookup_dataset_id || field.lookup_preset_id || 'lookup',
  field.lookup_dataset_label_field || String(field.lookup_label_column || 0),
  field.lookup_dataset_value_field || String(field.lookup_value_column || 0),
].join(':');

export function resolveStaticLookupOptions(field: FormField): LookupOption[] {
  if (field.lookup_source_type === 'preset') {
    if (field.lookup_preset_id === 'global_countries') return [{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'USA', value: 'us' }, { label: 'United Kingdom', value: 'uk' }];
    if (field.lookup_preset_id === 'african_countries') return [{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'Kenya', value: 'ke' }];
    if (field.lookup_preset_id === 'us_states') return [{ label: 'California', value: 'ca' }, { label: 'New York', value: 'ny' }, { label: 'Texas', value: 'tx' }];
    return [];
  }

  if (field.lookup_source_type === 'custom') {
    const dataString = field.lookup_custom_data || '';
    const separator = field.lookup_separator || ',';

    const trimmed = dataString.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const labelKey = String(field.lookup_label_column || '');
          const valueKey = String(field.lookup_value_column || '');

          return parsed.map((item, index) => {
            let label = '';
            let value = '';
            let row_data: Record<string, any> = {};

            if (item && typeof item === 'object') {
              row_data = item;
              if (labelKey && item[labelKey] !== undefined) {
                label = String(item[labelKey]);
              } else {
                const keys = Object.keys(item);
                const labelIdx = parseInt(labelKey, 10);
                if (!isNaN(labelIdx) && keys[labelIdx - 1] !== undefined) {
                  label = String(item[keys[labelIdx - 1]]);
                } else {
                  label = String(item[keys[0]] || `Row ${index}`);
                }
              }

              if (valueKey && item[valueKey] !== undefined) {
                value = String(item[valueKey]);
              } else {
                const keys = Object.keys(item);
                const valueIdx = parseInt(valueKey, 10);
                if (!isNaN(valueIdx) && keys[valueIdx - 1] !== undefined) {
                  value = String(item[keys[valueIdx - 1]]);
                } else {
                  value = label;
                }
              }
            } else {
              label = String(item);
              value = String(item);
              row_data = { value: item };
            }

            return {
              label: label.trim(),
              value: value.trim(),
              row_data,
            };
          });
        }
      } catch {
        // Fallback to CSV
      }
    }

    const lines = dataString.split('\n').map(l => l.trim()).filter(l => l !== '');
    if (lines.length === 0) return [];

    const firstLineCols = lines[0].split(separator).map(c => c.trim());
    const labelColVal = String(field.lookup_label_column || '1');
    const valueColVal = String(field.lookup_value_column || '1');

    const isLabelColNumeric = /^\d+$/.test(labelColVal);
    const isValueColNumeric = /^\d+$/.test(valueColVal);

    let hasHeader = false;
    const normalizedFirstLine = firstLineCols.map(c => c.toLowerCase());
    if (
      (!isLabelColNumeric && labelColVal !== '') ||
      (!isValueColNumeric && valueColVal !== '') ||
      normalizedFirstLine.includes(labelColVal.toLowerCase()) ||
      normalizedFirstLine.includes(valueColVal.toLowerCase())
    ) {
      hasHeader = true;
    }

    const headers = hasHeader
      ? firstLineCols
      : firstLineCols.map((_, idx) => `Column ${idx + 1}`);

    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map((row, index) => {
      const cols = row.split(separator).map(c => c.trim());

      let label = '';
      let value = '';
      const row_data: Record<string, any> = {};

      headers.forEach((header, idx) => {
        row_data[header] = cols[idx] || '';
      });

      if (hasHeader) {
        const labelIdx = headers.findIndex(h => h.toLowerCase() === labelColVal.toLowerCase());
        if (labelIdx >= 0) {
          label = cols[labelIdx] || '';
        } else {
          const idx = parseInt(labelColVal, 10);
          label = (!isNaN(idx) && cols[idx - 1] !== undefined) ? cols[idx - 1] : (cols[0] || `Row ${index}`);
        }
      } else {
        const idx = parseInt(labelColVal, 10);
        label = (!isNaN(idx) && cols[idx - 1] !== undefined) ? cols[idx - 1] : (cols[0] || `Row ${index}`);
      }

      if (hasHeader) {
        const valueIdx = headers.findIndex(h => h.toLowerCase() === valueColVal.toLowerCase());
        if (valueIdx >= 0) {
          value = cols[valueIdx] || '';
        } else {
          const idx = parseInt(valueColVal, 10);
          value = (!isNaN(idx) && cols[idx - 1] !== undefined) ? cols[idx - 1] : label;
        }
      } else {
        const idx = parseInt(valueColVal, 10);
        value = (!isNaN(idx) && cols[idx - 1] !== undefined) ? cols[idx - 1] : label;
      }

      return {
        label: label.trim(),
        value: value.trim(),
        row_cols: cols,
        row_data,
      };
    });
  }

  return [];
}

export async function loadLookupOptions(
  field: FormField,
  context: LookupContext,
  forceRefresh = false,
): Promise<{ options: LookupOption[]; syncedAt?: string }> {
  if (field.lookup_source_type !== 'dataset' || !field.lookup_dataset_id || !field.lookup_dataset_label_field || !field.lookup_dataset_value_field) {
    return { options: resolveStaticLookupOptions(field) };
  }

  const key = cacheKey(context, field);
  const allowStaleCache = field.lookup_allow_stale_cache ?? true;
  const maxAgeMs = (field.lookup_sync_interval_minutes || 15) * 60 * 1000;
  const now = Date.now();

  try {
    const cachedRaw = await AsyncStorage.getItem(key);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { syncedAt?: string; options?: LookupOption[] };
      const syncedAtMs = cached.syncedAt ? new Date(cached.syncedAt).getTime() : 0;
      if (!forceRefresh && allowStaleCache && Array.isArray(cached.options) && syncedAtMs && now - syncedAtMs < maxAgeMs) {
        return { options: cached.options, syncedAt: cached.syncedAt };
      }
      if (!forceRefresh && allowStaleCache && Array.isArray(cached.options) && !syncedAtMs) {
        return { options: cached.options, syncedAt: cached.syncedAt };
      }
    }
  } catch {
    // ignore cache read issues and try network
  }

  const params = {
    label_field: field.lookup_dataset_label_field,
    value_field: field.lookup_dataset_value_field,
    limit: 250,
  };
  const response = context.mode === 'agent' && context.formId
    ? await agentFormAPI.lookupOptions(context.formId, field.lookup_dataset_id, params)
    : await publicFormAPI.lookupOptions(context.slug || '', field.lookup_dataset_id, params);

  const options = Array.isArray(response?.options)
    ? response.options.map((item: any) => ({ label: String(item.label), value: String(item.value) }))
    : [];
  const syncedAt = response?.synced_at || new Date().toISOString();

  await AsyncStorage.setItem(key, JSON.stringify({ syncedAt, options }));
  return { options, syncedAt };
}

export async function syncAllLookupDatasets(blueprint: FormBlueprint, context: LookupContext): Promise<number> {
  const fields = (blueprint.ui || []).flatMap(section => section.children || []);
  const datasetFields = fields.filter(field => field.lookup_source_type === 'dataset' && field.lookup_dataset_id);

  let synced = 0;
  for (const field of datasetFields) {
    try {
      await loadLookupOptions(field, context, true);
      synced += 1;
    } catch {
      // continue syncing the rest
    }
  }
  return synced;
}