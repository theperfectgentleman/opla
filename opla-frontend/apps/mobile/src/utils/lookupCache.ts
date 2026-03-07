import AsyncStorage from '@react-native-async-storage/async-storage';
import { FormBlueprint, FormField } from '@opla/types';

import { deskFormAPI, publicFormAPI } from '../../services/api';

export type LookupContext = {
  mode: 'public' | 'desk';
  formId?: string;
  slug?: string;
};

export type LookupOption = {
  label: string;
  value: string;
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
    const labelCol = field.lookup_label_column || 1;
    const valueCol = field.lookup_value_column || 1;

    return dataString
      .split('\n')
      .filter(row => row.trim() !== '')
      .map((row, index) => {
        const cols = row.split(separator);
        const rowLabel = cols[labelCol - 1] || `Row ${index}`;
        const rowValue = cols[valueCol - 1] || rowLabel;
        return { label: rowLabel.trim(), value: rowValue.trim() };
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
  const response = context.mode === 'desk' && context.formId
    ? await deskFormAPI.lookupOptions(context.formId, field.lookup_dataset_id, params)
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