import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView, TextInput, ActivityIndicator } from 'react-native';
import { FormField } from '@opla/types';
import { loadLookupOptions, LookupContext, LookupOption, resolveStaticLookupOptions } from '../../utils/lookupCache';
import { fmtDateTime } from '../../utils/dateFormat';

interface Props {
    field: FormField;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    lookupContext: LookupContext;
}

export function LookupListField({ field, value, onChange, error, lookupContext }: Props) {
    const [modalVisible, setModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [options, setOptions] = useState<LookupOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastSyncLabel, setLastSyncLabel] = useState<string | null>(null);

    const syncIntervalMinutes = field.lookup_sync_interval_minutes || 15;

    const customOptions = useMemo(() => resolveStaticLookupOptions(field), [field]);

    useEffect(() => {
        let cancelled = false;
        const hydrateOptions = async (forceRefresh = false) => {
            try {
                setLoading(true);
                const { options: nextOptions, syncedAt } = await loadLookupOptions(field, lookupContext, forceRefresh);

                if (!cancelled) {
                    setOptions(nextOptions);
                    if (syncedAt) {
                        setLastSyncLabel(fmtDateTime(syncedAt));
                    }
                }
            } catch {
                // If refresh fails we keep the cached data and continue offline.
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        if (field.lookup_source_type === 'dataset') {
            hydrateOptions();
            const timer = setInterval(() => {
                hydrateOptions(true);
            }, syncIntervalMinutes * 60 * 1000);
            return () => {
                cancelled = true;
                clearInterval(timer);
            };
        }

        setOptions(customOptions);
        setLastSyncLabel(null);
        return () => {
            cancelled = true;
        };
    }, [
        customOptions,
        field.lookup_allow_stale_cache,
        field.lookup_dataset_id,
        field.lookup_dataset_label_field,
        field.lookup_dataset_value_field,
        field.lookup_source_type,
        lookupContext.formId,
        lookupContext.mode,
        lookupContext.slug,
        syncIntervalMinutes,
    ]);

    useEffect(() => {
        if (field.lookup_source_type === 'preset') {
            if (field.lookup_preset_id === 'global_countries') setOptions([{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'USA', value: 'us' }, { label: 'United Kingdom', value: 'uk' }]);
            else if (field.lookup_preset_id === 'african_countries') setOptions([{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'Kenya', value: 'ke' }]);
            else if (field.lookup_preset_id === 'us_states') setOptions([{ label: 'California', value: 'ca' }, { label: 'New York', value: 'ny' }, { label: 'Texas', value: 'tx' }]);
            else setOptions([]);
        }
    }, [field.lookup_preset_id, field.lookup_source_type]);

    const selectedOption = options.find(o => o.value === value);

    // Filter based on search query
    const filteredOptions = options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
                onPress={() => setModalVisible(true)}
                style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderWidth: 1.5,
                    borderColor: error ? '#ef4444' : '#334155',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <Text style={{ color: selectedOption ? '#f1f5f9' : '#475569', fontSize: 16 }}>
                    {selectedOption ? selectedOption.label : (field.placeholder || "Tap to search...")}
                </Text>
                <Text style={{ color: '#94a3b8' }}>??</Text>
            </TouchableOpacity>

            {error && (
                <Text style={{ color: '#ef4444', fontSize: 13, marginTop: 6 }}>{error}</Text>
            )}
            {!error && field.lookup_source_type === 'dataset' && lastSyncLabel && (
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
                    Cached lookup � last sync {lastSyncLabel}
                </Text>
            )}

            <Modal visible={modalVisible} transparent={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <SafeAreaView style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' }}>
                        <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '700' }}>Search {field.label}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Text style={{ color: '#158754', fontSize: 16, fontWeight: '600' }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholder="Type to filter..."
                                placeholderTextColor="#475569"
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: 10,
                                    padding: 12,
                                    color: '#f1f5f9',
                                    borderWidth: 1,
                                    borderColor: '#334155'
                                }}
                            />
                        </View>
                        {loading ? <ActivityIndicator color="#158754" style={{ marginTop: 16 }} /> : null}
                        <FlatList
                            data={filteredOptions}
                            keyExtractor={(item, idx) => `${item.value}-${idx}`}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        onChange(item.value);
                                        setModalVisible(false);
                                    }}
                                    style={{
                                        padding: 16,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#1e293b',
                                        flexDirection: 'row',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <Text style={{ color: value === item.value ? '#158754' : '#f1f5f9', fontSize: 16, fontWeight: value === item.value ? '700' : '400' }}>
                                        {item.label}
                                    </Text>
                                    {value === item.value && <Text style={{ color: '#158754', fontSize: 16 }}>?</Text>}
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={{ padding: 32, alignItems: 'center' }}>
                                    <Text style={{ color: '#64748b' }}>No results found</Text>
                                </View>
                            }
                        />
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
