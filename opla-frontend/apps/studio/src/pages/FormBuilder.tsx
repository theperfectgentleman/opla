import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI } from '../lib/api';
import { useOrg } from '../contexts/OrgContext';
import ThemeToggle from '../components/ThemeToggle';
import {
    Save, Play, Trash2, Settings, Smartphone, Layout,
    MapPin, Camera, Type, Hash, CheckSquare, List, Mail,
    Phone, Calendar, Clock, FileText, ToggleLeft, Mic, PenTool, Barcode,
    ChevronDown, ChevronRight, ArrowLeft, Zap, GitBranch, Terminal
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

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
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}

interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
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
    target_id: string; // The section_id to jump to, or field_id to show/hide
    source_id?: string; // Optional: The field or section this rule is originally "attached" to for UI grouping
    conditions: LogicCondition[];
    logic_operator: 'AND' | 'OR';
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
    const { showToast } = useToast();
    const [formMeta, setFormMeta] = useState<{ id: string; project_id: string; slug: string; version: number; is_public: boolean } | null>(null);
    const [title, setTitle] = useState('Untitled Form');
    const [sections, setSections] = useState<FormSection[]>([{ id: 'screen_1', title: 'Section 1', fields: [] }]);
    const [currentSectionId, setCurrentSectionId] = useState<string>('screen_1');
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [logic, setLogic] = useState<LogicRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [openSection, setOpenSection] = useState<'basic' | 'advanced' | 'templates' | null>('basic');
    const [propertyTab, setPropertyTab] = useState<'content' | 'logic'>('content');

    const currentSectionIndex = sections.findIndex(p => p.id === currentSectionId) !== -1 ? sections.findIndex(p => p.id === currentSectionId) : 0;
    const fields = sections[currentSectionIndex]?.fields || [];
    const selectedField = sections.flatMap(p => p.fields).find(f => f.id === selectedFieldId) || null;

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
                if (blueprint?.ui?.length) {
                    const loadedSections: FormSection[] = blueprint.ui.map((screen: any, idx: number) => ({
                        id: screen.id || `screen_${idx + 1}`,
                        title: screen.title || `Section ${idx + 1}`,
                        fields: screen.children ? screen.children.map((child: any) => ({
                            id: child.bind,
                            type: child.type as FieldType,
                            label: child.label || 'Untitled Field',
                            required: !!child.required,
                            placeholder: child.placeholder,
                            options: child.options,
                            platforms: child.platforms
                        })) : []
                    }));
                    setSections(loadedSections);
                    setCurrentSectionId(loadedSections[0].id);
                    setLogic(blueprint.logic || []);
                } else {
                    setSections([{ id: 'screen_1', title: 'Section 1', fields: [] }]);
                    setCurrentSectionId('screen_1');
                    setLogic([]);
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
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, fields: [...p.fields, newField] } : p));
        setSelectedFieldId(newField.id);
    };

    const removeField = (id: string) => {
        setSections(prev => prev.map(p => ({ ...p, fields: p.fields.filter(f => f.id !== id) })));
        if (selectedFieldId === id) setSelectedFieldId(null);
    };

    const updateFieldLabel = (id: string, label: string) => {
        setSections(prev => prev.map(p => ({ ...p, fields: p.fields.map(f => f.id === id ? { ...f, label } : f) })));
    };

    const updateField = (id: string, patch: Partial<FormField>) => {
        setSections(prev => prev.map(p => ({ ...p, fields: p.fields.map(f => f.id === id ? { ...f, ...patch } : f) })));
    };

    const updateFieldId = (oldId: string, newId: string) => {
        setSections(prev => prev.map(p => ({ ...p, fields: p.fields.map(f => f.id === oldId ? { ...f, id: newId } : f) })));
        setSelectedFieldId(newId);
    };

    const addSection = () => {
        const newId = `screen_${Date.now()}`;
        setSections(prev => [...prev, { id: newId, title: `Section ${prev.length + 1}`, fields: [] }]);
        setCurrentSectionId(newId);
    };

    const removeCurrentSection = () => {
        if (sections.length <= 1) {
            showToast('Cannot delete', 'You must have at least one section', 'error');
            return;
        }
        const newSections = sections.filter(p => p.id !== currentSectionId);
        setSections(newSections);
        setCurrentSectionId(newSections[0].id);
    };

    const updateCurrentSectionTitle = (title: string) => {
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, title } : p));
    };

    const addLogicRule = (rule: Partial<LogicRule>) => {
        const newRule: LogicRule = {
            id: `rule_${Date.now()}`,
            type: 'field_visibility',
            action: 'show',
            target_id: '',
            conditions: [],
            logic_operator: 'AND',
            ...rule
        };
        setLogic(prev => [...prev, newRule]);
        return newRule;
    };

    const removeLogicRule = (id: string) => {
        setLogic(prev => prev.filter(r => r.id !== id));
    };

    const updateLogicRule = (id: string, patch: Partial<LogicRule>) => {
        setLogic(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
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
                schema: sections.flatMap(p => p.fields).map((f) => {
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
                ui: sections.map((p) => ({
                    id: p.id,
                    type: 'screen',
                    title: p.title,
                    children: p.fields.map(f => ({
                        type: f.type,
                        bind: f.id,
                        label: f.label,
                        required: f.required,
                        placeholder: f.placeholder,
                        options: f.options,
                        platforms: f.platforms,
                        min: f.min,
                        max: f.max,
                        minLength: f.minLength,
                        maxLength: f.maxLength,
                    }))
                })),
                logic: logic
            };
            await formAPI.updateBlueprint(formId, blueprint);
            showToast('Successfully saved!', 'Anyone with a link can now view this file.', 'success');
        } catch (err) {
            console.error('Save failed', err);
            showToast('Save failed', 'There was an error saving your form.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[hsl(var(--background))] text-[hsl(var(--text-primary))]">
            {/* Header */}
            <header className="h-16 border-b border-[hsl(var(--border))] flex items-center justify-between px-6 bg-[hsl(var(--surface))]/70 backdrop-blur-md">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-xl transition-all text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                        title="Back to Dashboard"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
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
                <aside className="w-72 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-full overflow-hidden">
                    <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-6">
                        {/* Basic Widgets */}
                        <div>
                            <button
                                onClick={() => setOpenSection(openSection === 'basic' ? null : 'basic')}
                                className="w-full flex items-center justify-between text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-2 hover:text-[hsl(var(--text-primary))] transition-colors"
                            >
                                <span>Basic Widgets</span>
                                {openSection === 'basic' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {openSection === 'basic' && (
                                <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
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
                                </div>
                            )}
                        </div>

                        {/* Advanced Widgets */}
                        <div>
                            <button
                                onClick={() => setOpenSection(openSection === 'advanced' ? null : 'advanced')}
                                className="w-full flex items-center justify-between text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-2 hover:text-[hsl(var(--text-primary))] transition-colors"
                            >
                                <span>Advanced Widgets</span>
                                {openSection === 'advanced' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {openSection === 'advanced' && (
                                <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
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
                                </div>
                            )}
                        </div>

                        {/* Templates */}
                        <div>
                            <button
                                onClick={() => setOpenSection(openSection === 'templates' ? null : 'templates')}
                                className="w-full flex items-center justify-between text-sm font-semibold text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-2 hover:text-[hsl(var(--text-primary))] transition-colors"
                            >
                                <span>Templates</span>
                                {openSection === 'templates' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {openSection === 'templates' && (
                                <div className="space-y-2 mt-4 animate-in slide-in-from-top-2 fade-in duration-200 text-center p-6 border-2 border-dashed border-[hsl(var(--border))] rounded-xl">
                                    <List className="w-8 h-8 text-[hsl(var(--border-hover))] mx-auto mb-2" />
                                    <p className="text-sm font-medium text-[hsl(var(--text-secondary))]">Pre-built Templates</p>
                                    <p className="text-xs text-[hsl(var(--text-tertiary))]">Coming soon...</p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Canvas */}
                <main className="flex-1 bg-[hsl(var(--background))] p-12 overflow-y-auto hide-scrollbar">
                    <div className="max-w-2xl mx-auto space-y-6">

                        {/* Section Tabs */}
                        <div className="flex items-center justify-between bg-[hsl(var(--surface))] p-2 rounded-2xl border border-[hsl(var(--border))]">
                            <div className="flex overflow-x-auto hide-scrollbar space-x-2 p-1">
                                {sections.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setCurrentSectionId(p.id)}
                                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${currentSectionId === p.id
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary))]/20'
                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))]'
                                            }`}
                                    >
                                        {p.title}
                                    </button>
                                ))}
                                <button
                                    onClick={addSection}
                                    className="px-3 py-2 rounded-xl text-sm font-medium text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--text-primary))] transition-all flex items-center"
                                >
                                    + Add Section
                                </button>
                            </div>
                            <div className="flex items-center space-x-2 px-2 border-l border-[hsl(var(--border))]">
                                <input
                                    value={sections.find(p => p.id === currentSectionId)?.title || ''}
                                    onChange={(e) => updateCurrentSectionTitle(e.target.value)}
                                    className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2 w-32"
                                    placeholder="Section Title"
                                />
                                <button
                                    onClick={removeCurrentSection}
                                    className="p-2 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                    title="Delete Section"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {fields.length === 0 ? (
                            <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-3xl p-20 text-center text-[hsl(var(--text-tertiary))]">
                                <p className="text-lg">Select a widget to start building</p>
                            </div>
                        ) : (
                            fields.map((field) => (
                                <div
                                    key={field.id}
                                    onClick={() => setSelectedFieldId(field.id)}
                                    className={`p-6 rounded-2xl group relative transition-all shadow-sm cursor-pointer border ${selectedFieldId === field.id
                                        ? 'border-[hsl(var(--primary))] border-2 bg-[hsl(var(--primary))]/5 shadow-lg shadow-[hsl(var(--primary))]/5'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--border-hover))]'
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeField(field.id);
                                            }}
                                            className={`text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] p-2 transition-all ${selectedFieldId === field.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                }`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="h-12 bg-white/50 dark:bg-black/20 border border-[hsl(var(--border))] rounded-xl px-4 flex items-center text-[hsl(var(--text-tertiary))] text-sm italic">
                                        {field.type.replace('input_', '').replace('_', ' ')} placeholder...
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </main>

                {/* Right Panel: Properties */}
                <aside className="w-80 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-[hsl(var(--border))]">
                        <div className="flex bg-[hsl(var(--surface-elevated))] p-1 rounded-xl">
                            <button
                                onClick={() => setPropertyTab('content')}
                                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${propertyTab === 'content'
                                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm'
                                    : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                    }`}
                            >
                                <Settings className="w-3 h-3" />
                                <span>Properties</span>
                            </button>
                            <button
                                onClick={() => setPropertyTab('logic')}
                                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${propertyTab === 'logic'
                                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm'
                                    : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                    }`}
                            >
                                <Zap className="w-3 h-3" />
                                <span>Logic</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
                        {propertyTab === 'content' ? (
                            <>
                                {!selectedField ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] mb-4 flex items-center">
                                                <Layout className="w-4 h-4 mr-2" />
                                                Section Settings
                                            </h3>
                                            <label className="label">Section Title</label>
                                            <input
                                                value={sections.find(p => p.id === currentSectionId)?.title || ''}
                                                onChange={(e) => updateCurrentSectionTitle(e.target.value)}
                                                className="input"
                                                placeholder="Section Title"
                                            />
                                        </div>
                                        <p className="text-[hsl(var(--text-tertiary))] text-xs italic">Select a field in the canvas to see its individual properties.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200">
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
                                            <div className="flex space-x-2">
                                                <div className="relative flex-1">
                                                    <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--text-tertiary))]" />
                                                    <input
                                                        value={selectedField.id}
                                                        onChange={(e) => updateFieldId(selectedField.id, e.target.value)}
                                                        className="input pl-8 font-mono text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))]">
                                            <label className="text-sm font-semibold !mb-0">Required Field</label>
                                            <input
                                                type="checkbox"
                                                checked={selectedField.required}
                                                onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                                className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
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
                                                <label className="label">Choices</label>
                                                <div className="space-y-2">
                                                    {(selectedField.options || []).map((opt, idx) => (
                                                        <div key={idx} className="flex items-center space-x-2">
                                                            <input
                                                                value={opt}
                                                                onChange={(e) => {
                                                                    const newOpts = [...(selectedField.options || [])];
                                                                    newOpts[idx] = e.target.value;
                                                                    updateField(selectedField.id, { options: newOpts });
                                                                }}
                                                                className="input text-sm py-1.5"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const newOpts = (selectedField.options || []).filter((_, i) => i !== idx);
                                                                    updateField(selectedField.id, { options: newOpts });
                                                                }}
                                                                className="p-1.5 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg transition-all"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => updateField(selectedField.id, { options: [...(selectedField.options || []), `Option ${(selectedField.options?.length || 0) + 1}`] })}
                                                        className="w-full py-2 border-2 border-dashed border-[hsl(var(--border))] rounded-xl text-xs font-semibold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                                    >
                                                        + Add Option
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {['input_text', 'email_input', 'phone_input', 'textarea'].includes(selectedField.type) && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="label">Min Length</label>
                                                    <input
                                                        type="number"
                                                        value={selectedField.minLength || ''}
                                                        onChange={(e) => updateField(selectedField.id, { minLength: parseInt(e.target.value) || undefined })}
                                                        className="input"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">Max Length</label>
                                                    <input
                                                        type="number"
                                                        value={selectedField.maxLength || ''}
                                                        onChange={(e) => updateField(selectedField.id, { maxLength: parseInt(e.target.value) || undefined })}
                                                        className="input"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {selectedField.type === 'input_number' && (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="label">Min Value</label>
                                                    <input
                                                        type="number"
                                                        value={selectedField.min || ''}
                                                        onChange={(e) => updateField(selectedField.id, { min: parseInt(e.target.value) || undefined })}
                                                        className="input"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="label">Max Value</label>
                                                    <input
                                                        type="number"
                                                        value={selectedField.max || ''}
                                                        onChange={(e) => updateField(selectedField.id, { max: parseInt(e.target.value) || undefined })}
                                                        className="input"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="label">Platforms</label>
                                            <div className="grid grid-cols-1 gap-2">
                                                {(['mobile', 'web', 'ussd'] as Platform[]).map((platform) => (
                                                    <label key={platform} className="flex items-center space-x-3 p-2 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))] cursor-pointer hover:border-[hsl(var(--border-hover))] transition-all">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedField.platforms?.includes(platform) || false}
                                                            onChange={(e) => {
                                                                const next = new Set(selectedField.platforms || []);
                                                                if (e.target.checked) next.add(platform);
                                                                else next.delete(platform);
                                                                updateField(selectedField.id, { platforms: Array.from(next) });
                                                            }}
                                                            className="h-4 w-4 text-[hsl(var(--primary))] rounded border-[hsl(var(--border))]"
                                                        />
                                                        <span className="text-sm font-medium capitalize">{platform}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
                                {selectedField ? (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold flex items-center">
                                                <Zap className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                                                Field Logic
                                            </h3>
                                        </div>
                                        <p className="text-[hsl(var(--text-secondary))] text-xs">Define rules for when this field should be visible.</p>

                                        <div className="space-y-4">
                                            {logic.filter(r => r.type === 'field_visibility' && r.target_id === selectedField.id).map(rule => (
                                                <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))] rounded-2xl border border-[hsl(var(--border))] space-y-4 relative group">
                                                    <button
                                                        onClick={() => removeLogicRule(rule.id)}
                                                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>

                                                    <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                        <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">IF</span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {rule.conditions.map((cond, cIdx) => (
                                                            <div key={cIdx} className="space-y-2">
                                                                <select
                                                                    value={cond.field}
                                                                    onChange={(e) => {
                                                                        const newConds = [...rule.conditions];
                                                                        newConds[cIdx].field = e.target.value;
                                                                        updateLogicRule(rule.id, { conditions: newConds });
                                                                    }}
                                                                    className="input-sm w-full py-1.5"
                                                                >
                                                                    <option value="">Select Field...</option>
                                                                    {sections.flatMap(p => p.fields).filter(f => f.id !== selectedField.id).map(f => (
                                                                        <option key={f.id} value={f.id}>{f.label}</option>
                                                                    ))}
                                                                </select>

                                                                <div className="flex space-x-2">
                                                                    <select
                                                                        value={cond.operator}
                                                                        onChange={(e) => {
                                                                            const newConds = [...rule.conditions];
                                                                            newConds[cIdx].operator = e.target.value as any;
                                                                            updateLogicRule(rule.id, { conditions: newConds });
                                                                        }}
                                                                        className="input-sm w-1/2 py-1.5"
                                                                    >
                                                                        <option value="eq">Equals</option>
                                                                        <option value="neq">Not Equal</option>
                                                                        <option value="contains">Contains</option>
                                                                        <option value="gt">Greater Than</option>
                                                                        <option value="lt">Less Than</option>
                                                                    </select>
                                                                    <input
                                                                        value={cond.value}
                                                                        onChange={(e) => {
                                                                            const newConds = [...rule.conditions];
                                                                            newConds[cIdx].value = e.target.value;
                                                                            updateLogicRule(rule.id, { conditions: newConds });
                                                                        }}
                                                                        placeholder="Value"
                                                                        className="input-sm w-1/2 py-1.5"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                        <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">THEN</span>
                                                        <span>SHOW FIELD</span>
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                onClick={() => addLogicRule({
                                                    type: 'field_visibility',
                                                    target_id: selectedField.id,
                                                    action: 'show',
                                                    conditions: [{ field: '', operator: 'eq', value: '' }]
                                                })}
                                                className="w-full py-3 border-2 border-dashed border-[hsl(var(--border))] rounded-2xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                            >
                                                + Add Visibility Rule
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold flex items-center">
                                                <GitBranch className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                                                Section Logic (Skip Rule)
                                            </h3>
                                        </div>
                                        <p className="text-[hsl(var(--text-secondary))] text-xs">Determine what section happens after this one.</p>

                                        <div className="space-y-4">
                                            {logic.filter(r => r.type === 'section_jump' && r.source_id === currentSectionId).map(rule => (
                                                <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))] rounded-2xl border border-[hsl(var(--border))] space-y-4 relative group">
                                                    <button
                                                        onClick={() => removeLogicRule(rule.id)}
                                                        className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>

                                                    <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                        <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">IF</span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {rule.conditions.map((cond, cIdx) => (
                                                            <div key={cIdx} className="space-y-2">
                                                                <select
                                                                    value={cond.field}
                                                                    onChange={(e) => {
                                                                        const newConds = [...rule.conditions];
                                                                        newConds[cIdx].field = e.target.value;
                                                                        updateLogicRule(rule.id, { conditions: newConds });
                                                                    }}
                                                                    className="input-sm w-full py-1.5"
                                                                >
                                                                    <option value="">Select Field...</option>
                                                                    {sections.find(p => p.id === currentSectionId)?.fields.map(f => (
                                                                        <option key={f.id} value={f.id}>{f.label}</option>
                                                                    ))}
                                                                </select>

                                                                <div className="flex space-x-2">
                                                                    <select
                                                                        value={cond.operator}
                                                                        onChange={(e) => {
                                                                            const newConds = [...rule.conditions];
                                                                            newConds[cIdx].operator = e.target.value as any;
                                                                            updateLogicRule(rule.id, { conditions: newConds });
                                                                        }}
                                                                        className="input-sm w-1/2 py-1.5"
                                                                    >
                                                                        <option value="eq">Equals</option>
                                                                        <option value="neq">Not Equal</option>
                                                                        <option value="contains">Contains</option>
                                                                        <option value="gt">Greater Than</option>
                                                                        <option value="lt">Less Than</option>
                                                                    </select>
                                                                    <input
                                                                        value={cond.value}
                                                                        onChange={(e) => {
                                                                            const newConds = [...rule.conditions];
                                                                            newConds[cIdx].value = e.target.value;
                                                                            updateLogicRule(rule.id, { conditions: newConds });
                                                                        }}
                                                                        placeholder="Value"
                                                                        className="input-sm w-1/2 py-1.5"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))]">
                                                        <span className="bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">GOTO</span>
                                                        <select
                                                            value={rule.target_id}
                                                            onChange={(e) => updateLogicRule(rule.id, { target_id: e.target.value })}
                                                            className="bg-transparent border-none text-[hsl(var(--primary))] font-bold p-0 focus:ring-0 cursor-pointer"
                                                        >
                                                            <option value="">Next Section (Default)</option>
                                                            {sections.filter(p => p.id !== currentSectionId).map(p => (
                                                                <option key={p.id} value={p.id}>{p.title}</option>
                                                            ))}
                                                            <option value="end">End Survey</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}

                                            <button
                                                onClick={() => addLogicRule({
                                                    type: 'section_jump',
                                                    source_id: currentSectionId,
                                                    action: 'jump_to',
                                                    target_id: '',
                                                    conditions: [{ field: '', operator: 'eq', value: '' }]
                                                })}
                                                className="w-full py-3 border-2 border-dashed border-[hsl(var(--border))] rounded-2xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                            >
                                                + Add Skip Rule
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
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
                .input-sm {
                    background: hsl(var(--surface));
                    border: 1px solid hsl(var(--border));
                    border-radius: 10px;
                    padding: 8px 12px;
                    font-size: 13px;
                    color: hsl(var(--text-primary));
                    width: 100%;
                    transition: all 0.2s;
                }
                .input-sm:focus {
                    outline: none;
                    border-color: hsl(var(--primary));
                    background: hsl(var(--surface-elevated));
                }
            `}</style>
        </div>
    );
};

export default FormBuilder;
