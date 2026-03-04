import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { formAPI, submissionAPI } from '../lib/api';
import {
    Smartphone, ChevronLeft, Send, RotateCcw,
    MapPin, Camera as CameraIcon, CheckCircle2, AlertCircle
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

interface UIField {
    type: string;
    label: string;
    bind: string;
    placeholder?: string;
    options?: any[];
    table_columns?: any[];
    table_rows?: any[];
    table_cell_type?: string;
    min?: string | number;
    max?: string | number;
    default_value?: string;
    mask?: string;
    lookup_source_type?: 'preset' | 'custom';
    lookup_preset_id?: string;
    lookup_custom_data?: string;
    lookup_separator?: string;
    lookup_label_column?: number;
    lookup_value_column?: number;
}

interface LogicCondition {
    field: string;
    operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
    value: any;
}

interface LogicRule {
    id: string;
    type: 'section_jump' | 'field_visibility';
    action: 'jump_to' | 'show' | 'hide';
    target_id: string;
    source_id?: string;
    conditions: LogicCondition[];
    logic_operator: 'AND' | 'OR';
}

interface FormBlueprint {
    meta?: {
        title?: string;
    };
    ui: Array<{
        id: string;
        title: string;
        children: UIField[];
    }>;
    logic?: LogicRule[];
}

const getOptionValue = (opt: any) => typeof opt === 'object' && opt !== null ? opt.value : opt;
const getOptionLabel = (opt: any) => typeof opt === 'object' && opt !== null ? opt.label : opt;

const applyMask = (value: string, mask: string) => {
    if (!mask) return value;
    const rawValue = value.replace(/[^a-zA-Z0-9]/g, '');
    let formattedValue = '';
    let rawIndex = 0;

    for (let i = 0; i < mask.length; i++) {
        if (rawIndex >= rawValue.length) {
            break;
        }

        const maskChar = mask[i];
        const char = rawValue[rawIndex];

        if (maskChar === '9') {
            if (/[0-9]/.test(char)) { formattedValue += char; rawIndex++; }
            else { break; }
        } else if (maskChar === 'A') {
            if (/[a-zA-Z]/.test(char)) { formattedValue += char.toUpperCase(); rawIndex++; }
            else { break; }
        } else if (maskChar === 'a') {
            if (/[a-zA-Z]/.test(char)) { formattedValue += char.toLowerCase(); rawIndex++; }
            else { break; }
        } else if (maskChar === '*') {
            formattedValue += char; rawIndex++;
        } else {
            formattedValue += maskChar;
            if (/[a-zA-Z0-9]/.test(maskChar) && char.toLowerCase() === maskChar.toLowerCase()) {
                rawIndex++;
            }
        }
    }
    return formattedValue;
};

const LookupFieldRenderer = ({ field, value, onChange }: any) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    const parsedData = React.useMemo(() => {
        if (field.lookup_source_type === 'preset') {
            if (field.lookup_preset_id === 'global_countries') return [{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'USA', value: 'us' }, { label: 'United Kingdom', value: 'uk' }];
            if (field.lookup_preset_id === 'african_countries') return [{ label: 'Ghana', value: 'gh' }, { label: 'Nigeria', value: 'ng' }, { label: 'Kenya', value: 'ke' }];
            if (field.lookup_preset_id === 'us_states') return [{ label: 'California', value: 'ca' }, { label: 'New York', value: 'ny' }, { label: 'Texas', value: 'tx' }];
            return [];
        }
        if (field.lookup_source_type === 'custom' && field.lookup_custom_data) {
            const sep = field.lookup_separator || ',';
            const lines = field.lookup_custom_data.split('\n').filter(Boolean);
            return lines.map((line: string) => {
                const cols = line.split(sep);
                const lCol = field.lookup_label_column ?? 0;
                const vCol = field.lookup_value_column ?? 0;
                return {
                    label: (cols[lCol] || cols[0])?.trim(),
                    value: (cols[vCol] || cols[0])?.trim()
                };
            });
        }
        return [];
    }, [field]);

    useEffect(() => {
        if (field.default_value && parsedData.length > 0 && !value) {
            const idx = parseInt(field.default_value);
            if (!isNaN(idx) && parsedData[idx]) {
                onChange(parsedData[idx].value);
            }
        }
    }, [field.default_value, parsedData, value, onChange]);

    useEffect(() => {
        if (value && !isOpen) {
            const selected = parsedData.find((d: any) => d.value === value);
            if (selected) setSearch(selected.label);
        }
    }, [value, isOpen, parsedData]);

    const matching = parsedData.filter((d: any) => d.label.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="relative">
            <input
                type="text"
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setIsOpen(true);
                    if (!e.target.value) onChange(null);
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                placeholder={field.placeholder || "Search items..."}
                className="w-full bg-[hsl(var(--surface-elevated))] border-2 border-transparent focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--surface))] rounded-2xl px-5 py-4 text-[hsl(var(--text-primary))] transition-all placeholder:text-[hsl(var(--text-tertiary))] font-medium"
            />
            {isOpen && matching.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-xl rounded-2xl max-h-60 overflow-y-auto z-50 p-2">
                    {matching.slice(0, 50).map((m: any, i: number) => (
                        <div
                            key={i}
                            onMouseDown={() => {
                                onChange(m.value);
                                setSearch(m.label);
                                setIsOpen(false);
                            }}
                            className={`px-4 py-3 rounded-xl cursor-pointer transition-all ${m.value === value ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] font-bold' : 'hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'}`}
                        >
                            {m.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const FormSimulator: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [blueprint, setBlueprint] = useState<FormBlueprint | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

    const isOtherSelected = (val: any) => {
        if (!val) return false;
        if (Array.isArray(val)) {
            return val.some(v => v.toLowerCase().includes('other'));
        }
        return typeof val === 'string' && val.toLowerCase().includes('other');
    };

    useEffect(() => {
        const fetchForm = async () => {
            if (!formId) return;
            try {
                const data = await formAPI.get(formId);
                const loaded = data.blueprint_draft || data.blueprint_live;
                if (loaded) {
                    setBlueprint(loaded);

                    // Pre-fill formData with any defined default values
                    const initialData: Record<string, any> = {};
                    (loaded.ui || []).forEach((section: any) => {
                        (section.children || []).forEach((field: any) => {
                            if (field.default_value !== undefined && field.default_value !== null && field.default_value !== '') {
                                if (field.type === 'toggle') {
                                    initialData[field.bind] = field.default_value === 'true';
                                } else if (field.type === 'checkbox_group') {
                                    try {
                                        initialData[field.bind] = JSON.parse(field.default_value);
                                    } catch {
                                        initialData[field.bind] = [field.default_value];
                                    }
                                } else {
                                    initialData[field.bind] = field.default_value;
                                }
                            }
                        });
                    });
                    setFormData(initialData);

                } else {
                    setBlueprint({
                        ui: [{
                            id: 'screen_1',
                            title: 'Initial Section',
                            children: [
                                { type: 'input_text', label: 'Store Name', bind: 'store_name' },
                                { type: 'input_number', label: 'Stock Level', bind: 'stock_level' },
                                { type: 'gps_capture', label: 'Visit Location', bind: 'location' },
                                { type: 'photo_capture', label: 'Store Front Photo', bind: 'photo' }
                            ]
                        }]
                    });
                }

                // Jump to section if provided in URL
                const sectionParam = searchParams.get('section');
                if (sectionParam) {
                    const loadedBlueprint = data.blueprint_draft || data.blueprint_live;
                    if (loadedBlueprint && loadedBlueprint.ui) {
                        const targetIdx = loadedBlueprint.ui.findIndex((s: any) => s.id === sectionParam);
                        if (targetIdx !== -1) {
                            setCurrentSectionIndex(targetIdx);
                        }
                    }
                }

                setIsLoading(false);
            } catch (err) {
                setIsLoading(false);
            }
        };
        fetchForm();
    }, [formId]);

    const handleInputChange = (key: string, value: any) => {
        setFormData({ ...formData, [key]: value });
    };

    const toggleCheckboxValue = (key: string, value: string, checked: boolean) => {
        const current = Array.isArray(formData[key]) ? formData[key] : [];
        const next = checked ? [...current, value] : current.filter((v: string) => v !== value);
        handleInputChange(key, next);
    };

    const captureGPS = () => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                handleInputChange('location', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            }, (error) => {
                alert("Error capturing location: " + error.message);
            });
        }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, bind: string) => {
        const file = e.target.files?.[0];
        if (file) {
            // Mocking photo capture as a string for now
            handleInputChange(bind, `file://${file.name} (uploaded)`);
        }
    };

    const evaluateRule = (rule: LogicRule) => {
        if (!rule.conditions.length) return true;

        const results = rule.conditions.map(cond => {
            const val = formData[cond.field];
            const targetVal = cond.value;

            switch (cond.operator) {
                case 'eq': return String(val || '') === String(targetVal);
                case 'neq': return String(val || '') !== String(targetVal);
                case 'contains': return String(val || '').toLowerCase().includes(String(targetVal).toLowerCase());
                case 'gt': return Number(val) > Number(targetVal);
                case 'lt': return Number(val) < Number(targetVal);
                default: return false;
            }
        });

        if (rule.logic_operator === 'OR') return results.some(r => r);
        return results.every(r => r);
    };

    const isFieldVisible = (fieldId: string) => {
        const rules = (blueprint?.logic || []).filter(r => r.type === 'field_visibility' && r.target_id === fieldId);
        if (rules.length === 0) return true;
        // If any visibility rule matches, show it
        return rules.some(r => {
            const match = evaluateRule(r);
            return r.action === 'show' ? match : !match;
        });
    };

    const handleNext = () => {
        if (!blueprint) return;
        const currentSectionId = blueprint.ui[currentSectionIndex].id;
        const jumpRule = (blueprint.logic || []).find(r => r.type === 'section_jump' && r.source_id === currentSectionId && evaluateRule(r));

        if (jumpRule) {
            if (jumpRule.target_id === 'end') {
                handleSubmit();
                return;
            }
            const targetIndex = blueprint.ui.findIndex(p => p.id === jumpRule.target_id);
            if (targetIndex !== -1) {
                setCurrentSectionIndex(targetIndex);
                return;
            }
        }

        // Default next
        setCurrentSectionIndex(prev => prev + 1);
    };

    const handleSubmit = async () => {
        if (!formId) return;
        setStatus('submitting');
        try {
            await submissionAPI.create({
                form_id: formId,
                data: formData,
                metadata: {
                    source: 'web_simulator',
                    user_agent: navigator.userAgent
                }
            });
            setStatus('success');
            setTimeout(() => setStatus('idle'), 3000);
        } catch (err) {
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    if (isLoading) return <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center text-[hsl(var(--text-primary))]">Loading Simulator...</div>;

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-8">
            <div className="flex flex-col items-center">
                {/* Simulator Controls */}
                <div className="mb-8 flex space-x-4 items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-3 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all shadow-xl"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => { setFormData({}); setStatus('idle'); }}
                        className="p-3 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-all shadow-xl"
                    >
                        <RotateCcw className="w-6 h-6" />
                    </button>
                    <ThemeToggle />
                </div>

                {/* Device Frame */}
                <div className="relative w-[380px] h-[780px] bg-[hsl(var(--surface))] rounded-[60px] border-[8px] border-[hsl(var(--border))] shadow-[0_30px_80px_rgba(0,0,0,0.2)] overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-8 bg-[hsl(var(--surface-elevated))] rounded-b-3xl z-20"></div>

                    <div className="absolute inset-0 bg-[hsl(var(--surface))] overflow-y-auto">
                        <header className="pt-16 pb-6 px-6 bg-[hsl(var(--surface))] border-b border-[hsl(var(--border))] sticky top-0 z-10">
                            <h1 className="text-2xl font-bold text-[hsl(var(--text-primary))] leading-tight">{blueprint?.meta?.title || 'Simulator Preview'}</h1>
                            <p className="text-[hsl(var(--text-tertiary))] text-xs font-medium uppercase tracking-wider mt-1">Submission Draft</p>
                        </header>

                        <div className="p-6 space-y-6">
                            {(blueprint?.ui[currentSectionIndex]?.children || [])
                                .filter(field => isFieldVisible(field.bind))
                                .map((field, idx) => (
                                    <div key={idx} className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <label className="text-sm font-bold text-[hsl(var(--text-secondary))] block">
                                            {field.label}
                                        </label>

                                        {field.type === 'gps_capture' ? (
                                            <button
                                                onClick={captureGPS}
                                                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all ${formData[field.bind] ? 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))] text-[hsl(var(--success))]' : 'bg-[hsl(var(--surface-elevated))] border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))]'}`}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <MapPin className={`w-5 h-5 ${formData[field.bind] ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--text-tertiary))]'}`} />
                                                    <span className="font-semibold text-sm">
                                                        {formData[field.bind] ? `Location Captured` : `Click to capture GPS`}
                                                    </span>
                                                </div>
                                                {formData[field.bind] && <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />}
                                            </button>
                                        ) : field.type === 'photo_capture' ? (
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => handlePhotoUpload(e, field.bind)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                />
                                                <div className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all ${formData[field.bind] ? 'bg-[hsl(var(--info))]/10 border-[hsl(var(--info))] text-[hsl(var(--info))]' : 'bg-[hsl(var(--surface-elevated))] border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))]'}`}>
                                                    <div className="flex items-center space-x-3">
                                                        <CameraIcon className={`w-5 h-5 ${formData[field.bind] ? 'text-[hsl(var(--info))]' : 'text-[hsl(var(--text-tertiary))]'}`} />
                                                        <span className="font-semibold text-sm">
                                                            {formData[field.bind] ? `Photo Attached` : `Tap to take photo`}
                                                        </span>
                                                    </div>
                                                    {formData[field.bind] && <CheckCircle2 className="w-5 h-5 text-[hsl(var(--info))]" />}
                                                </div>
                                            </div>
                                        ) : field.type === 'file_upload' || field.type === 'audio_recorder' ? (
                                            <input
                                                type="file"
                                                accept={field.type === 'audio_recorder' ? 'audio/*' : undefined}
                                                onChange={(e) => handleInputChange(field.bind, e.target.files?.[0]?.name)}
                                                className="w-full bg-[hsl(var(--surface-elevated))] border-2 border-transparent focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--surface))] rounded-2xl px-5 py-4 text-[hsl(var(--text-primary))] transition-all placeholder:text-[hsl(var(--text-tertiary))] font-medium"
                                            />
                                        ) : field.type === 'signature_pad' ? (
                                            <button
                                                type="button"
                                                onClick={() => handleInputChange(field.bind, 'signed')}
                                                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all bg-[hsl(var(--surface-elevated))] border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))]"
                                            >
                                                <span className="font-semibold text-sm">Tap to sign</span>
                                                {formData[field.bind] && <CheckCircle2 className="w-5 h-5 text-[hsl(var(--success))]" />}
                                            </button>
                                        ) : field.type === 'dropdown' ? (
                                            <div className="space-y-2">
                                                <select
                                                    value={formData[field.bind] || ''}
                                                    onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                                    className="w-full bg-[hsl(var(--surface-elevated))] border-2 border-transparent focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--surface))] rounded-2xl px-5 py-4 text-[hsl(var(--text-primary))] transition-all"
                                                >
                                                    <option value="" disabled>Select an option</option>
                                                    {(field.options || []).map((opt, i) => (
                                                        <option key={`${getOptionValue(opt)}-${i}`} value={getOptionValue(opt)}>{getOptionLabel(opt)}</option>
                                                    ))}
                                                </select>
                                                {isOtherSelected(formData[field.bind]) && (
                                                    <input
                                                        type="text"
                                                        value={formData[field.bind + '_other'] || ''}
                                                        onChange={(e) => handleInputChange(field.bind + '_other', e.target.value)}
                                                        className="w-full mt-2 bg-[hsl(var(--surface-elevated))] border-2 border-dashed border-[hsl(var(--border))] focus:border-solid focus:border-[hsl(var(--primary))] rounded-2xl px-5 py-3 text-[hsl(var(--text-primary))] transition-all font-medium text-sm"
                                                        placeholder="Please specify..."
                                                    />
                                                )}
                                            </div>
                                        ) : field.type === 'radio_group' ? (
                                            <div className="space-y-2">
                                                {(field.options || []).map((opt, i) => (
                                                    <label key={`${getOptionValue(opt)}-${i}`} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                                        <input
                                                            type="radio"
                                                            name={field.bind}
                                                            value={getOptionValue(opt)}
                                                            checked={formData[field.bind] === getOptionValue(opt)}
                                                            onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                                        />
                                                        {getOptionLabel(opt)}
                                                    </label>
                                                ))}
                                                {isOtherSelected(formData[field.bind]) && (
                                                    <input
                                                        type="text"
                                                        value={formData[field.bind + '_other'] || ''}
                                                        onChange={(e) => handleInputChange(field.bind + '_other', e.target.value)}
                                                        className="w-full mt-2 bg-[hsl(var(--surface-elevated))] border-2 border-dashed border-[hsl(var(--border))] focus:border-solid focus:border-[hsl(var(--primary))] rounded-2xl px-5 py-3 text-[hsl(var(--text-primary))] transition-all font-medium text-sm"
                                                        placeholder="Please specify..."
                                                    />
                                                )}
                                            </div>
                                        ) : field.type === 'checkbox_group' ? (
                                            <div className="space-y-2">
                                                {(field.options || []).map((opt, i) => (
                                                    <label key={`${getOptionValue(opt)}-${i}`} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                                        <input
                                                            type="checkbox"
                                                            checked={(formData[field.bind] || []).includes(getOptionValue(opt))}
                                                            onChange={(e) => toggleCheckboxValue(field.bind, getOptionValue(opt), e.target.checked)}
                                                        />
                                                        {getOptionLabel(opt)}
                                                    </label>
                                                ))}
                                                {isOtherSelected(formData[field.bind]) && (
                                                    <input
                                                        type="text"
                                                        value={formData[field.bind + '_other'] || ''}
                                                        onChange={(e) => handleInputChange(field.bind + '_other', e.target.value)}
                                                        className="w-full mt-2 bg-[hsl(var(--surface-elevated))] border-2 border-dashed border-[hsl(var(--border))] focus:border-solid focus:border-[hsl(var(--primary))] rounded-2xl px-5 py-3 text-[hsl(var(--text-primary))] transition-all font-medium text-sm"
                                                        placeholder="Please specify..."
                                                    />
                                                )}
                                            </div>
                                        ) : field.type === 'toggle' ? (
                                            <label className="flex items-center gap-3 text-sm text-[hsl(var(--text-secondary))]">
                                                <input
                                                    type="checkbox"
                                                    checked={!!formData[field.bind]}
                                                    onChange={(e) => handleInputChange(field.bind, e.target.checked)}
                                                />
                                                Toggle
                                            </label>
                                        ) : field.type === 'textarea' ? (
                                            <textarea
                                                value={formData[field.bind] || ''}
                                                onChange={(e) => handleInputChange(field.bind, e.target.value)}
                                                className="w-full bg-[hsl(var(--surface-elevated))] border-2 border-transparent focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--surface))] rounded-2xl px-5 py-4 text-[hsl(var(--text-primary))] transition-all placeholder:text-[hsl(var(--text-tertiary))] font-medium min-h-[120px]"
                                                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            />
                                        ) : field.type === 'lookup_list' ? (
                                            <LookupFieldRenderer
                                                field={field}
                                                value={formData[field.bind]}
                                                onChange={(val: any) => handleInputChange(field.bind, val)}
                                            />
                                        ) : field.type === 'matrix_table' ? (
                                            <div className="w-full max-h-[500px] overflow-auto hide-scrollbar rounded-2xl border border-[hsl(var(--border))] relative relative-z-0">
                                                <table className="w-full text-xs text-left min-w-max">
                                                    <thead className="bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))] sticky top-0 z-10 shadow-sm">
                                                        <tr>
                                                            <th className="px-3 py-3 font-medium min-w-[120px]">&nbsp;</th>
                                                            {(field.table_columns || []).map((col: any) => (
                                                                <th key={col.id} className="px-2 py-3 font-medium text-center min-w-[80px]">{col.label}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(field.table_rows || []).map((row: any, rIdx: number) => (
                                                            <tr key={row.id} className={`border-t border-[hsl(var(--border))] ${rIdx % 2 === 0 ? 'bg-[hsl(var(--surface))]' : 'bg-[hsl(var(--surface-elevated))]'}`}>
                                                                <td className="px-3 py-3 font-medium text-[hsl(var(--text-primary))]">{row.label}</td>
                                                                {(field.table_columns || []).map((col: any) => {
                                                                    const cellType = field.table_cell_type || 'radio';
                                                                    const fieldData = formData[field.bind] || {};
                                                                    const rowData = fieldData[row.id];

                                                                    return (
                                                                        <td key={col.id} className="px-2 py-3 text-center">
                                                                            {cellType === 'radio' ? (
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`${field.bind}_${row.id}`}
                                                                                    checked={rowData === col.id}
                                                                                    onChange={() => handleInputChange(field.bind, { ...fieldData, [row.id]: col.id })}
                                                                                    className="w-4 h-4 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                                />
                                                                            ) : cellType === 'checkbox' ? (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={(rowData || []).includes(col.id)}
                                                                                    onChange={(e) => {
                                                                                        const currentArr = rowData || [];
                                                                                        const nextArr = e.target.checked
                                                                                            ? [...currentArr, col.id]
                                                                                            : currentArr.filter((id: string) => id !== col.id);
                                                                                        handleInputChange(field.bind, { ...fieldData, [row.id]: nextArr });
                                                                                    }}
                                                                                    className="w-4 h-4 rounded text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                                />
                                                                            ) : cellType === 'text' || cellType === 'number' ? (
                                                                                <input
                                                                                    type={cellType}
                                                                                    value={rowData?.[col.id] || ''}
                                                                                    onChange={(e) => {
                                                                                        const currentRow = fieldData[row.id] || {};
                                                                                        handleInputChange(field.bind, {
                                                                                            ...fieldData,
                                                                                            [row.id]: { ...currentRow, [col.id]: e.target.value }
                                                                                        });
                                                                                    }}
                                                                                    className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded px-2 py-1.5 text-center text-xs"
                                                                                />
                                                                            ) : cellType === 'dropdown' ? (
                                                                                <select
                                                                                    value={rowData?.[col.id] || ''}
                                                                                    onChange={(e) => {
                                                                                        const currentRow = fieldData[row.id] || {};
                                                                                        handleInputChange(field.bind, {
                                                                                            ...fieldData,
                                                                                            [row.id]: { ...currentRow, [col.id]: e.target.value }
                                                                                        });
                                                                                    }}
                                                                                    className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] rounded px-1 py-1 text-center text-xs text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value=""></option>
                                                                                    {(field.options || []).map((opt: any, oIdx: number) => (
                                                                                        <option key={oIdx} value={getOptionValue(opt)}>{getOptionLabel(opt)}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : null}
                                                                        </td>
                                                                    );
                                                                })}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <input
                                                type={field.type === 'input_number' ? 'number' : field.type === 'email_input' ? 'email' : field.type === 'phone_input' ? 'tel' : field.type === 'date_picker' ? 'date' : field.type === 'time_picker' ? 'time' : 'text'}
                                                value={formData[field.bind] || ''}
                                                onChange={(e) => handleInputChange(field.bind, field.mask ? applyMask(e.target.value, field.mask) : e.target.value)}
                                                className="w-full bg-[hsl(var(--surface-elevated))] border-2 border-transparent focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--surface))] rounded-2xl px-5 py-4 text-[hsl(var(--text-primary))] transition-all placeholder:text-[hsl(var(--text-tertiary))] font-medium"
                                                placeholder={field.placeholder || (field.mask ? field.mask : `Enter ${field.label.toLowerCase()}...`)}
                                                min={field.min}
                                                max={field.max}
                                            />
                                        )}
                                    </div>
                                ))}

                            {/* Pagination Controls */}
                            <div className="pt-6 flex gap-3">
                                {currentSectionIndex > 0 && (
                                    <button
                                        onClick={() => setCurrentSectionIndex(prev => prev - 1)}
                                        className="flex-1 font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-2 bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--surface))]"
                                    >
                                        <span>Back</span>
                                    </button>
                                )}

                                {currentSectionIndex < (blueprint?.ui.length || 1) - 1 ? (
                                    <button
                                        onClick={handleNext}
                                        className="flex-1 font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white shadow-[hsl(var(--primary))]/30"
                                    >
                                        <span>Next</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={status === 'submitting' || status === 'success'}
                                        className={`flex-1 font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center space-x-2 ${status === 'success' ? 'bg-[hsl(var(--success))] text-white shadow-[hsl(var(--success))]/30' :
                                            status === 'error' ? 'bg-[hsl(var(--error))] text-white shadow-[hsl(var(--error))]/30' :
                                                'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] text-white shadow-[hsl(var(--primary))]/30'
                                            }`}
                                    >
                                        {status === 'submitting' ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        ) : status === 'success' ? (
                                            <>
                                                <CheckCircle2 className="w-5 h-5" />
                                                <span>Sent Successfully</span>
                                            </>
                                        ) : status === 'error' ? (
                                            <>
                                                <AlertCircle className="w-5 h-5" />
                                                <span>Submission Failed</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-5 h-5" />
                                                <span>Submit Data</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-[hsl(var(--border))] rounded-full z-20"></div>
                </div>

                <div className="mt-8 flex items-center space-x-2 text-[hsl(var(--text-tertiary))]">
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Mobile Preview Engine v2.0</span>
                </div>
            </div>
        </div>
    );
};

export default FormSimulator;
