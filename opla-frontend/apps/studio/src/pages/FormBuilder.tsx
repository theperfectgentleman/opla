import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI } from '../lib/api';
import { useOrg } from '../contexts/OrgContext';
import ThemeToggle from '../components/ThemeToggle';
import {
    Save, Play, Trash2, Settings, Smartphone, Layout,
    MapPin, Camera, Type, Hash, CheckSquare, List, Mail,
    Phone, Calendar, Clock, FileText, ToggleLeft, Mic, PenTool, Barcode
} from 'lucide-react';

type Platform = 'mobile' | 'web' | 'ussd';

type FieldType =
    | 'input_text'
    | 'input_number'
    | 'email_input'
    | 'phone_input'
    | 'date_picker'
    | 'time_picker'
    | 'dropdown'
    | 'radio_group'
    | 'checkbox_group'
    | 'toggle'
    | 'textarea'
    | 'gps_capture'
    | 'photo_capture'
    | 'file_upload'
    | 'signature_pad'
    | 'barcode_scanner'
    | 'audio_recorder';

interface FormField {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
    platforms?: Platform[];
}

interface FormBlueprint {
    meta: {
        app_id: string;
        app_id_slug: string;
        form_id: string;
        version: number;
        title: string;
        slug: string;
        is_public: boolean;
        theme: {
            primary_color: string;
            mode: string;
        };
    };
    schema: Array<Record<string, any>>;
    ui: Array<Record<string, any>>;
    logic: Array<Record<string, any>>;
}

const widgetLibrary: Array<{ type: FieldType; label: string; icon: React.ReactNode; defaults?: Partial<FormField> }> = [
    { type: 'input_text', label: 'Text Input', icon: <Type className="w-4 h-4" /> },
    { type: 'input_number', label: 'Number Input', icon: <Hash className="w-4 h-4" /> },
    { type: 'email_input', label: 'Email Input', icon: <Mail className="w-4 h-4" /> },
    { type: 'phone_input', label: 'Phone Input', icon: <Phone className="w-4 h-4" /> },
    { type: 'date_picker', label: 'Date Picker', icon: <Calendar className="w-4 h-4" /> },
    { type: 'time_picker', label: 'Time Picker', icon: <Clock className="w-4 h-4" /> },
    { type: 'dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" />, defaults: { options: ['Option A', 'Option B'] } },
    { type: 'radio_group', label: 'Radio Group', icon: <CheckSquare className="w-4 h-4" />, defaults: { options: ['Option A', 'Option B'] } },
    { type: 'checkbox_group', label: 'Checkbox Group', icon: <CheckSquare className="w-4 h-4" />, defaults: { options: ['Option A', 'Option B'] } },
    { type: 'toggle', label: 'Toggle', icon: <ToggleLeft className="w-4 h-4" /> },
    { type: 'textarea', label: 'Textarea', icon: <FileText className="w-4 h-4" /> },
    { type: 'gps_capture', label: 'GPS Capture', icon: <MapPin className="w-4 h-4" /> },
    { type: 'photo_capture', label: 'Photo Capture', icon: <Camera className="w-4 h-4" /> },
    { type: 'file_upload', label: 'File Upload', icon: <FileText className="w-4 h-4" /> },
    { type: 'signature_pad', label: 'Signature', icon: <PenTool className="w-4 h-4" /> },
    { type: 'barcode_scanner', label: 'Barcode Scanner', icon: <Barcode className="w-4 h-4" /> },
    { type: 'audio_recorder', label: 'Audio Recorder', icon: <Mic className="w-4 h-4" /> },
];

const FormBuilder: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const navigate = useNavigate();
    const { currentOrg } = useOrg();
    const [formMeta, setFormMeta] = useState<{ id: string; project_id: string; slug: string; version: number; is_public: boolean } | null>(null);
    const [title, setTitle] = useState('Untitled Form');
    const [fields, setFields] = useState<FormField[]>([]);
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const basicTypes: FieldType[] = [
        'input_text',
        'input_number',
        'email_input',
        'phone_input',
        'date_picker',
        'time_picker',
        'dropdown',
        'radio_group',
        'checkbox_group',
        'toggle',
        'textarea'
    ];

    const advancedTypes: FieldType[] = [
        'gps_capture',
        'photo_capture',
        'file_upload',
        'signature_pad',
        'barcode_scanner',
        'audio_recorder'
    ];

    const getWidget = (type: FieldType) => widgetLibrary.find((w) => w.type === type);
    const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

    useEffect(() => {
        const loadForm = async () => {
            if (!formId) return;
            try {
                const data = await formAPI.get(formId);
                setFormMeta({
                    id: data.id,
                    project_id: data.project_id,
                    slug: data.slug,
                    version: data.version,
                    is_public: data.is_public
                });
                setTitle(data.title || 'Untitled Form');

                const blueprint = data.blueprint_draft || data.blueprint_live;
                if (blueprint?.ui?.[0]?.children?.length) {
                    const loadedFields: FormField[] = blueprint.ui[0].children.map((child: any) => ({
                        id: child.bind,
                        type: child.type as FieldType,
                        label: child.label || 'Untitled Field',
                        required: !!child.required,
                        placeholder: child.placeholder,
                        options: child.options,
                        platforms: child.platforms
                    }));
                    setFields(loadedFields);
                }
            } catch (err) {
                console.error('Failed to load form', err);
            }
        };

        loadForm();
    }, [formId]);

    const addField = (type: FieldType, defaults?: Partial<FormField>) => {
        const newField: FormField = {
            id: `field_${Date.now()}`,
            type,
            label: `New ${type.replace('_', ' ')}`,
            required: false,
            placeholder: 'Enter value...',
            platforms: ['mobile', 'web'],
            ...defaults
        };
        setFields((prev) => [...prev, newField]);
        setSelectedFieldId(newField.id);
    };

    const removeField = (id: string) => {
        setFields((prev) => prev.filter(f => f.id !== id));
        if (selectedFieldId === id) {
            setSelectedFieldId(null);
        }
    };

    const updateFieldLabel = (id: string, label: string) => {
        setFields((prev) => prev.map(f => f.id === id ? { ...f, label } : f));
    };

    const updateField = (id: string, patch: Partial<FormField>) => {
        setFields((prev) => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    };

    const updateFieldId = (oldId: string, newId: string) => {
        setFields((prev) => prev.map((f) => f.id === oldId ? { ...f, id: newId } : f));
        setSelectedFieldId(newId);
    };

    const mapSchemaType = (type: FieldType) => {
        if (type === 'input_number') return 'integer';
        if (type === 'toggle') return 'boolean';
        if (type === 'date_picker') return 'date';
        if (type === 'time_picker') return 'time';
        if (type === 'gps_capture') return 'geojson';
        if (type === 'checkbox_group') return 'array';
        return 'string';
    };

    const handleSave = async () => {
        if (!formId) return;
        setIsSaving(true);
        try {
            const themeMode = document.documentElement.getAttribute('data-theme') || 'light';
            const primaryColor = currentOrg?.primary_color || '#16a34a';

            const blueprint: FormBlueprint = {
                meta: {
                    app_id: formMeta?.project_id || 'unknown',
                    app_id_slug: formMeta?.project_id ? `project_${formMeta.project_id}` : 'unknown',
                    form_id: formMeta?.id || formId,
                    version: formMeta?.version || 1,
                    title,
                    slug: formMeta?.slug || title.toLowerCase().replace(/\s+/g, '-'),
                    is_public: formMeta?.is_public || false,
                    theme: {
                        primary_color: primaryColor,
                        mode: themeMode
                    }
                },
                schema: fields.map((f) => {
                    const entry: Record<string, any> = {
                        key: f.id,
                        type: mapSchemaType(f.type),
                        required: f.required
                    };
                    if (f.type === 'checkbox_group') {
                        entry.items = { type: 'string' };
                    }
                    return entry;
                }),
                ui: [
                    {
                        id: 'screen_1',
                        type: 'screen',
                        title: 'Page 1',
                        children: fields.map(f => ({
                            type: f.type,
                            bind: f.id,
                            label: f.label,
                            required: f.required,
                            placeholder: f.placeholder,
                            options: f.options,
                            platforms: f.platforms
                        }))
                    }
                ],
                logic: []
            };
            await formAPI.updateBlueprint(formId, blueprint);
            alert('Form saved successfully!');
        } catch (err) {
            console.error('Save failed', err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))]">
            {/* Header */}
            <header className="h-16 border-b border-[hsl(var(--border))] flex items-center justify-between px-6 bg-[hsl(var(--surface))]/70 backdrop-blur-md">
                <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
                        <Layout className="w-6 h-6 text-white" />
                    </div>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="bg-transparent border-none text-xl font-bold focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2"
                    />
                </div>
                <div className="flex items-center space-x-3">
                    <ThemeToggle />
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center space-x-2 bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--surface))] px-4 py-2 rounded-xl transition-all border border-[hsl(var(--border))]"
                    >
                        <Save className="w-4 h-4" />
                        <span>{isSaving ? 'Saving...' : 'Save'}</span>
                    </button>
                    <button
                        onClick={() => navigate(`/simulator/${formId}`)}
                        className="flex items-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] px-4 py-2 rounded-xl transition-all shadow-lg shadow-black/10 text-white"
                    >
                        <Play className="w-4 h-4" />
                        <span>Simulator</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: Widgets */}
                <aside className="w-72 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6 flex flex-col space-y-2">
                    <h3 className="text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-4">Basic Widgets</h3>
                    {basicTypes.map((type) => {
                        const widget = getWidget(type);
                        if (!widget) return null;
                        return (
                            <button key={type} onClick={() => addField(widget.type, widget.defaults)} className="sidebar-btn group">
                                <div className="icon-wrapper text-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary))]/10">{widget.icon}</div>
                                <span>{widget.label}</span>
                            </button>
                        );
                    })}

                    <h3 className="text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mt-6 mb-4">Advanced Widgets</h3>
                    {advancedTypes.map((type) => {
                        const widget = getWidget(type);
                        if (!widget) return null;
                        return (
                            <button key={type} onClick={() => addField(widget.type, widget.defaults)} className="sidebar-btn group">
                                <div className="icon-wrapper text-[hsl(var(--primary))] group-hover:bg-[hsl(var(--primary))]/10">{widget.icon}</div>
                                <span>{widget.label}</span>
                            </button>
                        );
                    })}
                </aside>

                {/* Main Canvas */}
                <main className="flex-1 bg-[hsl(var(--background))] p-12 overflow-y-auto">
                    <div className="max-w-2xl mx-auto space-y-6">
                        {fields.length === 0 ? (
                            <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-3xl p-20 text-center text-[hsl(var(--text-tertiary))]">
                                <p className="text-lg">Select a widget to start building</p>
                            </div>
                        ) : (
                            fields.map((field) => (
                                <div
                                    key={field.id}
                                    onClick={() => setSelectedFieldId(field.id)}
                                    className={`bg-[hsl(var(--surface))] border p-6 rounded-2xl group relative transition-all shadow-sm cursor-pointer ${
                                        selectedFieldId === field.id
                                            ? 'border-[hsl(var(--primary))] shadow-lg shadow-[hsl(var(--primary))]/10'
                                            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--border-hover))]'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center space-x-3 w-full">
                                            <div className="p-2 bg-[hsl(var(--surface-elevated))] rounded-lg text-[hsl(var(--text-tertiary))]">
                                                {getWidget(field.type)?.icon || <Smartphone className="w-4 h-4" />}
                                            </div>
                                            <input
                                                value={field.label}
                                                onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                                                className="bg-transparent border-none text-lg font-medium focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2 w-full"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeField(field.id)}
                                            className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] p-2 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="h-12 bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))] rounded-xl px-4 flex items-center text-[hsl(var(--text-tertiary))] text-sm italic">
                                        {field.type.replace('input_', '').replace('_', ' ')} placeholder...
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>

                {/* Right Panel: Properties */}
                <aside className="w-80 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-6">
                    <h3 className="text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-6 flex items-center">
                        <Settings className="w-4 h-4 mr-2" />
                        Properties
                    </h3>
                    {!selectedField && (
                        <p className="text-[hsl(var(--text-secondary))] text-sm">Select a field to edit its properties.</p>
                    )}

                    {selectedField && (
                        <div className="space-y-5">
                            <div>
                                <label className="label">Label</label>
                                <input
                                    value={selectedField.label}
                                    onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="label">Bind Key</label>
                                <input
                                    value={selectedField.id}
                                    onChange={(e) => updateFieldId(selectedField.id, e.target.value)}
                                    className="input"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="label !mb-0">Required</label>
                                <input
                                    type="checkbox"
                                    checked={selectedField.required}
                                    onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                    className="h-4 w-4"
                                />
                            </div>

                            {['input_text', 'input_number', 'email_input', 'phone_input', 'textarea'].includes(selectedField.type) && (
                                <div>
                                    <label className="label">Placeholder</label>
                                    <input
                                        value={selectedField.placeholder || ''}
                                        onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            )}

                            {['dropdown', 'radio_group', 'checkbox_group'].includes(selectedField.type) && (
                                <div>
                                    <label className="label">Options (comma separated)</label>
                                    <input
                                        value={(selectedField.options || []).join(', ')}
                                        onChange={(e) => updateField(selectedField.id, { options: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
                                        className="input"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="label">Platforms</label>
                                <div className="flex flex-wrap gap-2">
                                    {(['mobile', 'web', 'ussd'] as Platform[]).map((platform) => (
                                        <label key={platform} className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
                                            <input
                                                type="checkbox"
                                                checked={selectedField.platforms?.includes(platform) || false}
                                                onChange={(e) => {
                                                    const next = new Set(selectedField.platforms || []);
                                                    if (e.target.checked) next.add(platform);
                                                    else next.delete(platform);
                                                    updateField(selectedField.id, { platforms: Array.from(next) });
                                                }}
                                            />
                                            {platform}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            <style>{`
                .sidebar-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: hsl(var(--surface-elevated));
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid hsl(var(--border));
                    transition: all 0.2s;
                    text-align: left;
                }
                .sidebar-btn:hover {
                    background: hsl(var(--surface));
                    border-color: hsl(var(--border-hover));
                }
                .icon-wrapper {
                    width: 32px;
                    height: 32px;
                    background: hsl(var(--surface));
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
            `}</style>
        </div>
    );
};

export default FormBuilder;
