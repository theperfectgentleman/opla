import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI } from '../lib/api';
import { useOrg } from '../contexts/OrgContext';
import ThemeToggle from '../components/ThemeToggle';
import {
    Save, Play, Trash2, Settings, Smartphone, Layout,
    MapPin, Camera, Type, Hash, CheckSquare, List, Mail,
    Phone, Calendar, Clock, FileText, ToggleLeft, Mic, PenTool, Barcode,
    ChevronDown, ChevronRight, ArrowLeft, Zap, GitBranch, Terminal,
    Layers, ChevronRight as Crumb, Copy, MoveRight
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

type Platform = 'mobile' | 'web' | 'ussd';
type RenderMode = 'single' | 'list';

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

interface FieldOption {
    label: string;        // Display text shown to respondent
    value: string;        // Machine-readable key stored in data
    skip_to?: string;     // Optional: section id to jump to when this option is picked
}

interface FormField {
    id: string;
    type: FieldType;
    label: string;
    required: boolean;
    placeholder?: string;
    options?: FieldOption[];         // Replaces old string[]
    platforms?: Platform[];
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    default_value?: string;          // Pre-filled value; overridable during administration
    is_sensitive?: boolean;          // Marks field as PII / sensitive data
    exclude_from_export?: boolean;   // Omit field from data exports / views
}

interface SectionProperties {
    render_mode: RenderMode;       // 'single' = one field at a time | 'list' = all fields at once
    description?: string;          // Optional intro text shown at top of section
    platforms?: Platform[];        // Which platforms render this section
    is_repeatable?: boolean;       // Whether this section can be filled multiple times
    max_repeats?: number;          // Cap on repeat count (only when is_repeatable)
    shuffle_options?: boolean;     // Randomise option order within choice fields in this section
}

interface FormSection {
    id: string;
    title: string;
    fields: FormField[];
    properties: SectionProperties;
}

/** Strips stop words and builds a ≤5-word snake_case key from a label. */
const toSmartValue = (label: string): string => {
    const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'it', 'i', 'we', 'you', 'they', 'this', 'that', 'these', 'those', 'be', 'was', 'are', 'were']);
    const words = label
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 0 && !STOP.has(w))
        .slice(0, 5);
    return words.length > 0 ? words.join('_') : label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 30);
};

interface LogicCondition {
    field: string;
    operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
    value: any;
}

interface LogicRule {
    id: string;
    type: 'section_jump' | 'field_visibility' | 'section_visibility' | 'section_skip';
    timing: 'pre' | 'post';        // pre = before load/enter | post = after completion
    action: 'jump_to' | 'show' | 'hide' | 'skip';
    target_id: string;             // section_id to jump to, or field_id to show/hide
    source_id?: string;            // Field or section this rule is attached to for UI grouping
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
    { type: 'dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
    { type: 'radio_group', label: 'Radio Group', icon: <CheckSquare className="w-4 h-4" /> },
    { type: 'checkbox_group', label: 'Checkbox Group', icon: <CheckSquare className="w-4 h-4" /> },
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
    const defaultSectionProperties = (): SectionProperties => ({ render_mode: 'list', platforms: ['mobile', 'web'] });
    const [sections, setSections] = useState<FormSection[]>([{ id: 'screen_1', title: 'Section 1', fields: [], properties: defaultSectionProperties() }]);
    const [currentSectionId, setCurrentSectionId] = useState<string>('screen_1');
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [logic, setLogic] = useState<LogicRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [openSection, setOpenSection] = useState<'basic' | 'advanced' | 'templates' | null>('basic');
    const [propertyTab, setPropertyTab] = useState<'content' | 'logic'>('content');
    const [view, setView] = useState<'form' | 'section'>('form');
    const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
    const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
    const dragFieldIdRef = React.useRef<string | null>(null);
    const [moveMenuFieldId, setMoveMenuFieldId] = useState<string | null>(null);

    const enterSection = (sectionId: string) => {
        setSlideDir('forward');
        setCurrentSectionId(sectionId);
        setSelectedFieldId(null);
        setView('section');
    };
    const exitSection = () => {
        setSlideDir('back');
        setSelectedFieldId(null);
        setView('form');
    };

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
                    const normaliseOptions = (raw: any[]): FieldOption[] =>
                        raw.map(o => typeof o === 'string'
                            ? { label: o, value: toSmartValue(o) }
                            : { label: o.label ?? o, value: o.value ?? toSmartValue(o.label ?? o), skip_to: o.skip_to }
                        );

                    const loadedSections: FormSection[] = blueprint.ui.map((screen: any, idx: number) => ({
                        id: screen.id || `screen_${idx + 1}`,
                        title: screen.title || `Section ${idx + 1}`,
                        properties: {
                            render_mode: screen.render_mode || 'list',
                            description: screen.description,
                            platforms: screen.platforms || ['mobile', 'web'],
                            is_repeatable: !!screen.is_repeatable,
                            max_repeats: screen.max_repeats,
                            shuffle_options: !!screen.shuffle_options,
                        },
                        fields: screen.children ? screen.children.map((child: any) => ({
                            id: child.bind,
                            type: child.type as FieldType,
                            label: child.label || 'Untitled Field',
                            required: !!child.required,
                            placeholder: child.placeholder,
                            options: Array.isArray(child.options) ? normaliseOptions(child.options) : undefined,
                            platforms: child.platforms,
                            default_value: child.default_value,
                            is_sensitive: !!child.is_sensitive,
                            exclude_from_export: !!child.exclude_from_export,
                        })) : []
                    }));
                    setSections(loadedSections);
                    setCurrentSectionId(loadedSections[0].id);
                    setLogic(blueprint.logic || []);
                } else {
                    setSections([{ id: 'screen_1', title: 'Section 1', fields: [], properties: { render_mode: 'list', platforms: ['mobile', 'web'] } }]);
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
        const isChoice = ['dropdown', 'radio_group', 'checkbox_group'].includes(type);
        const defaultOpts: FieldOption[] = isChoice
            ? [{ label: 'Option A', value: 'option_a' }, { label: 'Option B', value: 'option_b' }]
            : [];
        const newField: FormField = {
            id: `field_${Date.now()}`,
            type,
            label: `New ${type.replace(/_/g, ' ')}`,
            required: false,
            placeholder: 'Enter value...',
            platforms: ['mobile', 'web'],
            options: isChoice ? defaultOpts : undefined,
            ...defaults
        };
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, fields: [...p.fields, newField] } : p));
        setSelectedFieldId(newField.id);
    };

    const copyField = (fieldId: string) => {
        setSections(prev => prev.map(section => {
            const idx = section.fields.findIndex(f => f.id === fieldId);
            if (idx === -1) return section;
            const original = section.fields[idx];
            const copy: FormField = { ...original, id: `field_${Date.now()}` };
            const next = [...section.fields];
            next.splice(idx + 1, 0, copy);
            return { ...section, fields: next };
        }));
    };

    const moveField = (fieldId: string, targetSectionId: string) => {
        let fieldToMove: FormField | null = null;
        setSections(prev => {
            const next = prev.map(section => {
                const idx = section.fields.findIndex(f => f.id === fieldId);
                if (idx === -1) return section;
                fieldToMove = section.fields[idx];
                return { ...section, fields: section.fields.filter(f => f.id !== fieldId) };
            });
            if (fieldToMove) {
                return next.map(section =>
                    section.id === targetSectionId
                        ? { ...section, fields: [...section.fields, fieldToMove!] }
                        : section
                );
            }
            return next;
        });
        setSelectedFieldId(null);
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
        setSections(prev => [...prev, { id: newId, title: `Section ${prev.length + 1}`, fields: [], properties: defaultSectionProperties() }]);
        setCurrentSectionId(newId);
    };

    const updateCurrentSectionProperties = (patch: Partial<SectionProperties>) => {
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, properties: { ...p.properties, ...patch } } : p));
    };


    const updateCurrentSectionTitle = (title: string) => {
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, title } : p));
    };

    const addLogicRule = (rule: Partial<LogicRule>) => {
        const newRule: LogicRule = {
            id: `rule_${Date.now()}`,
            type: 'field_visibility',
            timing: 'pre',
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
                    render_mode: p.properties.render_mode,
                    description: p.properties.description,
                    platforms: p.properties.platforms,
                    is_repeatable: p.properties.is_repeatable,
                    max_repeats: p.properties.max_repeats,
                    shuffle_options: p.properties.shuffle_options,
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
                        default_value: f.default_value,
                        is_sensitive: f.is_sensitive,
                        exclude_from_export: f.exclude_from_export,
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
            <header className="h-16 border-b border-[hsl(var(--border))] flex items-center justify-between px-6 bg-[hsl(var(--surface))]/70 backdrop-blur-md shrink-0">
                <div className="flex items-center space-x-3">
                    {view === 'section' ? (
                        /* Section View: breadcrumb */
                        <>
                            <button
                                onClick={exitSection}
                                className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-xl transition-all text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                                title="Back to Form"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={exitSection}
                                    className="text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] font-semibold text-sm transition-colors"
                                >
                                    {title}
                                </button>
                                <Crumb className="w-4 h-4 text-[hsl(var(--text-tertiary))]" />
                                <span className="text-[hsl(var(--text-primary))] font-bold text-sm">
                                    {sections.find(s => s.id === currentSectionId)?.title || 'Section'}
                                </span>
                            </div>
                        </>
                    ) : (
                        /* Form View: title + back to dashboard */
                        <>
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
                        </>
                    )}
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
                {/* Left Panel: Widget Library — only in Section View */}
                {view === 'section' && (
                    <aside className="w-72 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-full overflow-hidden animate-in slide-in-from-left-4 fade-in duration-300">
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
                )}

                {/* Main Canvas — switches between Form View and Section View */}
                <main className="flex-1 bg-[hsl(var(--background))] overflow-y-auto hide-scrollbar">
                    {view === 'form' ? (
                        /* ═══════════════════════════════════════════════
                           FORM VIEW  — manage & organise sections
                        ═══════════════════════════════════════════════ */
                        <div
                            key="form-view"
                            className={`p-12 min-h-full animate-in fade-in ${slideDir === 'back' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                                } duration-300`}
                        >
                            <div className="max-w-4xl mx-auto">
                                <div className="mb-8">
                                    <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Form Sections</h2>
                                    <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">Click a section to edit its fields. Drag to reorder.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {sections.map((section, idx) => (
                                        <div
                                            key={section.id}
                                            onClick={() => enterSection(section.id)}
                                            className="group relative bg-[hsl(var(--surface))] border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/60 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-lg hover:shadow-[hsl(var(--primary))]/5 hover:-translate-y-0.5"
                                        >
                                            {/* Section number badge */}
                                            <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] text-xs font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </div>

                                            <div className="flex items-start space-x-4 mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--primary))]/20 transition-colors">
                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-[hsl(var(--text-primary))] truncate">{section.title}</h3>
                                                    {section.properties.description && (
                                                        <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5 line-clamp-2">{section.properties.description}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Meta row */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${section.properties.render_mode === 'single'
                                                    ? 'bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]'
                                                    : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'
                                                    }`}>
                                                    {section.properties.render_mode === 'single' ? 'Single' : 'List'}
                                                </span>
                                                <span className="text-xs text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 rounded-md">
                                                    {section.fields.length} {section.fields.length === 1 ? 'field' : 'fields'}
                                                </span>
                                                {section.properties.is_repeatable && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                                        Repeatable
                                                    </span>
                                                )}
                                                {(section.properties.platforms || []).map(p => (
                                                    <span key={p} className="text-[10px] capitalize text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded">{p}</span>
                                                ))}
                                            </div>

                                            {/* Delete button — only visible on hover */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (sections.length <= 1) { showToast('Cannot delete', 'You must have at least one section', 'error'); return; }
                                                    const next = sections.filter(s => s.id !== section.id);
                                                    setSections(next);
                                                    if (currentSectionId === section.id) setCurrentSectionId(next[0].id);
                                                }}
                                                className="absolute bottom-4 right-4 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                title="Delete section"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>

                                            {/* Enter arrow */}
                                            <div className="absolute bottom-4 right-10 opacity-0 group-hover:opacity-100 transition-all text-[hsl(var(--primary))]">
                                                <Crumb className="w-4 h-4" />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Add section card */}
                                    <button
                                        onClick={addSection}
                                        className="border-2 border-dashed border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]/40 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] transition-all hover:-translate-y-0.5 min-h-[140px]"
                                    >
                                        <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
                                            <span className="text-xl font-light">+</span>
                                        </div>
                                        <span className="text-sm font-semibold">Add Section</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ═══════════════════════════════════════════════
                           SECTION VIEW  — edit fields inside one section
                        ═══════════════════════════════════════════════ */
                        <div
                            key={`section-view-${currentSectionId}`}
                            className={`p-12 min-h-full animate-in fade-in ${slideDir === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                                } duration-300`}
                        >
                            <div className="max-w-2xl mx-auto space-y-6">
                                {fields.length === 0 ? (
                                    <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-3xl p-20 text-center text-[hsl(var(--text-tertiary))]">
                                        <p className="text-lg font-medium">Select a widget to add a field</p>
                                        <p className="text-sm mt-2">Use the widget library on the left to get started.</p>
                                    </div>
                                ) : (
                                    fields.map((field) => (
                                        <div
                                            key={field.id}
                                            draggable
                                            onDragStart={() => { dragFieldIdRef.current = field.id; }}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverFieldId(field.id); }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const dragId = dragFieldIdRef.current;
                                                if (!dragId || dragId === field.id) { setDragOverFieldId(null); return; }
                                                setSections(prev => prev.map(section => {
                                                    if (section.id !== currentSectionId) return section;
                                                    const fields = [...section.fields];
                                                    const fromIdx = fields.findIndex(f => f.id === dragId);
                                                    const toIdx = fields.findIndex(f => f.id === field.id);
                                                    if (fromIdx === -1 || toIdx === -1) return section;
                                                    const [moved] = fields.splice(fromIdx, 1);
                                                    fields.splice(toIdx, 0, moved);
                                                    return { ...section, fields };
                                                }));
                                                dragFieldIdRef.current = null;
                                                setDragOverFieldId(null);
                                            }}
                                            onClick={() => setSelectedFieldId(field.id)}
                                            className={`p-6 rounded-2xl group relative transition-all shadow-sm cursor-pointer border ${selectedFieldId === field.id
                                                ? 'border-[hsl(var(--primary))] border-2 bg-[hsl(var(--primary))]/5 shadow-lg shadow-[hsl(var(--primary))]/5'
                                                : dragOverFieldId === field.id
                                                    ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/3 border-dashed'
                                                    : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] hover:border-[hsl(var(--border-hover))]'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex items-center space-x-3 w-full">
                                                    {/* Drag handle */}
                                                    <span className="text-[hsl(var(--text-tertiary))] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all select-none">⠿</span>
                                                    <div className="p-2 bg-[hsl(var(--surface-elevated))] rounded-lg text-[hsl(var(--text-tertiary))]">
                                                        {getWidget(field.type)?.icon || <Smartphone className="w-4 h-4" />}
                                                    </div>
                                                    <input
                                                        value={field.label}
                                                        onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                                                        className="bg-transparent border-none text-lg font-medium focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2 w-full"
                                                    />
                                                </div>
                                                {/* Action buttons */}
                                                <div className={`flex items-center gap-1 transition-all ${selectedFieldId === field.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    {/* Copy */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); copyField(field.id); }}
                                                        title="Duplicate field"
                                                        className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] p-2 transition-all"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    {/* Move to section */}
                                                    {sections.length > 1 && (
                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setMoveMenuFieldId(moveMenuFieldId === field.id ? null : field.id); }}
                                                                title="Move to section"
                                                                className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] p-2 transition-all"
                                                            >
                                                                <MoveRight className="w-4 h-4" />
                                                            </button>
                                                            {moveMenuFieldId === field.id && (
                                                                <div className="absolute right-0 top-8 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl shadow-lg z-50 min-w-40 py-1">
                                                                    {sections.filter(s => s.id !== currentSectionId).map(s => (
                                                                        <button
                                                                            key={s.id}
                                                                            onClick={(e) => { e.stopPropagation(); moveField(field.id, s.id); setMoveMenuFieldId(null); }}
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                                                        >
                                                                            → {s.title}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* Delete */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                                                        className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] p-2 transition-all"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Field preview */}
                                            <div className="h-12 bg-white/50 dark:bg-black/20 border border-[hsl(var(--border))] rounded-xl px-4 flex items-center text-[hsl(var(--text-tertiary))] text-sm italic">
                                                {field.type.replace(/input_|_/g, ' ').trim()} preview
                                                {field.default_value && <span className="ml-2 text-[10px] font-mono bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded text-[hsl(var(--primary))]">{field.default_value}</span>}
                                                {field.is_sensitive && <span className="ml-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-1.5 py-0.5 rounded">🔒 sensitive</span>}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </main>

                {/* Right Panel — Form settings in Form View, field/section properties in Section View */}
                <aside className="w-80 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col h-full overflow-hidden">
                    {view === 'form' ? (
                        /* Form View right panel: form-level settings */
                        <div className="flex-1 overflow-y-auto p-6 hide-scrollbar animate-in fade-in duration-200">
                            <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] mb-5 flex items-center">
                                <Settings className="w-4 h-4 mr-2" />
                                Form Settings
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="label">Form Title</label>
                                    <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" />
                                </div>
                                <div>
                                    <label className="label">Sections</label>
                                    <p className="text-2xl font-bold text-[hsl(var(--primary))]">{sections.length}</p>
                                </div>
                                <div>
                                    <label className="label">Total Fields</label>
                                    <p className="text-2xl font-bold text-[hsl(var(--primary))]">{sections.reduce((acc, s) => acc + s.fields.length, 0)}</p>
                                </div>
                                <div className="pt-2 border-t border-[hsl(var(--border))]">
                                    <p className="text-xs text-[hsl(var(--text-tertiary))] italic">Click a section card to enter it and edit its fields and properties.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Section View right panel: field + section properties/logic */
                        <>
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
                                            <div className="space-y-5 animate-in fade-in duration-200">
                                                {/* Section Title */}
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

                                                {/* Description */}
                                                <div>
                                                    <label className="label">Section Description</label>
                                                    <textarea
                                                        value={sections.find(p => p.id === currentSectionId)?.properties.description || ''}
                                                        onChange={(e) => updateCurrentSectionProperties({ description: e.target.value })}
                                                        className="input resize-none"
                                                        rows={3}
                                                        placeholder="Optional intro text shown above this section's fields..."
                                                    />
                                                </div>

                                                {/* Render Mode */}
                                                <div>
                                                    <label className="label mb-2">Render Mode</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {(['list', 'single'] as RenderMode[]).map((mode) => {
                                                            const currentProps = sections.find(p => p.id === currentSectionId)?.properties;
                                                            const isActive = currentProps?.render_mode === mode;
                                                            return (
                                                                <button
                                                                    key={mode}
                                                                    onClick={() => updateCurrentSectionProperties({ render_mode: mode })}
                                                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-xs font-semibold ${isActive
                                                                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--border-hover))]'
                                                                        }`}
                                                                >
                                                                    {mode === 'list' ? (
                                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                                                        </svg>
                                                                    ) : (
                                                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                                                                        </svg>
                                                                    )}
                                                                    <span>{mode === 'list' ? 'List' : 'Single'}</span>
                                                                    <span className="text-[10px] font-normal opacity-70 text-center leading-tight">
                                                                        {mode === 'list' ? 'All fields shown at once' : 'One field at a time'}
                                                                    </span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Section Platforms */}
                                                <div>
                                                    <label className="label">Section Platforms</label>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {(['mobile', 'web', 'ussd'] as Platform[]).map((platform) => {
                                                            const currentProps = sections.find(p => p.id === currentSectionId)?.properties;
                                                            return (
                                                                <label key={platform} className="flex items-center space-x-3 p-2 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))] cursor-pointer hover:border-[hsl(var(--border-hover))] transition-all">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={currentProps?.platforms?.includes(platform) ?? true}
                                                                        onChange={(e) => {
                                                                            const next = new Set(currentProps?.platforms || []);
                                                                            if (e.target.checked) next.add(platform);
                                                                            else next.delete(platform);
                                                                            updateCurrentSectionProperties({ platforms: Array.from(next) });
                                                                        }}
                                                                        className="h-4 w-4 text-[hsl(var(--primary))] rounded border-[hsl(var(--border))]"
                                                                    />
                                                                    <span className="text-sm font-medium capitalize">{platform}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                {/* Shuffle Options */}
                                                <div className="flex items-center justify-between p-3 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))]">
                                                    <div>
                                                        <p className="text-sm font-semibold">Shuffle Options</p>
                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Randomise choice order at runtime</p>
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!sections.find(p => p.id === currentSectionId)?.properties.shuffle_options}
                                                        onChange={(e) => updateCurrentSectionProperties({ shuffle_options: e.target.checked })}
                                                        className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                    />
                                                </div>

                                                {/* Repeatable */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))]">
                                                        <div>
                                                            <p className="text-sm font-semibold">Repeatable Section</p>
                                                            <p className="text-xs text-[hsl(var(--text-tertiary))] mt-0.5">Allow filling this section multiple times</p>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={sections.find(p => p.id === currentSectionId)?.properties.is_repeatable || false}
                                                            onChange={(e) => updateCurrentSectionProperties({ is_repeatable: e.target.checked })}
                                                            className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                        />
                                                    </div>
                                                    {sections.find(p => p.id === currentSectionId)?.properties.is_repeatable && (
                                                        <div className="animate-in slide-in-from-top-1 fade-in duration-200">
                                                            <label className="label">Max Repeats</label>
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                value={sections.find(p => p.id === currentSectionId)?.properties.max_repeats || ''}
                                                                onChange={(e) => updateCurrentSectionProperties({ max_repeats: parseInt(e.target.value) || undefined })}
                                                                className="input"
                                                                placeholder="No limit"
                                                            />
                                                        </div>
                                                    )}
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
                                                                <div key={idx} className="p-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[hsl(var(--text-tertiary))] cursor-grab select-none text-xs">⠿</span>
                                                                        <input
                                                                            value={opt.label}
                                                                            placeholder="Label"
                                                                            onChange={(e) => {
                                                                                const label = e.target.value;
                                                                                const newOpts = [...(selectedField.options || [])];
                                                                                newOpts[idx] = { ...newOpts[idx], label, value: newOpts[idx].value || toSmartValue(label) };
                                                                                updateField(selectedField.id, { options: newOpts });
                                                                            }}
                                                                            className="input text-sm py-1.5 flex-1"
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newOpts = (selectedField.options || []).filter((_, i) => i !== idx);
                                                                                updateField(selectedField.id, { options: newOpts });
                                                                            }}
                                                                            className="p-1.5 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg transition-all shrink-0"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <div className="relative flex-1">
                                                                            <Terminal className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--text-tertiary))]" />
                                                                            <input
                                                                                value={opt.value}
                                                                                placeholder="value_key"
                                                                                onChange={(e) => {
                                                                                    const newOpts = [...(selectedField.options || [])];
                                                                                    newOpts[idx] = { ...newOpts[idx], value: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') };
                                                                                    updateField(selectedField.id, { options: newOpts });
                                                                                }}
                                                                                className="input text-xs py-1 pl-7 font-mono"
                                                                            />
                                                                        </div>
                                                                        <select
                                                                            value={opt.skip_to || ''}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...(selectedField.options || [])];
                                                                                newOpts[idx] = { ...newOpts[idx], skip_to: e.target.value || undefined };
                                                                                updateField(selectedField.id, { options: newOpts });
                                                                            }}
                                                                            className="input text-xs py-1 flex-1"
                                                                        >
                                                                            <option value="">Skip to...</option>
                                                                            {sections.map(s => (
                                                                                <option key={s.id} value={s.id}>{s.title}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button
                                                                onClick={() => {
                                                                    const n = (selectedField.options?.length || 0) + 1;
                                                                    const label = `Option ${n}`;
                                                                    updateField(selectedField.id, { options: [...(selectedField.options || []), { label, value: toSmartValue(label) }] });
                                                                }}
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

                                                {/* Default Value */}
                                                <div>
                                                    <label className="label">Default Value</label>
                                                    <p className="text-[10px] text-[hsl(var(--text-tertiary))] mb-1.5">Pre-filled automatically; overridable during administration.</p>
                                                    <input
                                                        value={selectedField.default_value || ''}
                                                        onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                        className="input"
                                                        placeholder="e.g. Yes, 0, Ghana..."
                                                    />
                                                </div>

                                                {/* Flags */}
                                                <div className="space-y-2">
                                                    <label className="label">Field Flags</label>
                                                    {[
                                                        { key: 'is_sensitive', label: 'Sensitive', desc: 'Contains PII or health data' },
                                                        { key: 'exclude_from_export', label: 'Exclude from Export', desc: 'Hide from data views & CSV exports' },
                                                    ].map(({ key, label, desc }) => (
                                                        <label key={key} className="flex items-center justify-between p-3 bg-[hsl(var(--surface-elevated))] rounded-xl border border-[hsl(var(--border))] cursor-pointer hover:border-[hsl(var(--border-hover))] transition-all">
                                                            <div>
                                                                <p className="text-sm font-semibold">{label}</p>
                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))]">{desc}</p>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!(selectedField as any)[key]}
                                                                onChange={(e) => updateField(selectedField.id, { [key]: e.target.checked } as any)}
                                                                className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                            />
                                                        </label>
                                                    ))}
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

                                                            {/* Timing badge */}
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">IF</span>
                                                                <div className="flex items-center bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg p-0.5 gap-0.5">
                                                                    {(['pre', 'post'] as const).map(t => (
                                                                        <button
                                                                            key={t}
                                                                            onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                                                : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                }`}
                                                                        >
                                                                            {t}
                                                                        </button>
                                                                    ))}
                                                                </div>
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
                                                            timing: 'pre',
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
                                                        Section Logic
                                                    </h3>
                                                </div>
                                                <p className="text-[hsl(var(--text-secondary))] text-xs">Control this section's visibility and navigation.</p>

                                                {/* Section Visibility Rules */}
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Visibility</p>
                                                    {logic.filter(r => r.type === 'section_visibility' && r.source_id === currentSectionId).map(rule => (
                                                        <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))] rounded-2xl border border-[hsl(var(--border))] space-y-4 relative group">
                                                            <button
                                                                onClick={() => removeLogicRule(rule.id)}
                                                                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Timing badge */}
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">IF</span>
                                                                <div className="flex items-center bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg p-0.5 gap-0.5">
                                                                    {(['pre', 'post'] as const).map(t => (
                                                                        <button
                                                                            key={t}
                                                                            onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                                                : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                }`}
                                                                        >
                                                                            {t}
                                                                        </button>
                                                                    ))}
                                                                </div>
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
                                                                            {sections.flatMap(p => p.fields).map(f => (
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
                                                                <select
                                                                    value={rule.action}
                                                                    onChange={(e) => updateLogicRule(rule.id, { action: e.target.value as any })}
                                                                    className="bg-transparent border-none text-[hsl(var(--primary))] font-bold p-0 focus:ring-0 cursor-pointer"
                                                                >
                                                                    <option value="show">Show Section</option>
                                                                    <option value="hide">Hide Section</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => addLogicRule({
                                                            type: 'section_visibility',
                                                            timing: 'pre',
                                                            source_id: currentSectionId,
                                                            target_id: currentSectionId,
                                                            action: 'show',
                                                            conditions: [{ field: '', operator: 'eq', value: '' }]
                                                        })}
                                                        className="w-full py-2.5 border-2 border-dashed border-[hsl(var(--border))] rounded-2xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                                    >
                                                        + Add Visibility Rule
                                                    </button>
                                                </div>

                                                {/* Section Skip / Jump Rules */}
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Navigation</p>
                                                    {logic.filter(r => r.type === 'section_jump' && r.source_id === currentSectionId).map(rule => (
                                                        <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))] rounded-2xl border border-[hsl(var(--border))] space-y-4 relative group">
                                                            <button
                                                                onClick={() => removeLogicRule(rule.id)}
                                                                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Timing badge */}
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded">IF</span>
                                                                <div className="flex items-center bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-lg p-0.5 gap-0.5">
                                                                    {(['pre', 'post'] as const).map(t => (
                                                                        <button
                                                                            key={t}
                                                                            onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                                                : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                }`}
                                                                        >
                                                                            {t}
                                                                        </button>
                                                                    ))}
                                                                </div>
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
                                                            timing: 'post',
                                                            source_id: currentSectionId,
                                                            action: 'jump_to',
                                                            target_id: '',
                                                            conditions: [{ field: '', operator: 'eq', value: '' }]
                                                        })}
                                                        className="w-full py-2.5 border-2 border-dashed border-[hsl(var(--border))] rounded-2xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                                    >
                                                        + Add Skip Rule
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
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
