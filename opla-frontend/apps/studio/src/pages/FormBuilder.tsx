import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI, projectAPI, sectionTemplateAPI } from '../lib/api';
import { useOrg } from '../contexts/OrgContext';
import StudioLayout from '../components/StudioLayout';
import {
    Save, Play, Trash2, Settings, Smartphone, Layout, Plus,
    MapPin, Camera, Type, Hash, CheckSquare, List, Mail,
    Phone, Calendar, Clock, FileText, ToggleLeft, Mic, PenTool, Barcode,
    ChevronDown, ArrowLeft, GitBranch, Terminal, Pin,
    Layers, Copy, MoveRight, Table2, Database,
    Star, Search, Globe, AlertCircle, CheckCircle2,
    ListTodo, Sliders, ChevronsUpDown, LayoutGrid, ExternalLink, X
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import type { FormRule } from '@opla/types';
import { RulesBuilder } from '../components/RulesBuilder';

type Platform = 'mobile' | 'web' | 'ussd';
type RenderMode = 'single' | 'list';
type FieldType =
    | 'input_text'
    | 'input_number'
    | 'email_input'
    | 'phone_input'
    | 'date_picker'
    | 'time_picker'
    | 'time_range'
    | 'generic_range'
    | 'dropdown'
    | 'radio_group'
    | 'checkbox_group'
    | 'multi_select_dropdown'
    | 'toggle'
    | 'textarea'
    | 'gps_capture'
    | 'photo_capture'
    | 'file_upload'
    | 'signature_pad'
    | 'barcode_scanner'
    | 'audio_recorder'
    | 'matrix_table'
    | 'lookup_list'
    | 'rating_scale'
    | 'object_collection'
    | 'object_instance'
    | 'form_link';

interface FieldOption {
    label: string;        // Display text shown to respondent
    value: string;        // Machine-readable key stored in data
    skip_to?: string;     // Optional: section id to jump to when this option is picked
}

interface TableColumn {
    id: string;
    label: string;
}

interface TableRow {
    id: string;
    label: string;
}

type TableCellType = 'checkbox' | 'radio' | 'text' | 'number' | 'dropdown';

type ObjectPropertyType = 'string' | 'number' | 'integer' | 'decimal' | 'boolean' | 'select' | 'computed';
type ObjectPropertyEditMode = 'fixed' | 'defaulted' | 'editable' | 'hidden';

interface CatalogSourceItem {
    id: string;
    sku_code: string;
    label: string;
    default_price?: number | null;
    unit?: string | null;
    brand?: string | null;
    price_editable?: boolean;
    is_active?: boolean;
}

interface ObjectReferenceDefinition {
    source_type: 'dataset' | 'catalog' | 'user' | 'team' | 'submission' | 'custom';
    source_id?: string;
    label_field?: string;
    value_field?: string;
    filters?: Record<string, any>;
    source_items?: CatalogSourceItem[];
    field_mappings?: Record<string, string>;
}

interface ObjectPropertyDefinition {
    key: string;
    type: ObjectPropertyType;
    label?: string;
    description?: string;
    required?: boolean;
    placeholder?: string;
    options?: FieldOption[];
    default_value?: any;
    edit_mode?: ObjectPropertyEditMode;
    formula?: string;
    reference?: ObjectReferenceDefinition;
}

interface FormObjectDefinition {
    id?: string;
    name?: string;
    label?: string;
    description?: string;
    properties: ObjectPropertyDefinition[];
    allow_manual_add?: boolean;
    allow_manual_remove?: boolean;
    min_items?: number;
    max_items?: number;
}

interface ProjectCatalogItem {
    id: string;
    sku_code: string;
    label: string;
    default_price?: number | null;
    unit?: string | null;
    brand?: string | null;
    price_editable: boolean;
    is_active: boolean;
}

interface FormField {
    id: string;
    sysId?: string;
    type: FieldType;
    label: string;
    required: boolean;
    formula?: string;
    placeholder?: string;
    options?: FieldOption[];         // Replaces old string[]
    platforms?: Platform[];
    min?: number | string;
    max?: number | string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    default_value?: string;          // Pre-filled value; overridable during administration
    is_sensitive?: boolean;          // Marks field as PII / sensitive data
    exclude_from_export?: boolean;   // Omit field from data exports / views
    // Matrix table fields
    table_columns?: TableColumn[];
    table_rows?: TableRow[];
    table_cell_type?: TableCellType;
    table_allow_multiple?: boolean;
    mask?: string;
    lookup_source_type?: 'preset' | 'custom';
    lookup_preset_id?: string;
    lookup_custom_data?: string;
    lookup_separator?: string;
    lookup_label_column?: number | string;
    lookup_value_column?: number | string;
    min_label?: string;
    max_label?: string;

    // Object types
    object_schema_key?: string;
    object_definition?: FormObjectDefinition;
    collection_layout?: 'cards' | 'table';
    allow_add_items?: boolean;
    allow_remove_items?: boolean;
    catalog_source_type?: 'project_catalog';
    catalog_prepopulate_mode?: string;
    required_catalog_item_ids?: string[];

    // Cascading / filtered dropdown support
    cascade_parent_field_id?: string;
    cascade_options_map?: Record<string, FieldOption[]>;
    cascade_dataset_filter_key?: string;

    // Decimal / currency input support
    decimal_places?: number;
    input_prefix?: string;
    input_suffix?: string;

    // Auto-timestamp / dynamic values support
    auto_value?: string;
    auto_value_timing?: 'on_load' | 'on_submit';
    auto_value_editable?: boolean;

    // Form link support
    linked_form_id?: string;
    linked_form_slug?: string;
    linked_form_param_map?: Record<string, string>;

    // Input parameter annotations
    is_input_param?: boolean;
    input_param_readonly?: boolean;

    // Generic Range properties
    range_type?: 'NUMBER' | 'INTEGER' | 'DATE' | 'DATETIME' | 'TIME' | 'WEEKDAY' | 'MONTH' | 'INDEX';
    step_value?: string;
    step_unit?: 'NONE' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'MINUTE' | 'HOUR';
    is_inclusive?: boolean;
    has_no_min?: boolean;
    has_no_max?: boolean;
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
    template_id?: string;
    layout?: SectionCanvasLayout;
}

type SectionCollapseMode = 'full' | 'summary' | 'quarter' | 'title';

interface SectionCanvasLayout {
    x: number;
    y: number;
    width?: number;
    collapsed?: boolean;
    collapse_mode?: SectionCollapseMode;
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

interface FormBlueprint {
    meta: {
        app_id: string;
        app_id_slug: string;
        form_id: string;
        version: number;
        title: string;
        slug: string;
        is_public: boolean;
        visibility?: 'listed' | 'child';
        theme: {
            primary_color: string;
            mode: string;
        };
    };
    schema: Array<Record<string, any>>;
    ui: Array<Record<string, any>>;
    logic: any[];
    rules?: FormRule[];
    linked_form_ids?: string[];
}

const widgetLibrary: Array<{ type: FieldType; label: string; icon: React.ReactNode; defaults?: Partial<FormField> }> = [
    { type: 'input_text', label: 'Text Input', icon: <Type className="w-4 h-4" /> },
    { type: 'input_number', label: 'Number Input', icon: <Hash className="w-4 h-4" /> },
    { type: 'email_input', label: 'Email Input', icon: <Mail className="w-4 h-4" /> },
    { type: 'phone_input', label: 'Phone Input', icon: <Phone className="w-4 h-4" /> },
    { type: 'date_picker', label: 'Date Picker', icon: <Calendar className="w-4 h-4" /> },
    { type: 'time_picker', label: 'Time Picker', icon: <Clock className="w-4 h-4" /> },
    { type: 'time_range', label: 'Time Range', icon: <Clock className="w-4 h-4" /> },
    { type: 'generic_range', label: 'Generic Range', icon: <Sliders className="w-4 h-4" />, defaults: { range_type: 'NUMBER', is_inclusive: true } },
    { type: 'dropdown', label: 'Dropdown', icon: <List className="w-4 h-4" /> },
    { type: 'radio_group', label: 'Radio Group', icon: <CheckSquare className="w-4 h-4" /> },
    { type: 'checkbox_group', label: 'Checkbox Group', icon: <CheckSquare className="w-4 h-4" /> },
    { type: 'multi_select_dropdown', label: 'Multi-Select Dropdown', icon: <List className="w-4 h-4" /> },
    { type: 'toggle', label: 'Toggle', icon: <ToggleLeft className="w-4 h-4" /> },
    { type: 'textarea', label: 'Textarea', icon: <FileText className="w-4 h-4" /> },
    { type: 'gps_capture', label: 'GPS Capture', icon: <MapPin className="w-4 h-4" /> },
    { type: 'photo_capture', label: 'Photo Capture', icon: <Camera className="w-4 h-4" /> },
    { type: 'file_upload', label: 'File Upload', icon: <FileText className="w-4 h-4" /> },
    { type: 'signature_pad', label: 'Signature', icon: <PenTool className="w-4 h-4" /> },
    { type: 'barcode_scanner', label: 'Barcode Scanner', icon: <Barcode className="w-4 h-4" /> },
    { type: 'audio_recorder', label: 'Audio Recorder', icon: <Mic className="w-4 h-4" /> },
    { type: 'matrix_table', label: 'Table / Matrix', icon: <Table2 className="w-4 h-4" /> },
    { type: 'lookup_list', label: 'Lookup List', icon: <Database className="w-4 h-4" />, defaults: { lookup_source_type: 'preset' } },
    { type: 'rating_scale', label: 'Rating Scale', icon: <Star className="w-4 h-4" />, defaults: { min: 1, max: 5, min_label: 'Very Difficult', max_label: 'Very Easy' } },
    { type: 'object_collection', label: 'Object Collection', icon: <Layers className="w-4 h-4" />, defaults: { allow_add_items: true, allow_remove_items: true, collection_layout: 'cards' } },
    { type: 'object_instance', label: 'Object Reference', icon: <FileText className="w-4 h-4" /> },
    { type: 'form_link', label: 'Form Link', icon: <ExternalLink className="w-4 h-4" /> },
];

const widgetCategoryMap: Record<FieldType, string> = {
    input_text: 'Standard Inputs',
    input_number: 'Standard Inputs',
    email_input: 'Standard Inputs',
    phone_input: 'Standard Inputs',
    textarea: 'Standard Inputs',
    date_picker: 'Time & Date',
    time_picker: 'Time & Date',
    time_range: 'Time & Date',
    generic_range: 'Time & Date',
    dropdown: 'Selection Fields',
    radio_group: 'Selection Fields',
    checkbox_group: 'Selection Fields',
    multi_select_dropdown: 'Selection Fields',
    toggle: 'Selection Fields',
    gps_capture: 'Device Metrics',
    barcode_scanner: 'Device Metrics',
    photo_capture: 'Media Input',
    file_upload: 'Media Input',
    audio_recorder: 'Media Input',
    signature_pad: 'Advanced Inputs',
    matrix_table: 'Advanced Inputs',
    lookup_list: 'Advanced Inputs',
    rating_scale: 'Advanced Inputs',
    object_collection: 'Advanced Inputs',
    object_instance: 'Advanced Inputs',
    form_link: 'Navigation',
};

const widgetHints: Record<FieldType, string> = {
    input_text: 'Standard text response single-line text entry field',
    input_number: 'Numeric only text input with custom increment boundaries',
    email_input: 'Validated contact address format query input text box',
    phone_input: 'Contact telephone numeric format input placeholder',
    date_picker: 'Calendar dropdown select widget to stamp standard format dates',
    time_picker: 'Clock dial select interface to stamp standard format times',
    time_range: 'Compound open and close time selection for business hours and schedules',
    generic_range: 'Flexible boundary ranges for integers, decimals, dates, times, and scales',
    dropdown: 'Compact select dropdown containing customizable choices',
    radio_group: 'Radio-button choices layout. Single option select only',
    checkbox_group: 'Multi-checkbox list selector. Allows multiple options',
    multi_select_dropdown: 'Compact dropdown select allowing multiple selections',
    toggle: 'Sleek active toggles list for binary state choices',
    textarea: 'Rich or plain multiple lines responsive narrative description box',
    gps_capture: 'Locates coordinate position via mobile GPS hardware integration',
    barcode_scanner: 'Decodes Barcode/QR values directly from active video capture streams',
    photo_capture: 'Triggers integrated cameras to upload images directly to canvas',
    file_upload: 'Drag-and-drop secure file selector panel attachment',
    audio_recorder: 'Captures live audio logs using secure user mic attachments',
    signature_pad: 'Cursive digital scribble signature trace-pad block container',
    matrix_table: 'Multidimensional choice grid system listing rating scales',
    lookup_list: 'Fetches and suggests items from remote dynamic APIs',
    rating_scale: 'Responsive 5-star custom visual scale review meter widget',
    object_collection: 'Manage a repeating collection of custom object structures',
    object_instance: 'Reference a single structured data object or catalog item',
    form_link: 'Navigational link card that opens a different form with optional parameter passing',
};


const FLOW_NODE_WIDTH = 320;
const FLOW_NODE_GAP_X = 380;
const FLOW_NODE_GAP_Y = 220;
const VARIABLE_DELETE_REVEAL_WIDTH = 88;

const getNextCollapseMode = (mode: SectionCollapseMode): SectionCollapseMode => {
    if (mode === 'full') return 'summary';
    if (mode === 'summary') return 'quarter';
    if (mode === 'quarter') return 'title';
    return 'full';
};

const getDefaultSectionLayout = (index: number): SectionCanvasLayout => ({
    x: 80 + (index % 3) * FLOW_NODE_GAP_X,
    y: 80 + Math.floor(index / 3) * FLOW_NODE_GAP_Y,
    width: FLOW_NODE_WIDTH,
    collapsed: false,
    collapse_mode: 'full',
});

const ensureSectionLayout = (layout: Partial<SectionCanvasLayout> | undefined, index: number): SectionCanvasLayout => {
    const fallback = getDefaultSectionLayout(index);
    const rawCollapseMode = (layout as (Partial<SectionCanvasLayout> & { collapseMode?: SectionCollapseMode }) | undefined)?.collapseMode;
    const collapseMode = rawCollapseMode === 'full' || rawCollapseMode === 'summary' || rawCollapseMode === 'quarter' || rawCollapseMode === 'title'
        ? rawCollapseMode
        : layout?.collapse_mode === 'full' || layout?.collapse_mode === 'summary' || layout?.collapse_mode === 'quarter' || layout?.collapse_mode === 'title'
            ? layout.collapse_mode
            : layout?.collapsed
                ? 'summary'
                : fallback.collapse_mode || 'full';

    return {
        x: typeof layout?.x === 'number' ? layout.x : fallback.x,
        y: typeof layout?.y === 'number' ? layout.y : fallback.y,
        width: typeof layout?.width === 'number' ? layout.width : fallback.width,
        collapsed: collapseMode !== 'full',
        collapse_mode: collapseMode,
    };
};

const propertyMetaDetails: Record<string, { name: string; description: string }> = {
    label: {
        name: "Label",
        description: "The primary header or question text presented to respondents in the form canvas."
    },
    bindKey: {
        name: "Bind Key",
        description: "The unique programmatic developer identifier. Used to reference field responses in database logs and logic scripts."
    },
    required: {
        name: "Required Field",
        description: "Imposes form submission validation requiring fields to contain valid responses before forward navigation is allowed."
    },
    placeholder: {
        name: "Placeholder",
        description: "Sleek low-contrast text visible in the input bounds prior to respondents beginning their layout input workflow."
    },
    minLength: {
        name: "Min Length",
        description: "Minimum character limits imposed on text responses to control database memory bounds."
    },
    maxLength: {
        name: "Max Length",
        description: "Maximum character limits imposed on text responses to control database memory bounds."
    },
    min: {
        name: "Min Limit / Boundary",
        description: "The absolute minimum value bound allowed for numeric inputs, ratings, or date/time coordinates."
    },
    max: {
        name: "Max Limit / Boundary",
        description: "The absolute maximum value bound allowed for numeric inputs, ratings, or date/time coordinates."
    },
    min_label: {
        name: "Min Value Label",
        description: "Explanatory anchor text displayed directly below scale min values (e.g., 'Extremely unlikely')."
    },
    max_label: {
        name: "Max Value Label",
        description: "Explanatory anchor text displayed directly below scale max values (e.g., 'Extremely likely')."
    },
    mask: {
        name: "Input Mask Format",
        description: "Use formatting rules (e.g. 9 for numbers, A for uppercase) to guide respondent input values."
    },
    formula: {
        name: "Computation Formula",
        description: "Implements client-side computed expressions dynamically based on other numeric layout answers."
    },
    table_cell_type: {
        name: "Table Cell Widget",
        description: "Determine the input controller type utilized across matrix table grid cells."
    },
    table_allow_multiple: {
        name: "Multiple Responses",
        description: "Enable checkbox grid cells so respondents can check more than one column choice per statement."
    },
    lookup_source: {
        name: "Lookup API Source",
        description: "Connect catalog datasets or CSV options lists to dynamically populate suggestions."
    },
    object_schema_key: {
        name: "Reference Schema ID",
        description: "Programmatic identifier of the structured schema template model queried."
    },
    catalog_source_type: {
        name: "Source Provider Type",
        description: "Toggle catalog index reference lookup versus localized CSV options tables."
    },
    exclude_from_export: {
        name: "Exclude Export",
        description: "Omit this variable parameter from bulk download datasets for security."
    },
    is_sensitive: {
        name: "PII Sensitive Data",
        description: "Marks field as containing Personally Identifiable Information to restrict view permissions."
    },
    default_value: {
        name: "Default Value",
        description: "Pre-filled value populated automatically on form load, overridable by respondents."
    }
};


const ChoicesSetupInput: React.FC<{
    selectedField: any;
    sections: any[];
    updateField: (id: string, patch: any) => void;
}> = ({ selectedField, sections, updateField }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');

    const options = selectedField.options || [];

    const handleAddChoice = () => {
        const label = `Choice ${(options.length || 0) + 1}`;
        updateField(selectedField.id, {
            options: [...options, { label, value: toSmartValue(label) }]
        });
    };

    const handleSaveBulk = () => {
        const generateBulkKey = (str: string): string => {
            return str
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_+|_+$/g, '');
        };

        const lines = bulkText.split('\n');
        const parsedOptions = lines
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                const parts = line.split('|').map(p => p.trim());
                const label = parts[0] || '';
                const rawKey = parts[1] || label;
                const value = generateBulkKey(rawKey);
                const skip_to = parts[2] || undefined;
                return { label, value, skip_to };
            });
        updateField(selectedField.id, { options: parsedOptions });
        setIsBulkOpen(false);
    };

    const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (idx === options.length - 1) {
                const label = `Choice ${options.length + 1}`;
                updateField(selectedField.id, {
                    options: [...options, { label, value: toSmartValue(label) }]
                });
            }
        }
    };

    return (
        <div className="w-full">
            {/* Header Accordion Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-[hsl(var(--surface-elevated))]/20 select-none transition-all border-b border-[hsl(var(--border))]/20"
            >
                <div className="flex items-center gap-1.5">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform text-[hsl(var(--text-tertiary))] ${isOpen ? '' : '-rotate-90'}`} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">Choices Setup</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))]/80 px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/40 font-semibold">
                        {options.length} {options.length === 1 ? 'choice' : 'choices'}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="w-full border-b border-[hsl(var(--border))]/20 animate-in fade-in duration-100 bg-[hsl(var(--surface))]">
                    {options.length > 0 ? (
                        <div className="w-full flex flex-col">
                            {/* Table Header */}
                            <div className="flex items-center text-[9px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider px-4 py-1.5 border-b border-[hsl(var(--border))]/15 select-none bg-[hsl(var(--surface-elevated))]/10">
                                <div className="w-[45%]">Label</div>
                                <div className="w-[20%] pl-2">Key</div>
                                <div className="w-[28%] pl-2">Go To</div>
                                <div className="w-[7%] text-center"></div>
                            </div>

                            {/* Table Body Rows */}
                            <div className="divide-y divide-[hsl(var(--border))]/10 max-h-[320px] overflow-y-auto hide-scrollbar select-text">
                                {options.map((opt: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="flex items-center min-h-[30px] px-4 py-0.5 hover:bg-[hsl(var(--surface-elevated))]/10 transition-colors"
                                    >
                                        {/* Label Input */}
                                        <div className="w-[45%] pr-1 flex items-center">
                                            <input
                                                value={opt.label}
                                                onChange={(e) => {
                                                    const newOpts = [...options];
                                                    newOpts[idx] = { ...opt, label: e.target.value };
                                                    updateField(selectedField.id, { options: newOpts });
                                                }}
                                                onKeyDown={(e) => handleLabelKeyDown(e, idx)}
                                                placeholder="Label"
                                                className="w-full bg-transparent px-1 py-0.5 border-0 focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                                            />
                                        </div>

                                        {/* Key Input */}
                                        <div className="w-[20%] px-2 border-l border-[hsl(var(--border))]/10 flex items-center">
                                            <input
                                                value={opt.value}
                                                onChange={(e) => {
                                                    const newOpts = [...options];
                                                    newOpts[idx] = { ...opt, value: toSmartValue(e.target.value) };
                                                    updateField(selectedField.id, { options: newOpts });
                                                }}
                                                placeholder="key"
                                                className="w-full bg-transparent px-1 py-0.5 border-0 focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded font-mono text-[10px] outline-none text-[hsl(var(--text-primary))]"
                                            />
                                        </div>

                                        {/* Go To Skip Logic */}
                                        <div className="w-[28%] px-2 border-l border-[hsl(var(--border))]/10 flex items-center">
                                            <select
                                                value={opt.skip_to || ''}
                                                onChange={(e) => {
                                                    const newOpts = [...options];
                                                    newOpts[idx] = { ...opt, skip_to: e.target.value || undefined };
                                                    updateField(selectedField.id, { options: newOpts });
                                                }}
                                                className="w-full bg-transparent px-1 py-0.5 border-0 focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[10px] outline-none text-[hsl(var(--text-primary))] cursor-pointer truncate"
                                            >
                                                <option value="" className="bg-[hsl(var(--surface))]">Next Field</option>
                                                {sections.map((s: any, i: number) => (
                                                    <option key={s.id} value={s.id} className="bg-[hsl(var(--surface))]">
                                                        S{i + 1}: {s.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Delete Action */}
                                        <div className="w-[7%] flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newOpts = options.filter((_: any, i: number) => i !== idx);
                                                    updateField(selectedField.id, { options: newOpts });
                                                }}
                                                className="p-1 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded transition-all"
                                                title="Delete Choice"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                            No choices configured yet.
                        </div>
                    )}

                    {/* Actions footer */}
                    <div className="px-4 py-2 flex gap-2 border-t border-[hsl(var(--border))]/10 bg-[hsl(var(--surface-elevated))]/5">
                        <button
                            type="button"
                            onClick={handleAddChoice}
                            className="flex-1 py-1 text-center border border-dashed border-[hsl(var(--border))]/60 hover:border-[hsl(var(--primary))]/40 rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 shadow-sm"
                        >
                            + Add Choice
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setBulkText(
                                    options
                                        .map((o: any) => `${o.label}${o.value !== toSmartValue(o.label) ? ` | ${o.value}` : ''}${o.skip_to ? ` | ${o.skip_to}` : ''}`)
                                        .join('\n')
                                );
                                setIsBulkOpen(true);
                            }}
                            className="px-3 py-1 text-center border border-[hsl(var(--border))]/60 hover:border-[hsl(var(--primary))]/40 rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/10 shadow-sm"
                        >
                            Bulk Edit
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Edit Dialog */}
            {isBulkOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-text">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-[hsl(var(--border))]/20 flex justify-between items-center bg-[hsl(var(--surface-elevated))]/40 shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))]">Bulk Edit Choices</h3>
                                <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-0.5">Enter one choice option per line.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBulkOpen(false)}
                                className="h-7 w-7 rounded-md bg-[hsl(var(--surface-elevated))]/50 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all flex items-center justify-center border border-[hsl(var(--border))]/20 text-xs"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="p-4 flex-1 flex flex-col space-y-2">
                            <textarea
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                placeholder="Option A&#10;Option B&#10;Option C | custom_key&#10;Option D | key_d | section_skip_id"
                                className="w-full flex-1 min-h-[220px] max-h-[350px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))]/40 rounded-lg p-2.5 font-mono text-xs text-[hsl(var(--text-primary))] outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] resize-none"
                            />
                            <div className="text-[9px] text-[hsl(var(--text-tertiary))] leading-relaxed bg-[hsl(var(--surface-elevated))]/20 p-2 rounded border border-[hsl(var(--border))]/25">
                                <strong>Format:</strong> <code>Label</code> or <code>Label | Key</code> or <code>Label | Key | SkipToSectionId</code>.<br />
                                Keys are generated automatically if left empty.
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-[hsl(var(--border))]/20 bg-[hsl(var(--surface-elevated))]/30 flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsBulkOpen(false)}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold border border-[hsl(var(--border))]/40 hover:bg-[hsl(var(--surface-elevated))]/50 text-[hsl(var(--text-secondary))] transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveBulk}
                                className="px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 transition-all shadow-md shadow-[hsl(var(--primary))]/10"
                            >
                                Apply Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const ObjectPropertiesInput: React.FC<{
    selectedObjectProperties: any[];
    addSelectedObjectProperty: () => void;
    removeSelectedObjectProperty: (index: number) => void;
    updateSelectedObjectProperty: (index: number, patch: any) => void;
}> = ({ selectedObjectProperties, addSelectedObjectProperty, removeSelectedObjectProperty, updateSelectedObjectProperty }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline flex items-center justify-between w-full"
            >
                <span>{selectedObjectProperties.length} Properties</span>
                <span className="text-[10px] text-[hsl(var(--text-tertiary))]">{isOpen ? 'Hide' : 'Configure...'}</span>
            </button>
            {isOpen && (
                <div className="mt-3 space-y-3 border-t border-[hsl(var(--border))]/20 pt-2 w-full animate-in fade-in duration-100">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-[hsl(var(--text-secondary))]">Schema Properties</span>
                        <button
                            type="button"
                            onClick={addSelectedObjectProperty}
                            className="text-[9px] font-bold uppercase text-[hsl(var(--primary))] hover:underline"
                        >
                            + Add
                        </button>
                    </div>
                    {selectedObjectProperties.length === 0 ? (
                        <div className="text-center py-2 text-[10px] text-[hsl(var(--text-tertiary))] italic bg-[hsl(var(--surface-elevated))]/20 border border-dashed border-[hsl(var(--border))]/50 rounded-lg">
                            No properties defined.
                        </div>
                    ) : selectedObjectProperties.map((property: any, propertyIndex: number) => (
                        <div key={`${property.key}_${propertyIndex}`} className="p-2.5 bg-[hsl(var(--surface-elevated))]/45 border border-[hsl(var(--border))]/20 rounded-xl space-y-2 relative text-[hsl(var(--text-primary))]">
                            <button
                                type="button"
                                onClick={() => removeSelectedObjectProperty(propertyIndex)}
                                className="absolute top-1.5 right-1.5 p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10 rounded"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                Prop #{propertyIndex + 1}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Key</label>
                                    <input
                                        value={property.key}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { key: toSmartValue(e.target.value || `property_${propertyIndex + 1}`) })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs font-mono outline-none text-[hsl(var(--text-primary))]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Label</label>
                                    <input
                                        value={property.label || ''}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { label: e.target.value })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Type</label>
                                    <select
                                        value={property.type}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { type: e.target.value as ObjectPropertyType })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-[11px] outline-none text-[hsl(var(--text-primary))]"
                                    >
                                        <option value="string">Text</option>
                                        <option value="integer">Integer</option>
                                        <option value="decimal">Decimal</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Boolean</option>
                                        <option value="select">Select</option>
                                        <option value="computed">Computed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Edit Mode</label>
                                    <select
                                        value={property.edit_mode || 'editable'}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { edit_mode: e.target.value as ObjectPropertyEditMode })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-[11px] outline-none text-[hsl(var(--text-primary))]"
                                    >
                                        <option value="editable">Editable</option>
                                        <option value="defaulted">Defaulted</option>
                                        <option value="fixed">Fixed</option>
                                        <option value="hidden">Hidden</option>
                                    </select>
                                </div>
                            </div>
                            {property.type === 'computed' ? (
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Formula</label>
                                    <input
                                        value={property.formula || ''}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { formula: e.target.value })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs font-mono outline-none text-[hsl(var(--text-primary))]"
                                        placeholder="e.g. qty * price"
                                    />
                                </div>
                            ) : property.type === 'select' ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Select Source</label>
                                        <select
                                            value={property.reference?.source_type === 'catalog' ? 'catalog' : 'manual'}
                                            onChange={(e) => {
                                                if (e.target.value === 'catalog') {
                                                    updateSelectedObjectProperty(propertyIndex, {
                                                        reference: {
                                                            source_type: 'catalog',
                                                            source_id: 'project_catalog',
                                                            label_field: 'label',
                                                            value_field: 'id'
                                                        },
                                                        options: undefined
                                                    });
                                                } else {
                                                    updateSelectedObjectProperty(propertyIndex, {
                                                        reference: undefined,
                                                        options: [
                                                            { label: 'Option A', value: 'option_a' },
                                                            { label: 'Option B', value: 'option_b' }
                                                        ]
                                                    });
                                                }
                                            }}
                                            className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-[11px] outline-none text-[hsl(var(--text-primary))]"
                                        >
                                            <option value="manual">Manual Options</option>
                                            <option value="catalog">Project Catalog Reference</option>
                                        </select>
                                    </div>
                                    {property.reference?.source_type === 'catalog' ? (
                                        <div className="text-[9px] text-[hsl(var(--text-tertiary))] leading-normal bg-[hsl(var(--surface-elevated))]/20 p-2 rounded border border-[hsl(var(--border))]/25">
                                            Linked to Project Catalog. Properties named <code>unit_price</code> or <code>price</code> will auto-fill with selected product MSRP.
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Options (comma-separated)</label>
                                            <input
                                                value={(property.options || []).map((o: any) => o.label).join(', ')}
                                                onChange={(e) => {
                                                    const parts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                    const nextOptions = parts.map(label => ({
                                                        label,
                                                        value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                                                    }));
                                                    updateSelectedObjectProperty(propertyIndex, { options: nextOptions });
                                                }}
                                                className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                                                placeholder="e.g. Option A, Option B"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] block mb-0.5">Default Value</label>
                                    <input
                                        value={property.default_value ?? ''}
                                        onChange={(e) => updateSelectedObjectProperty(propertyIndex, { default_value: e.target.value })}
                                        className="w-full bg-[hsl(var(--surface))] px-1 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                                        placeholder="Optional"
                                    />
                                </div>
                            )}
                            <label className="flex items-center justify-between p-1 bg-[hsl(var(--surface))]/50 rounded cursor-pointer text-[11px]">
                                <span className="font-semibold text-[hsl(var(--text-secondary))]">Required</span>
                                <input
                                    type="checkbox"
                                    checked={!!property.required}
                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { required: e.target.checked })}
                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20"
                                />
                            </label>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const TableColumnsInput: React.FC<{
    selectedField: any;
    updateField: (id: string, patch: any) => void;
}> = ({ selectedField, updateField }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline flex items-center justify-between w-full"
            >
                <span>{(selectedField.table_columns || []).length} Columns</span>
                <span className="text-[10px] text-[hsl(var(--text-tertiary))]">{isOpen ? 'Hide' : 'Configure...'}</span>
            </button>
            {isOpen && (
                <div className="mt-2 space-y-2 border-t border-[hsl(var(--border))]/20 pt-2 w-full animate-in fade-in duration-100 text-[hsl(var(--text-primary))]">
                    {(selectedField.table_columns || []).map((col: any, ci: number) => (
                        <div key={col.id} className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))] w-6">C{ci+1}:</span>
                            <input
                                value={col.label}
                                onChange={(e) => {
                                    const cols = [...(selectedField.table_columns || [])];
                                    cols[ci] = { ...col, label: e.target.value };
                                    updateField(selectedField.id, { table_columns: cols });
                                }}
                                className="flex-1 bg-[hsl(var(--surface))] px-1.5 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const cols = (selectedField.table_columns || []).filter((_: any, i: number) => i !== ci);
                                    updateField(selectedField.id, { table_columns: cols });
                                }}
                                className="p-1 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            const cols = selectedField.table_columns || [];
                            const n = cols.length + 1;
                            updateField(selectedField.id, {
                                table_columns: [...cols, { id: `col_${Date.now()}`, label: `Column ${n}` }]
                            });
                        }}
                        className="w-full py-1 text-center border border-dashed border-[hsl(var(--border))]/60 hover:border-[hsl(var(--primary))]/40 rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20"
                    >
                        + Add Column
                    </button>
                </div>
            )}
        </div>
    );
};

const TableRowsInput: React.FC<{
    selectedField: any;
    updateField: (id: string, patch: any) => void;
}> = ({ selectedField, updateField }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline flex items-center justify-between w-full"
            >
                <span>{(selectedField.table_rows || []).length} Rows</span>
                <span className="text-[10px] text-[hsl(var(--text-tertiary))]">{isOpen ? 'Hide' : 'Configure...'}</span>
            </button>
            {isOpen && (
                <div className="mt-2 space-y-2 border-t border-[hsl(var(--border))]/20 pt-2 w-full animate-in fade-in duration-100 text-[hsl(var(--text-primary))]">
                    {(selectedField.table_rows || []).map((row: any, ri: number) => (
                        <div key={row.id} className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))] w-6">R{ri+1}:</span>
                            <input
                                value={row.label}
                                onChange={(e) => {
                                    const rows = [...(selectedField.table_rows || [])];
                                    rows[ri] = { ...row, label: e.target.value };
                                    updateField(selectedField.id, { table_rows: rows });
                                }}
                                className="flex-1 bg-[hsl(var(--surface))] px-1.5 py-0.5 border border-[hsl(var(--border))]/40 rounded text-xs outline-none text-[hsl(var(--text-primary))]"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const rows = (selectedField.table_rows || []).filter((_: any, i: number) => i !== ri);
                                    updateField(selectedField.id, { table_rows: rows });
                                }}
                                className="p-1 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            const rows = selectedField.table_rows || [];
                            const n = rows.length + 1;
                            updateField(selectedField.id, {
                                table_rows: [...rows, { id: `row_${Date.now()}`, label: `Statement ${n}` }]
                            });
                        }}
                        className="w-full py-1 text-center border border-dashed border-[hsl(var(--border))]/60 hover:border-[hsl(var(--primary))]/40 rounded-lg text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20"
                    >
                        + Add Row
                    </button>
                </div>
            )}
        </div>
    );
};

interface ParsedCustomData {
    type: 'csv' | 'json' | 'empty';
    headers: string[];
    rows: Array<Record<string, any>>;
    error?: string;
}

export function parseCustomLookupData(dataString: string, separator = ','): ParsedCustomData {
    const trimmed = (dataString || '').trim();
    if (!trimmed) {
        return { type: 'empty', headers: [], rows: [] };
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                const keysSet = new Set<string>();
                parsed.forEach(item => {
                    if (item && typeof item === 'object') {
                        Object.keys(item).forEach(k => keysSet.add(k));
                    }
                });
                const headers = Array.from(keysSet);
                return {
                    type: 'json',
                    headers,
                    rows: parsed.filter(item => item && typeof item === 'object')
                };
            }
        } catch (err: any) {
            return { type: 'json', headers: [], rows: [], error: `JSON Parse Error: ${err.message}` };
        }
    }

    // Default to CSV
    try {
        const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length === 0) {
            return { type: 'csv', headers: [], rows: [] };
        }

        const firstLineCols = lines[0].split(separator).map(c => c.trim());
        const headers = firstLineCols.length > 0 ? firstLineCols : ['Column 1'];
        const dataLines = lines.slice(1);

        const rows = dataLines.map((line) => {
            const cols = line.split(separator).map(c => c.trim());
            const rowObj: Record<string, any> = {};
            headers.forEach((h, colIdx) => {
                rowObj[h] = cols[colIdx] || '';
            });
            return rowObj;
        });

        return { type: 'csv', headers, rows };
    } catch (err: any) {
        return { type: 'csv', headers: [], rows: [], error: `CSV Parse Error: ${err.message}` };
    }
}

const LookupCustomDataInput: React.FC<{
    selectedField: any;
    updateField: (id: string, patch: any) => void;
}> = ({ selectedField, updateField }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dataString = selectedField.lookup_custom_data || '';
    const separator = selectedField.lookup_separator || ',';
    const parsed = useMemo(() => parseCustomLookupData(dataString, separator), [dataString, separator]);

    const displayRowsCount = parsed.type === 'csv' ? Math.max(0, parsed.rows.length) : parsed.rows.length;

    return (
        <div className="w-full space-y-3 py-1">
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline flex items-center gap-1.5"
                >
                    <span>
                        {parsed.type === 'empty' ? 'No Data Configured' : `${displayRowsCount} Rows (${parsed.type.toUpperCase()})`}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--text-tertiary))]">
                        {isOpen ? 'Hide Editor' : 'Edit CSV/JSON...'}
                    </span>
                </button>

                {parsed.type !== 'empty' && (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        parsed.error
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : 'bg-green-500/15 text-green-400 border border-green-500/30'
                    }`}>
                        {parsed.error ? 'Format Error' : 'Valid'}
                    </span>
                )}
            </div>

            {parsed.error && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-mono whitespace-pre-wrap">
                    {parsed.error}
                </div>
            )}

            {isOpen && (
                <div className="space-y-2">
                    <textarea
                        value={dataString}
                        onChange={(e) => updateField(selectedField.id, { lookup_custom_data: e.target.value })}
                        className="w-full min-h-[120px] bg-[hsl(var(--surface-elevated))]/60 border border-[hsl(var(--border))]/60 focus:border-[hsl(var(--primary))]/60 rounded-lg p-2 font-mono text-[10px] outline-none text-[hsl(var(--text-primary))] transition-all focus:ring-1 focus:ring-[hsl(var(--primary))]/20 shadow-inner"
                        placeholder={`CSV:\nregion,market_id,market_name\ngreater_accra,makola,Makola\n\nOr JSON:\n[\n  {"region": "greater_accra", "market_id": "makola", "market_name": "Makola"}\n]`}
                    />
                </div>
            )}

            {!parsed.error && parsed.headers.length > 0 && (
                <div className="border border-[hsl(var(--border))]/40 rounded-lg overflow-hidden bg-[hsl(var(--surface-elevated))]/20 shadow-sm">
                    <div className="px-2.5 py-1.5 border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/30 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] uppercase tracking-wider">Preview Table</span>
                        <span className="text-[9px] text-[hsl(var(--text-tertiary))]">Showing first 5 rows</span>
                    </div>
                    <div className="overflow-x-auto max-h-[180px] overflow-y-auto">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead>
                                <tr className="border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/40">
                                    {parsed.headers.map((header) => (
                                        <th key={header} className="px-2 py-1.5 font-bold text-[hsl(var(--text-secondary))] border-r border-[hsl(var(--border))]/20 last:border-0">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {parsed.rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={parsed.headers.length} className="px-2 py-3 text-center text-[hsl(var(--text-tertiary))] font-medium italic">
                                            {parsed.type === 'csv' ? 'No data rows (only header row present)' : 'Empty array'}
                                        </td>
                                    </tr>
                                ) : (
                                    parsed.rows.slice(0, 5).map((row, rIdx) => (
                                        <tr key={rIdx} className="border-b border-[hsl(var(--border))]/20 last:border-0 hover:bg-[hsl(var(--surface-elevated))]/30 transition-colors">
                                            {parsed.headers.map((header) => (
                                                <td key={header} className="px-2 py-1.5 text-[hsl(var(--text-primary))] font-mono truncate max-w-[120px] border-r border-[hsl(var(--border))]/20 last:border-0">
                                                    {String(row[header] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};


const CATALOG_BLOCKED_TYPES: Set<FieldType> = new Set([
    'gps_capture',
    'photo_capture',
    'file_upload',
    'signature_pad',
    'audio_recorder',
    'object_collection',
    'object_instance',
    'form_link',
]);

/** Scalar fields that can serve as catalog key or display label */
const CATALOG_DESIGNATABLE_FIELD_TYPES: Set<FieldType> = new Set([
    'input_text',
    'input_number',
    'email_input',
    'phone_input',
    'textarea',
    'dropdown',
    'radio_group',
    'barcode_scanner',
    'toggle',
]);


const FormBuilder: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const navigate = useNavigate();
    const { currentOrg } = useOrg();
    const { showToast } = useToast();
    const [formMeta, setFormMeta] = useState<{
        id: string;
        project_id: string;
        slug: string;
        version: number;
        is_public: boolean;
        status?: 'draft' | 'live' | 'archived';
        published_version?: number | null;
        kind?: 'standard' | 'catalog';
        catalog_key_field_id?: string | null;
        catalog_label_field_id?: string | null;
    } | null>(null);
    const [title, setTitle] = useState('Untitled Form');
    const [, setTemplates] = useState<any[]>([]);
    const defaultSectionProperties = (): SectionProperties => ({ render_mode: 'list', platforms: ['mobile', 'web'] });
    const [sections, setSections] = useState<FormSection[]>([{ id: 'screen_1', title: 'Section 1', fields: [], properties: defaultSectionProperties(), layout: ensureSectionLayout(undefined, 0) }]);
    const [currentSectionId, setCurrentSectionId] = useState<string>('screen_1');
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [rulesModalContext, setRulesModalContext] = useState<{ triggerId: string; triggerType: 'field' | 'section'; timing: 'pre' | 'post'; label: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [activeLeftTab, setActiveLeftTab] = useState<'sections' | 'widgets'>('sections');
    const [hoveredProperty, setHoveredProperty] = useState<{ name: string; description: string } | null>(null);
    const [collapsedPropCategories, setCollapsedPropCategories] = useState<Record<string, boolean>>({});
    const [collapsedWidgetCategories, setCollapsedWidgetCategories] = useState<Record<string, boolean>>({});
    const [sectionSearchQuery, setSectionSearchQuery] = useState('');
    const [widgetSearchQuery, setWidgetSearchQuery] = useState('');
    const [isLeftPanelPinned, setIsLeftPanelPinned] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(560);
    const isResizingLeftPanel = useRef(false);
    const leftPanelStartX = useRef(0);
    const leftPanelStartW = useRef(0);
    const [rightPanelWidth, setRightPanelWidth] = useState(560);
    const isResizingRightPanel = useRef(false);
    const rightPanelStartX = useRef(0);
    const rightPanelStartW = useRef(0);
    const [isRightSidebarPinned, setIsRightSidebarPinned] = useState(true);
    const [view, setView] = useState<'flow' | 'section'>('flow');
    const [formRules, setFormRules] = useState<FormRule[]>([]);
    const [formVisibility] = useState<'listed' | 'child'>('listed'); // kept for type compat, auto-detected on mobile
    const [projectForms, setProjectForms] = useState<Array<{ id: string; title: string; slug: string }>>([]);

    const allFieldsFlattened = useMemo(() => {
        return sections.flatMap(s => s.fields.map(f => ({
            ...f,
            id: f.id,
            label: f.label || f.id,
            type: f.type,
            options: f.options
        })));
    }, [sections]);
    const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
    const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
    const [dragEnabledFieldId, setDragEnabledFieldId] = useState<string | null>(null);
    const dragFieldIdRef = React.useRef<string | null>(null);
    const swipeStateRef = React.useRef<{ fieldId: string | null; startX: number; startY: number; offset: number; swiping: boolean }>({
        fieldId: null,
        startX: 0,
        startY: 0,
        offset: 0,
        swiping: false,
    });
    const flowCanvasRef = React.useRef<HTMLDivElement | null>(null);
    const [moveMenuFieldId, setMoveMenuFieldId] = useState<string | null>(null);
    const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
    const [sectionDragOffset, setSectionDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [, setShowMultiActionMenu] = useState(false);
    const [, setShowBackupTools] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'form' | 'section' | 'widget'>('section');

    // Quick-Add states
    const [quickAddOpen, setQuickAddOpen] = useState(false);
    const [quickAddIndex, setQuickAddIndex] = useState<number | null>(null);
    const [quickAddSearchQuery, setQuickAddSearchQuery] = useState('');
    const [quickAddKeyboardIndex, setQuickAddKeyboardIndex] = useState(0);

    // Recent and common fields tracking for quick add
    const [recentFields, setRecentFields] = useState<FieldType[]>(() => {
        try {
            const saved = localStorage.getItem('opla_recent_fields');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.every(x => typeof x === 'string')) {
                    return parsed.slice(0, 2) as FieldType[];
                }
            }
        } catch (e) {
            console.error(e);
        }
        return ['input_text', 'input_number'] as FieldType[];
    });

    const trackUsedField = (type: FieldType) => {
        setRecentFields(prev => {
            const filtered = prev.filter(t => t !== type);
            const updated = [type, ...filtered].slice(0, 2);
            localStorage.setItem('opla_recent_fields', JSON.stringify(updated));
            return updated;
        });
    };

    const quickButtons = useMemo(() => {
        const POOL: FieldType[] = ['input_text', 'input_number', 'date_picker', 'dropdown', 'checkbox_group'];
        let recent = recentFields.filter(t => !(formMeta?.kind === 'catalog' && CATALOG_BLOCKED_TYPES.has(t)));
        for (const item of POOL) {
            if (recent.length >= 2) break;
            if (!recent.includes(item)) {
                recent.push(item);
            }
        }
        recent = recent.slice(0, 2);
        const availableCommon = POOL.filter(type => !recent.includes(type));
        const common = availableCommon.slice(0, 2);
        return {
            left: common,  // Most common (front)
            right: recent  // Last 2 used (back)
        };
    }, [recentFields, formMeta?.kind]);

    const handleQuickAddDirectly = (index: number, type: FieldType) => {
        trackUsedField(type);
        
        const uniqueId = `field_${Date.now()}`;
        const sysId = `FIELD_${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
        const widget = widgetLibrary.find(w => w.type === type);
        const widgetLabel = widget?.label || `New ${type.replace(/_/g, ' ')}`;
        const defaults = buildFieldTypeDefaults(type);
        
        const newField: FormField = {
            id: uniqueId,
            sysId: sysId,
            type: type,
            label: widgetLabel,
            required: false,
            placeholder: defaults.placeholder || `Enter ${widgetLabel.toLowerCase()}...`,
            ...defaults,
        };

        setSections(prev => prev.map(section => {
            if (section.id !== currentSectionId) return section;
            const fields = [...section.fields];
            fields.splice(index, 0, newField);
            return { ...section, fields };
        }));

        setSelectedFieldId(uniqueId);
        
        // Apply focus to Properties Panel Label Input
        setTimeout(() => {
            const input = document.getElementById('field-label-input') as HTMLInputElement | null;
            if (input) {
                input.focus();
                input.select();
            }
        }, 120);
    };
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const [isSectionListOpen, setIsSectionListOpen] = useState(false);
    const sectionListRef = React.useRef<HTMLDivElement | null>(null);
    const [globalCollapseMode, setGlobalCollapseMode] = useState<SectionCollapseMode>('full');
    const [zoom, setZoom] = useState<number>(1);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = React.useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true');
            if (isTyping) {
                return;
            }

            if (event.code === 'Space') {
                event.preventDefault();
                setIsSpacePressed(true);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                setIsSpacePressed(false);
                setIsPanning(false);
            }
        };

        const handleBlur = () => {
            setIsSpacePressed(false);
            setIsPanning(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    const handleToggleAllCollapseModes = () => {
        const nextMode = globalCollapseMode === 'full'
            ? 'summary'
            : globalCollapseMode === 'summary'
                ? 'quarter'
                : globalCollapseMode === 'quarter'
                    ? 'title'
                    : 'full';
        setGlobalCollapseMode(nextMode);
        setSections((prev) => prev.map((section, idx) => ({
            ...section,
            layout: {
                ...ensureSectionLayout(section.layout, idx),
                collapse_mode: nextMode,
                collapsed: nextMode !== 'full',
            }
        })));
    };

    const handleAutoArrangeSections = () => {
        const cardsPerRow = 5;
        const startX = 80;
        const startY = 80;
        const gapX = FLOW_NODE_GAP_X;
        const gapY = 320;

        setSections((prev) => prev.map((section, idx) => ({
            ...section,
            layout: {
                ...ensureSectionLayout(section.layout, idx),
                x: startX + (idx % cardsPerRow) * gapX,
                y: startY + Math.floor(idx / cardsPerRow) * gapY,
            }
        })));

        if (sections.length > 0 && flowCanvasRef.current) {
            const viewportWidth = flowCanvasRef.current.clientWidth;
            const viewportHeight = flowCanvasRef.current.clientHeight;
            const nodeWidth = FLOW_NODE_WIDTH;
            const nodeHeight = 240;

            const targetScrollLeft = (startX + nodeWidth / 2) * zoom - (viewportWidth / 2);
            const targetScrollTop = (startY + nodeHeight / 2) * zoom - (viewportHeight / 2);

            flowCanvasRef.current.scrollTo({
                left: Math.max(0, targetScrollLeft),
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });
        }
    };

    const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const isMiddleClick = event.button === 1;
        const shouldPan = isSpacePressed || isMiddleClick;
        
        // If we are not in panning state, check if we clicked on the background
        if (!shouldPan) {
            const isInteractive = (event.target as HTMLElement).closest('[data-drag-handle="true"]') || 
                                  (event.target as HTMLElement).closest('button') || 
                                  (event.target as HTMLElement).closest('.absolute.rounded-2xl.border'); // card container
            if (isInteractive) {
                return;
            }
        }
        
        event.preventDefault();
        setIsPanning(true);
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: flowCanvasRef.current?.scrollLeft || 0,
            scrollTop: flowCanvasRef.current?.scrollTop || 0,
        };
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    };

    const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanning || !flowCanvasRef.current) return;
        event.preventDefault();
        const deltaX = event.clientX - panStartRef.current.x;
        const deltaY = event.clientY - panStartRef.current.y;
        flowCanvasRef.current.scrollLeft = panStartRef.current.scrollLeft - deltaX;
        flowCanvasRef.current.scrollTop = panStartRef.current.scrollTop - deltaY;
    };

    const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPanning) return;
        setIsPanning(false);
        try {
            (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        } catch (e) {
            // ignore
        }
    };

    useEffect(() => {
        if (selectedFieldId) {
            setActiveSidebarTab('widget');
            setIsRightSidebarOpen(true);
        } else {
            setActiveSidebarTab('section');
        }
    }, [selectedFieldId]);

    // Scroll selected widget in Quick-Add modal into view
    useEffect(() => {
        if (!quickAddOpen) return;
        const activeEl = document.querySelector('[data-active-widget="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [quickAddKeyboardIndex, quickAddOpen]);

    const [initialHash, setInitialHash] = useState<string>('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [swipedFieldId, setSwipedFieldId] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [confirmDeleteFieldId, setConfirmDeleteFieldId] = useState<string | null>(null);

    useEffect(() => {
        if (!swipedFieldId) {
            setConfirmDeleteFieldId(null);
        }
    }, [swipedFieldId]);
    const [activeVersions, setActiveVersions] = useState<Array<{
        id: string;
        kind: 'draft' | 'live';
        slot_index?: number | null;
        version_number: number;
        created_at?: string;
        blueprint?: any;
    }>>([]);
    const [catalogItems, setCatalogItems] = useState<ProjectCatalogItem[]>([]);

    const multiActionMenuRef = React.useRef<HTMLDivElement | null>(null);
    const consoleWindowRef = React.useRef<HTMLDivElement | null>(null);

    const computeHash = (t: string, s: any[], r: any[]) => JSON.stringify({ t, s, r });

    useEffect(() => {
        if (initialHash) {
            const currentHash = computeHash(title, sections, formRules);
            setHasUnsavedChanges(currentHash !== initialHash);
        }
    }, [title, sections, formRules, initialHash]);

    useEffect(() => {
        const handleOutsideClick = (event: PointerEvent) => {
            if (multiActionMenuRef.current && !multiActionMenuRef.current.contains(event.target as Node)) {
                setShowMultiActionMenu(false);
                setShowBackupTools(false);
            }
            if (!isLeftPanelPinned && sectionListRef.current && !sectionListRef.current.contains(event.target as Node)) {
                const trigger = document.getElementById('section-list-trigger');
                const triggerRail = document.getElementById('section-list-trigger-rail');
                const triggerRailWidget = document.getElementById('widget-list-trigger-rail');
                if ((!trigger || !trigger.contains(event.target as Node)) &&
                    (!triggerRail || !triggerRail.contains(event.target as Node)) &&
                    (!triggerRailWidget || !triggerRailWidget.contains(event.target as Node))) {
                    setIsSectionListOpen(false);
                }
            }
            if (swipedFieldId) {
                const swipedCard = document.getElementById(`field-card-${swipedFieldId}`);
                if (swipedCard && !swipedCard.contains(event.target as Node)) {
                    closeVariableSwipe();
                }
            }
            if (isConsoleOpen && consoleWindowRef.current && !consoleWindowRef.current.contains(event.target as Node)) {
                setIsConsoleOpen(false);
            }
        };

        document.addEventListener('pointerdown', handleOutsideClick);
        return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, [swipedFieldId, isLeftPanelPinned, isConsoleOpen]);

    // ─── Left panel resize drag handlers ───
    const defaultWidthForTab = 560;

    useEffect(() => {
        setLeftPanelWidth(defaultWidthForTab);
    }, [activeLeftTab]);

    const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingLeftPanel.current = true;
        leftPanelStartX.current = e.clientX;
        leftPanelStartW.current = leftPanelWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!isResizingLeftPanel.current) return;
            const delta = ev.clientX - leftPanelStartX.current;
            const newW = Math.max(280, Math.min(900, leftPanelStartW.current + delta));
            setLeftPanelWidth(newW);
        };
        const onMouseUp = () => {
            isResizingLeftPanel.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [leftPanelWidth]);

    const onRightResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingRightPanel.current = true;
        rightPanelStartX.current = e.clientX;
        rightPanelStartW.current = rightPanelWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!isResizingRightPanel.current) return;
            const delta = ev.clientX - rightPanelStartX.current;
            const newW = Math.max(280, Math.min(900, rightPanelStartW.current - delta));
            setRightPanelWidth(newW);
        };
        const onMouseUp = () => {
            isResizingRightPanel.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [rightPanelWidth]);

    const enterSection = (sectionId: string) => {
        setSlideDir('forward');
        setCurrentSectionId(sectionId);
        setSelectedFieldId(null);
        setView('section');
        setIsRightSidebarOpen(true);
        setActiveSidebarTab('section');
    };
    const exitSection = () => {
        setSlideDir('back');
        setSelectedFieldId(null);
        setView('flow');
        setIsSectionListOpen(false);
    };

    const centerSectionInFlowCanvas = (sectionId: string) => {
        if (!flowCanvasRef.current) return;
        const sectionIndex = sections.findIndex(s => s.id === sectionId);
        if (sectionIndex === -1) return;

        const section = sections[sectionIndex];
        const layout = ensureSectionLayout(section.layout, sectionIndex);

        const viewportWidth = flowCanvasRef.current.clientWidth;
        const viewportHeight = flowCanvasRef.current.clientHeight;
        const nodeWidth = layout.width || FLOW_NODE_WIDTH;
        const nodeHeight = 240; // Estimated height for section card

        const targetScrollLeft = (layout.x + nodeWidth / 2) * zoom - (viewportWidth / 2);
        const targetScrollTop = (layout.y + nodeHeight / 2) * zoom - (viewportHeight / 2);

        flowCanvasRef.current.scrollTo({
            left: Math.max(0, targetScrollLeft),
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
        });
    };


    const currentSectionIndex = sections.findIndex(p => p.id === currentSectionId) !== -1 ? sections.findIndex(p => p.id === currentSectionId) : 0;
    const fields = sections[currentSectionIndex]?.fields || [];
    const selectedField = sections.flatMap(p => p.fields).find(f => f.id === selectedFieldId) || null;

    const selectedObjectProperties = selectedField?.object_definition?.properties || [];

    useEffect(() => {
        if (!draggingSectionId) {
            return;
        }

        const handlePointerMove = (event: PointerEvent) => {
            const canvasRect = flowCanvasRef.current?.getBoundingClientRect();
            if (!canvasRect) {
                return;
            }
            const nextX = Math.max(24, (event.clientX - canvasRect.left + flowCanvasRef.current!.scrollLeft) / zoom - sectionDragOffset.x);
            const nextY = Math.max(24, (event.clientY - canvasRect.top + flowCanvasRef.current!.scrollTop) / zoom - sectionDragOffset.y);
            setSections((prev) => prev.map((section, index) => (
                section.id === draggingSectionId
                    ? { ...section, layout: { ...ensureSectionLayout(section.layout, index), x: nextX, y: nextY } }
                    : section
            )));
        };

        const handlePointerUp = () => {
            setDraggingSectionId(null);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [draggingSectionId, sectionDragOffset, zoom]);

    const updateSectionLayout = (sectionId: string, patch: Partial<SectionCanvasLayout>) => {
        setSections((prev) => prev.map((section, index) => (
            section.id === sectionId
                ? {
                    ...section,
                    layout: {
                        ...ensureSectionLayout(section.layout, index),
                        ...patch,
                        collapsed: (patch.collapse_mode ?? ensureSectionLayout(section.layout, index).collapse_mode) !== 'full',
                    }
                }
                : section
        )));
    };

    const buildFieldTypeDefaults = (type: FieldType, defaults?: Partial<FormField>): Partial<FormField> => {
        const isChoice = ['dropdown', 'radio_group', 'checkbox_group'].includes(type);
        const defaultOpts: FieldOption[] = isChoice
            ? [{ label: 'Option A', value: 'option_a' }, { label: 'Option B', value: 'option_b' }]
            : [];
        const isMatrix = type === 'matrix_table';
        const defaultColumns: TableColumn[] = isMatrix ? [
            { id: 'col_1', label: 'Strongly Agree' },
            { id: 'col_2', label: 'Agree' },
            { id: 'col_3', label: 'Neutral' },
            { id: 'col_4', label: 'Disagree' },
            { id: 'col_5', label: 'Strongly Disagree' },
        ] : [];
        const defaultRows: TableRow[] = isMatrix ? [
            { id: 'row_1', label: 'Statement 1' },
            { id: 'row_2', label: 'Statement 2' },
            { id: 'row_3', label: 'Statement 3' },
        ] : [];

        return {
            placeholder: ['input_text', 'input_number', 'email_input', 'phone_input', 'textarea'].includes(type) ? 'Enter value...' : undefined,
            platforms: ['mobile', 'web'],
            options: isChoice ? defaultOpts : type === 'toggle'
                ? [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]
                : undefined,
            table_columns: isMatrix ? defaultColumns : undefined,
            table_rows: isMatrix ? defaultRows : undefined,
            table_cell_type: isMatrix ? 'radio' : undefined,
            min_label: type === 'rating_scale' ? 'Very Difficult' : undefined,
            max_label: type === 'rating_scale' ? 'Very Easy' : undefined,
            min: type === 'rating_scale' ? 1 : undefined,
            max: type === 'rating_scale' ? 5 : undefined,
            lookup_source_type: type === 'lookup_list' ? 'preset' : undefined,
            allow_add_items: type === 'object_collection' ? true : undefined,
            allow_remove_items: type === 'object_collection' ? true : undefined,
            collection_layout: type === 'object_collection' ? 'cards' : undefined,
            ...defaults,
        };
    };

    const addFieldToSection = (sectionId: string, type: FieldType, defaults?: Partial<FormField>, insertAtTop?: boolean) => {
        trackUsedField(type);
        const newField: FormField = {
            id: `field_${Date.now()}`,
            type,
            label: type === 'matrix_table' ? 'New Table / Matrix' : `New ${type.replace(/_/g, ' ')}`,
            required: false,
            ...buildFieldTypeDefaults(type, defaults),
        };
        setSections(prev => prev.map(p => p.id === sectionId ? { ...p, fields: insertAtTop ? [newField, ...p.fields] : [...p.fields, newField] } : p));
        setCurrentSectionId(sectionId);
        setSelectedFieldId(newField.id);
        return newField;
    };

    const reorderFieldsInSection = (sectionId: string, fromFieldId: string, toFieldId: string) => {
        setSections((prev) => prev.map((section) => {
            if (section.id !== sectionId) return section;
            const nextFields = [...section.fields];
            const fromIndex = nextFields.findIndex((field) => field.id === fromFieldId);
            const toIndex = nextFields.findIndex((field) => field.id === toFieldId);
            if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
                return section;
            }
            const [moved] = nextFields.splice(fromIndex, 1);
            nextFields.splice(toIndex, 0, moved);
            return { ...section, fields: nextFields };
        }));
    };

    const getVisibleFieldsForCard = (section: FormSection, layout: SectionCanvasLayout) => {
        const collapseMode = layout.collapse_mode || 'full';
        if (collapseMode === 'title') {
            return [];
        }
        if (collapseMode === 'quarter') {
            return section.fields.slice(0, Math.max(1, Math.ceil(section.fields.length / 4)));
        }
        if (collapseMode === 'summary') {
            return section.fields.slice(0, Math.max(1, Math.ceil(section.fields.length / 2)));
        }
        return section.fields;
    };

    const handleVariableSwipeStart = (event: React.PointerEvent<HTMLDivElement>, fieldId: string) => {
        if ((event.target as HTMLElement).closest('button') || (event.target as HTMLElement).closest('[data-drag-handle="true"]')) {
            return;
        }
        swipeStateRef.current = {
            fieldId,
            startX: event.clientX,
            startY: event.clientY,
            offset: swipedFieldId === fieldId ? -VARIABLE_DELETE_REVEAL_WIDTH : 0,
            swiping: false,
        };
        (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
    };

    const handleVariableSwipeMove = (event: React.PointerEvent<HTMLDivElement>, fieldId: string) => {
        const swipe = swipeStateRef.current;
        if (swipe.fieldId !== fieldId) {
            return;
        }

        const deltaX = event.clientX - swipe.startX;
        const deltaY = event.clientY - swipe.startY;

        if (!swipe.swiping) {
            if (Math.abs(deltaY) > Math.abs(deltaX)) {
                return;
            }
            if (Math.abs(deltaX) < 10) {
                return;
            }
            swipe.swiping = true;
        }

        event.preventDefault();
        event.stopPropagation();
        const nextOffset = Math.max(-VARIABLE_DELETE_REVEAL_WIDTH, Math.min(0, swipe.offset + deltaX));
        setSwipedFieldId(fieldId);
        setSwipeOffset(nextOffset);
    };

    const handleVariableSwipeEnd = (event: React.PointerEvent<HTMLDivElement>, fieldId: string) => {
        const swipe = swipeStateRef.current;
        if (swipe.fieldId !== fieldId) {
            return;
        }

        if ((event.currentTarget as HTMLDivElement).hasPointerCapture(event.pointerId)) {
            (event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
        }

        const deltaX = event.clientX - swipe.startX;
        const finalOffset = swipe.swiping ? Math.max(-VARIABLE_DELETE_REVEAL_WIDTH, Math.min(0, swipe.offset + deltaX)) : swipeOffset;
        const shouldReveal = swipe.swiping && finalOffset <= -(VARIABLE_DELETE_REVEAL_WIDTH / 2);

        setSwipedFieldId(shouldReveal ? fieldId : null);
        setSwipeOffset(shouldReveal ? -VARIABLE_DELETE_REVEAL_WIDTH : 0);

        // Delay resetting the swiping flag so that the follow-up browser click event knows it was swiping
        setTimeout(() => {
            swipeStateRef.current = { fieldId: null, startX: 0, startY: 0, offset: 0, swiping: false };
        }, 0);
    };

    const closeVariableSwipe = () => {
        setSwipedFieldId(null);
        setSwipeOffset(0);
        swipeStateRef.current = { fieldId: null, startX: 0, startY: 0, offset: 0, swiping: false };
    };

    const getFlowConnections = () => {
        const sectionById = new Map(sections.map((section, index) => [section.id, { ...section, layout: ensureSectionLayout(section.layout, index) }]));
        const links: Array<{ id: string; sourceId: string; targetId: string; label: string; tone: 'option' | 'logic' }> = [];

        sections.forEach((section) => {
            section.fields.forEach((field) => {
                (field.options || []).forEach((option) => {
                    if (!option.skip_to || !sectionById.has(option.skip_to)) {
                        return;
                    }
                    links.push({
                        id: `option-${field.id}-${option.value}-${option.skip_to}`,
                        sourceId: section.id,
                        targetId: option.skip_to,
                        label: `${field.label}: ${option.label}`,
                        tone: 'option',
                    });
                });
            });
        });

        formRules.forEach((rule) => {
            const triggerId = rule.trigger_id;
            if (!triggerId || !rule.enabled) {
                return;
            }
            rule.actions.forEach((action) => {
                if (action.effect === 'JUMP_TO_SECTION' && action.target_id && sectionById.has(action.target_id)) {
                    const sourceId = rule.trigger_type === 'section' && sectionById.has(triggerId)
                        ? triggerId
                        : sections.find((section) => section.fields.some((field) => field.id === triggerId))?.id;
                    if (!sourceId || !sectionById.has(sourceId)) {
                        return;
                    }
                    links.push({
                        id: `logic-${rule.id}-${action.target_id}`,
                        sourceId,
                        targetId: action.target_id,
                        label: 'Jump',
                        tone: 'logic',
                    });
                }
            });
        });

        return links;
    };

    const buildCatalogSourceItems = (items: ProjectCatalogItem[]): CatalogSourceItem[] => (
        items
            .filter((item) => item.is_active !== false)
            .map((item) => ({
                id: item.id,
                sku_code: item.sku_code,
                label: item.label,
                default_price: item.default_price,
                unit: item.unit,
                brand: item.brand,
                price_editable: item.price_editable,
                is_active: item.is_active,
            }))
    );

    const createObjectDefinition = (field: FormField, properties?: ObjectPropertyDefinition[]): FormObjectDefinition => ({
        id: field.object_schema_key || field.id,
        name: field.object_schema_key || field.id,
        label: field.label,
        properties: properties || field.object_definition?.properties || [],
        allow_manual_add: field.allow_add_items ?? true,
        allow_manual_remove: field.allow_remove_items ?? true,
    });



    const hydrateCatalogReferences = (definition: FormObjectDefinition | undefined, field: FormField): FormObjectDefinition | undefined => {
        if (!definition) {
            return undefined;
        }

        const catalogSourceItems = buildCatalogSourceItems(catalogItems);
        const nextProperties = (definition.properties || []).map((property) => {
            if (property.reference?.source_type !== 'catalog') {
                return property;
            }

            return {
                ...property,
                reference: {
                    ...property.reference,
                    source_id: property.reference.source_id || 'project_catalog',
                    label_field: property.reference.label_field || 'label',
                    value_field: property.reference.value_field || 'id',
                    source_items: catalogSourceItems,
                },
            };
        });

        return {
            ...createObjectDefinition(field, nextProperties),
            ...definition,
            properties: nextProperties,
            allow_manual_add: field.allow_add_items ?? definition.allow_manual_add,
            allow_manual_remove: field.allow_remove_items ?? definition.allow_manual_remove,
        };
    };

    const updateObjectDefinition = (fieldId: string, updater: (definition: FormObjectDefinition) => FormObjectDefinition) => {
        const field = sections.flatMap((section) => section.fields).find((entry) => entry.id === fieldId);
        if (!field) {
            return;
        }

        const baseDefinition = createObjectDefinition(field);
        updateField(fieldId, { object_definition: updater(baseDefinition) });
    };

    const updateSelectedObjectProperty = (index: number, patch: Partial<ObjectPropertyDefinition>) => {
        if (!selectedField) {
            return;
        }

        updateObjectDefinition(selectedField.id, (definition) => ({
            ...definition,
            properties: definition.properties.map((property, propertyIndex) => {
                if (propertyIndex !== index) {
                    return property;
                }
                const nextProperty = { ...property, ...patch };
                if (nextProperty.type !== 'computed') {
                    delete nextProperty.formula;
                }
                if (nextProperty.type !== 'select') {
                    delete nextProperty.options;
                }
                return nextProperty;
            }),
        }));
    };

    const addSelectedObjectProperty = () => {
        if (!selectedField) {
            return;
        }

        updateObjectDefinition(selectedField.id, (definition) => ({
            ...definition,
            properties: [
                ...definition.properties,
                {
                    key: `property_${definition.properties.length + 1}`,
                    type: 'string',
                    label: `Property ${definition.properties.length + 1}`,
                    edit_mode: 'editable',
                },
            ],
        }));
    };

    const removeSelectedObjectProperty = (index: number) => {
        if (!selectedField) {
            return;
        }

        updateObjectDefinition(selectedField.id, (definition) => ({
            ...definition,
            properties: definition.properties.filter((_, propertyIndex) => propertyIndex !== index),
        }));
    };



    useEffect(() => {
        const loadCatalogItems = async () => {
            if (!currentOrg?.id || !formMeta?.project_id) {
                setCatalogItems([]);
                return;
            }

            try {
                const items = await projectAPI.listCatalogItems(currentOrg.id, formMeta.project_id);
                setCatalogItems(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error('Failed to load project catalog items', error);
                setCatalogItems([]);
            }
        };

        loadCatalogItems();
    }, [currentOrg?.id, formMeta?.project_id]);

    const getSlotVersion = (slot: 1 | 2 | 3) => activeVersions.find(v => v.kind === 'draft' && v.slot_index === slot);

    const applyBlueprintToBuilder = (blueprint: any, fallbackTitle?: string) => {
        if (!blueprint?.ui?.length) return;

        const normaliseOptions = (raw: any[]): FieldOption[] =>
            raw.map(o => typeof o === 'string'
                ? { label: o, value: toSmartValue(o) }
                : { label: o.label ?? o, value: o.value ?? toSmartValue(o.label ?? o), skip_to: o.skip_to }
            );

        const loadedSections: FormSection[] = blueprint.ui.map((screen: any, idx: number) => ({
            id: screen.id || `screen_${idx + 1}`,
            title: screen.title || `Section ${idx + 1}`,
            layout: ensureSectionLayout(screen.layout, idx),
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
                formula: child.formula,
                placeholder: child.placeholder,
                options: Array.isArray(child.options) ? normaliseOptions(child.options) : undefined,
                platforms: child.platforms,
                min: child.min,
                max: child.max,
                minLength: child.minLength,
                maxLength: child.maxLength,
                default_value: child.default_value,
                is_sensitive: !!child.is_sensitive,
                exclude_from_export: !!child.exclude_from_export,
                table_columns: child.table_columns,
                table_rows: child.table_rows,
                table_cell_type: child.table_cell_type,
                table_allow_multiple: !!child.table_allow_multiple,
                mask: child.mask,
                lookup_source_type: child.lookup_source_type,
                lookup_preset_id: child.lookup_preset_id,
                lookup_custom_data: child.lookup_custom_data,
                lookup_separator: child.lookup_separator,
                lookup_label_column: child.lookup_label_column,
                lookup_value_column: child.lookup_value_column,
                min_label: child.min_label,
                max_label: child.max_label,
                object_schema_key: child.object_schema_key,
                object_definition: child.object_definition,
                collection_layout: child.collection_layout,
                allow_add_items: child.allow_add_items,
                allow_remove_items: child.allow_remove_items,
                catalog_source_type: child.catalog_source_type,
                catalog_prepopulate_mode: child.catalog_prepopulate_mode,
                required_catalog_item_ids: child.required_catalog_item_ids || [],
                // Form link
                linked_form_id: child.linked_form_id,
                linked_form_slug: child.linked_form_slug,
                linked_form_param_map: child.linked_form_param_map,
                // Input param annotations
                is_input_param: child.is_input_param,
                input_param_readonly: child.input_param_readonly,
                // Generic Range properties
                range_type: child.range_type,
                step_value: child.step_value,
                step_unit: child.step_unit,
                is_inclusive: child.is_inclusive,
                has_no_min: child.has_no_min,
                has_no_max: child.has_no_max,
            })) : []
        }));

        setSections(loadedSections);
        setCurrentSectionId(loadedSections[0].id);
        const loadedRules = blueprint.rules || [];
        setFormRules(loadedRules);
        setTitle(blueprint?.meta?.title || fallbackTitle || title);
        setInitialHash(computeHash(blueprint?.meta?.title || fallbackTitle || title, loadedSections, loadedRules));
        setHasUnsavedChanges(false);
    };


    const getWidget = (type: FieldType) => widgetLibrary.find((w) => w.type === type);

    useEffect(() => {
        const loadForm = async () => {
            if (!formId) return;
            try {
                const [data, versions] = await Promise.all([
                    formAPI.get(formId),
                    formAPI.listVersions(formId),
                ]);
                setFormMeta({
                    id: data.id,
                    project_id: data.project_id,
                    slug: data.slug,
                    version: data.version,
                    is_public: data.is_public,
                    status: data.status,
                    published_version: data.published_version,
                    kind: data.kind,
                    catalog_key_field_id: data.catalog_key_field_id,
                    catalog_label_field_id: data.catalog_label_field_id,
                });
                setActiveVersions(Array.isArray(versions) ? versions : []);
                setTitle(data.title || 'Untitled Form');

                // Load sibling forms in same project for form-link picker
                if (data.project_id) {
                    formAPI.list(data.project_id)
                        .then((forms: any[]) => {
                            setProjectForms(
                                (Array.isArray(forms) ? forms : [])
                                    .filter((f: any) => f.id !== data.id) // exclude current form
                                    .map((f: any) => ({ id: f.id, title: f.title, slug: f.slug }))
                            );
                        })
                        .catch(() => { /* non-critical */ });
                }

                const blueprint = data.blueprint_draft || data.blueprint_live;
                if (blueprint?.ui?.length) {
                    applyBlueprintToBuilder(blueprint, data.title || 'Untitled Form');
                } else {
                    const defaultSecs: FormSection[] = [{ id: 'screen_1', title: 'Section 1', fields: [], properties: { render_mode: 'list', platforms: ['mobile', 'web'] }, layout: ensureSectionLayout(undefined, 0) }];
                    setSections(defaultSecs);
                    setCurrentSectionId('screen_1');
                    setFormRules([]);
                    setInitialHash(computeHash('Untitled Form', defaultSecs, []));
                }
            } catch (err) {
                console.error('Failed to load form', err);
            }
        };

        loadForm();
    }, [formId]);

    useEffect(() => {
        if (!currentOrg?.id) return;
        const loadTemplates = async () => {
            try {
                const data = await sectionTemplateAPI.list(currentOrg.id);
                setTemplates(data);
            } catch (err) {
                console.error('Failed to load templates', err);
            }
        };
        loadTemplates();
    }, [currentOrg?.id]);

    const addField = (type: FieldType, defaults?: Partial<FormField>, insertAtTop?: boolean) => {
        addFieldToSection(currentSectionId, type, defaults, insertAtTop);
    };

    const handleOpenQuickAdd = (index: number) => {
        setQuickAddIndex(index);
        setQuickAddSearchQuery('');
        setQuickAddKeyboardIndex(0);
        setQuickAddOpen(true);
    };

    const handleAddField = (widgetType: FieldType, widgetLabel: string) => {
        trackUsedField(widgetType);
        const uniqueId = `field_${Date.now()}`;
        const sysId = `FIELD_${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;

        const defaults = buildFieldTypeDefaults(widgetType);
        const newField: FormField = {
            id: uniqueId,
            sysId: sysId,
            type: widgetType,
            label: widgetLabel,
            required: false,
            placeholder: defaults.placeholder || `Enter ${widgetLabel.toLowerCase()}...`,
            ...defaults,
        };

        setSections(prev => prev.map(section => {
            if (section.id !== currentSectionId) return section;
            const fields = [...section.fields];
            if (quickAddIndex === null) {
                fields.push(newField);
            } else {
                fields.splice(quickAddIndex, 0, newField);
            }
            return { ...section, fields };
        }));

        setSelectedFieldId(uniqueId);
        setQuickAddOpen(false);
        setQuickAddSearchQuery('');

        // Apply focus to Properties Panel Label Input
        setTimeout(() => {
            const input = document.getElementById('field-label-input') as HTMLInputElement | null;
            if (input) {
                input.focus();
                input.select();
            }
        }, 120);
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
        setSections(prev => [...prev, { id: newId, title: `Section ${prev.length + 1}`, fields: [], properties: defaultSectionProperties(), layout: ensureSectionLayout(undefined, prev.length) }]);
        setCurrentSectionId(newId);
    };

    const updateCurrentSectionProperties = (patch: Partial<SectionProperties>) => {
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, properties: { ...p.properties, ...patch } } : p));
    };


    const updateCurrentSectionTitle = (title: string) => {
        setSections(prev => prev.map(p => p.id === currentSectionId ? { ...p, title } : p));
    };




    const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [templateVis, setTemplateVis] = useState<'organization' | 'team'>('organization');

    const handleSaveTemplate = async () => {
        if (!currentOrg?.id) return;
        const currentSec = sections.find(s => s.id === currentSectionId);
        if (!currentSec) return;
        try {
            const blueprint = {
                title: currentSec.title,
                properties: currentSec.properties,
                fields: currentSec.fields
            };
            const res = await sectionTemplateAPI.create(currentOrg.id, {
                name: templateName || currentSec.title,
                description: templateDesc,
                visibility: templateVis,
                blueprint
            });
            setTemplates(prev => [...prev, res]);
            setIsSaveTemplateModalOpen(false);
            setTemplateName('');
            setTemplateDesc('');
            setTemplateVis('organization');
            showToast('Template saved', 'Section successfully saved as template', 'success');

            // Link current section to new template
            setSections(prev => prev.map(s => s.id === currentSectionId ? { ...s, template_id: res.id } : s));
        } catch (err) {
            console.error(err);
            showToast('Failed to save', 'Could not save section template', 'error');
        }
    };

    const updateExistingTemplate = async () => {
        if (!currentOrg?.id) return;
        const currentSec = sections.find(s => s.id === currentSectionId);
        if (!currentSec || !currentSec.template_id) return;
        try {
            const blueprint = {
                title: currentSec.title,
                properties: currentSec.properties,
                fields: currentSec.fields
            };
            await sectionTemplateAPI.update(currentOrg.id, currentSec.template_id, {
                blueprint
            });
            showToast('Template updated', 'Linked template has been updated', 'success');
        } catch (err) {
            showToast('Failed to update template', 'Could not update linked template', 'error');
        }
    };

    const mapSchemaType = (type: FieldType) => {
        if (type === 'input_number') return 'integer';
        if (type === 'toggle') return 'boolean';
        if (type === 'date_picker') return 'date';
        if (type === 'time_picker') return 'time';
        if (type === 'gps_capture') return 'geojson';
        if (type === 'checkbox_group') return 'array';
        if (type === 'matrix_table') return 'object';
        if (type === 'object_collection') return 'array';
        if (type === 'object_instance') return 'object';
        if (type === 'generic_range') return 'object';
        return 'string';
    };

    const buildSchemaEntry = (field: FormField) => {
        const entry: Record<string, any> = {
            key: field.id,
            type: field.formula ? 'computed' : mapSchemaType(field.type),
            required: field.required,
        };

        if (field.formula) {
            entry.formula = field.formula;
        }

        if (field.type === 'checkbox_group') {
            entry.items = { type: 'string' };
        }
        if (field.type === 'matrix_table') {
            entry.columns = field.table_columns;
            entry.rows = field.table_rows;
            entry.cell_type = field.table_cell_type;
        }
        if (['object_collection', 'object_instance'].includes(field.type)) {
            entry.object_schema_key = field.object_schema_key;
            entry.item_definition = hydrateCatalogReferences(field.object_definition, field);
            entry.catalog_source_type = field.catalog_source_type;
        }
        if (field.type === 'generic_range') {
            entry.range_type = field.range_type;
            entry.step_value = field.step_value;
            entry.step_unit = field.step_unit;
            entry.is_inclusive = field.is_inclusive;
            entry.has_no_min = field.has_no_min;
            entry.has_no_max = field.has_no_max;
        }

        return entry;
    };

    const serializeUiField = (field: FormField) => ({
        type: field.type,
        bind: field.id,
        label: field.label,
        required: field.required,
        formula: field.formula,
        placeholder: field.placeholder,
        options: field.options,
        platforms: field.platforms,
        min: field.min,
        max: field.max,
        minLength: field.minLength,
        maxLength: field.maxLength,
        default_value: field.default_value,
        is_sensitive: field.is_sensitive,
        exclude_from_export: field.exclude_from_export,
        table_columns: field.table_columns,
        table_rows: field.table_rows,
        table_cell_type: field.table_cell_type,
        table_allow_multiple: field.table_allow_multiple,
        mask: field.mask,
        lookup_source_type: field.lookup_source_type,
        lookup_preset_id: field.lookup_preset_id,
        lookup_custom_data: field.lookup_custom_data,
        lookup_separator: field.lookup_separator,
        lookup_label_column: field.lookup_label_column,
        lookup_value_column: field.lookup_value_column,
        min_label: field.min_label,
        max_label: field.max_label,
        object_schema_key: field.object_schema_key,
        object_definition: hydrateCatalogReferences(field.object_definition, field),
        collection_layout: field.collection_layout,
        allow_add_items: field.allow_add_items,
        allow_remove_items: field.allow_remove_items,
        catalog_source_type: field.catalog_source_type,
        catalog_prepopulate_mode: field.catalog_prepopulate_mode,
        required_catalog_item_ids: field.required_catalog_item_ids,
        // Form link
        linked_form_id: field.linked_form_id,
        linked_form_slug: field.linked_form_slug,
        linked_form_param_map: field.linked_form_param_map,
        // Input param annotations
        is_input_param: field.is_input_param,
        input_param_readonly: field.input_param_readonly,
        // Generic Range properties
        range_type: field.range_type,
        step_value: field.step_value,
        step_unit: field.step_unit,
        is_inclusive: field.is_inclusive,
        has_no_min: field.has_no_min,
        has_no_max: field.has_no_max,
    });

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
                    visibility: formVisibility,
                    theme: {
                        primary_color: primaryColor,
                        mode: themeMode
                    }
                },
                schema: sections.flatMap(p => p.fields).map((f) => buildSchemaEntry(f)),
                ui: sections.map((p) => ({
                    id: p.id,
                    type: 'screen',
                    title: p.title,
                    layout: p.layout,
                    template_id: p.template_id,
                    render_mode: p.properties.render_mode,
                    description: p.properties.description,
                    platforms: p.properties.platforms,
                    is_repeatable: p.properties.is_repeatable,
                                    max_repeats: p.properties.max_repeats,
                    shuffle_options: p.properties.shuffle_options,
                    children: p.fields.map(f => serializeUiField(f))
                })),
                logic: [],
                rules: formRules,
                linked_form_ids: sections.flatMap(s => s.fields)
                    .filter(f => f.type === 'form_link' && f.linked_form_id)
                    .map(f => f.linked_form_id!)
                    .filter((id, idx, arr) => arr.indexOf(id) === idx),
            };
            // Working draft is always slot 1.
            await formAPI.updateBlueprint(formId, blueprint, 1);

            const versions = await formAPI.listVersions(formId);
            setActiveVersions(Array.isArray(versions) ? versions : []);

            const newHash = computeHash(title, sections, formRules);
            setInitialHash(newHash);
            setHasUnsavedChanges(false);

            showToast('Successfully saved!', 'Anyone with a link can now view this file.', 'success');
        } catch (err) {
            console.error('Save failed', err);
            showToast('Save failed', 'There was an error saving your form.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleShellNavSelect = (key: 'projects' | 'tasks' | 'forms' | 'datasets' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings') => {
        navigate(`/dashboard?tab=${key}`);
    };

    // @ts-ignore — Will be wired to console actions
    const _handlePublish = async () => {
        if (!formId || isPublishing) return;
        setIsPublishing(true);

        if (formMeta?.kind === 'catalog') {
            if (!formMeta.catalog_key_field_id) {
                showToast('Publish failed', 'Catalog forms require a Key Field designation before publishing.', 'error');
                setIsPublishing(false);
                return;
            }
            if (!formMeta.catalog_label_field_id) {
                showToast('Publish failed', 'Catalog forms require a Label Field designation before publishing.', 'error');
                setIsPublishing(false);
                return;
            }
        }

        try {
            if (hasUnsavedChanges) {
                await handleSave();
            }

            // Publish always promotes the working draft (slot 1).
            const data = await formAPI.publish(formId, { draft_slot: 1 });
            setFormMeta((prev) => prev ? {
                ...prev,
                version: data.version ?? prev.version,
                status: data.status ?? prev.status,
                published_version: data.published_version ?? data.version ?? prev.published_version,
            } : prev);

            const versions = await formAPI.listVersions(formId);
            setActiveVersions(Array.isArray(versions) ? versions : []);

            showToast('Published', `Live version ${data.published_version ?? data.version ?? ''} is now deployed.`, 'success');
        } catch (err) {
            console.error('Publish failed', err);
            showToast('Publish failed', 'Could not publish this form.', 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    // @ts-ignore — Will be wired to console actions
    const _handleSaveToBackup = async (slot: 2 | 3) => {
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
                    visibility: formVisibility,
                    theme: {
                        primary_color: primaryColor,
                        mode: themeMode
                    }
                },
                schema: sections.flatMap(p => p.fields).map((f) => buildSchemaEntry(f)),
                ui: sections.map((p) => ({
                    id: p.id,
                    type: 'screen',
                    title: p.title,
                    template_id: p.template_id,
                    render_mode: p.properties.render_mode,
                    description: p.properties.description,
                    platforms: p.properties.platforms,
                    is_repeatable: p.properties.is_repeatable,
                                        max_repeats: p.properties.max_repeats,
                    shuffle_options: p.properties.shuffle_options,
                    children: p.fields.map(f => serializeUiField(f))
                })),
                logic: [],
                rules: formRules,
                linked_form_ids: sections.flatMap(s => s.fields)
                    .filter(f => f.type === 'form_link' && f.linked_form_id)
                    .map(f => f.linked_form_id!)
                    .filter((id, idx, arr) => arr.indexOf(id) === idx),
            };

            await formAPI.updateBlueprint(formId, blueprint, slot);
            const versions = await formAPI.listVersions(formId);
            setActiveVersions(Array.isArray(versions) ? versions : []);
            showToast('Backup saved', `Stored current state in backup ${slot === 2 ? 'A' : 'B'}.`, 'success');
        } catch (err) {
            console.error('Backup save failed', err);
            showToast('Backup failed', 'Could not save backup slot.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // @ts-ignore — Will be wired to console actions
    const _handleRestoreBackupToDraft = async (slot: 2 | 3) => {
        if (!formId) return;
        const backup = getSlotVersion(slot);
        if (!backup?.blueprint) {
            showToast('Backup empty', `Backup ${slot === 2 ? 'A' : 'B'} has no saved state yet.`, 'error');
            return;
        }

        setIsSaving(true);
        try {
            await formAPI.updateBlueprint(formId, backup.blueprint, 1);
            const refreshedForm = await formAPI.get(formId);
            const versions = await formAPI.listVersions(formId);
            setActiveVersions(Array.isArray(versions) ? versions : []);

            const workingBlueprint = refreshedForm.blueprint_draft || backup.blueprint;
            applyBlueprintToBuilder(workingBlueprint, refreshedForm.title || title);
            showToast('Draft restored', `Backup ${slot === 2 ? 'A' : 'B'} copied into working draft.`, 'success');
        } catch (err) {
            console.error('Backup restore failed', err);
            showToast('Restore failed', 'Could not restore backup to draft.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const getTypeIconStyle = (type: FieldType) => {
        switch (type) {
            // Standard Inputs (Blue/Sky/Indigo/Violet/Cyan shades)
            case 'input_text':
                return 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30';
            case 'input_number':
                return 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30';
            case 'email_input':
                return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30';
            case 'phone_input':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30';
            case 'textarea':
                return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/30';

            // Time & Date (Purple/Violet/Fuchsia/Pink shades)
            case 'date_picker':
                return 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30';
            case 'time_picker':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30';
            case 'time_range':
                return 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 border border-fuchsia-100 dark:border-fuchsia-900/30';
            case 'generic_range':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30';

            // Selection Fields (Emerald/Green/Teal/Cyan/Lime shades)
            case 'dropdown':
                return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30';
            case 'radio_group':
                return 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 border border-green-100 dark:border-green-900/30';
            case 'checkbox_group':
                return 'bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400 border border-teal-100 dark:border-teal-900/30';
            case 'multi_select_dropdown':
                return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/30';
            case 'toggle':
                return 'bg-lime-50 text-lime-600 dark:bg-lime-950/30 dark:text-lime-400 border border-lime-100 dark:border-lime-900/30';

            // Device Metrics (Amber/Orange/Yellow shades)
            case 'gps_capture':
                return 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30';
            case 'barcode_scanner':
                return 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-100 dark:border-orange-900/30';

            // Media Input (Pink/Rose/Red shades)
            case 'photo_capture':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30';
            case 'file_upload':
                return 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30';
            case 'audio_recorder':
                return 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-100 dark:border-red-900/30';

            // Advanced Inputs (Violet/Purple/Fuchsia/Pink/Indigo/Blue shades)
            case 'signature_pad':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400 border border-violet-100 dark:border-violet-900/30';
            case 'matrix_table':
                return 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30';
            case 'lookup_list':
                return 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 border border-fuchsia-100 dark:border-fuchsia-900/30';
            case 'rating_scale':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-100 dark:border-pink-900/30';
            case 'object_collection':
                return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30';
            case 'object_instance':
                return 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30';

            // Navigation (Sky shades)
            case 'form_link':
                return 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-100 dark:border-sky-900/30';

            default:
                return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30';
        }
    };

    const getSolidTypeIconStyle = (type: FieldType) => {
        switch (type) {
            // Standard Inputs (Blue/Sky/Indigo/Violet/Cyan shades)
            case 'input_text':
                return 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900';
            case 'input_number':
                return 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900';
            case 'email_input':
                return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900';
            case 'phone_input':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-900';
            case 'textarea':
                return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900';

            // Time & Date (Purple/Violet/Fuchsia/Pink shades)
            case 'date_picker':
                return 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-900';
            case 'time_picker':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-900';
            case 'time_range':
                return 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-900';
            case 'generic_range':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300 border border-pink-200 dark:border-pink-900';

            // Selection Fields (Emerald/Green/Teal/Cyan/Lime shades)
            case 'dropdown':
                return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900';
            case 'radio_group':
                return 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300 border border-green-200 dark:border-green-900';
            case 'checkbox_group':
                return 'bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-900';
            case 'multi_select_dropdown':
                return 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900';
            case 'toggle':
                return 'bg-lime-50 text-lime-600 dark:bg-lime-950 dark:text-lime-300 border border-lime-200 dark:border-lime-900';

            // Device Metrics (Amber/Orange/Yellow shades)
            case 'gps_capture':
                return 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-900';
            case 'barcode_scanner':
                return 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-900';

            // Media Input (Pink/Rose/Red shades)
            case 'photo_capture':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300 border border-pink-200 dark:border-pink-900';
            case 'file_upload':
                return 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900';
            case 'audio_recorder':
                return 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300 border border-red-200 dark:border-red-900';

            // Advanced Inputs (Violet/Purple/Fuchsia/Pink/Indigo/Blue shades)
            case 'signature_pad':
                return 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-300 border border-violet-200 dark:border-violet-900';
            case 'matrix_table':
                return 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-900';
            case 'lookup_list':
                return 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-900';
            case 'rating_scale':
                return 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-300 border border-pink-200 dark:border-pink-900';
            case 'object_collection':
                return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900';
            case 'object_instance':
                return 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-900';

            // Navigation (Sky shades)
            case 'form_link':
                return 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300 border border-sky-200 dark:border-sky-900';

            default:
                return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900';
        }
    };

    const renderWidgetPreview = (field: FormField) => {
        const borderStyle = "border-[hsl(var(--border))]/80";
        const surfaceColor = "bg-[hsl(var(--surface))]";

        switch(field.type) {
            case 'input_text':
            case 'email_input':
            case 'phone_input':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        {field.placeholder || `${field.type.replace(/input_|_input/g, '')} input preview`}
                    </div>
                );
            case 'input_number':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        number input preview {field.default_value && `(default: ${field.default_value})`}
                    </div>
                );
            case 'date_picker':
            case 'time_picker':
            case 'time_range':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none font-sans">
                        {field.type.replace(/_/g, ' ')} preview
                    </div>
                );
            case 'dropdown':
            case 'radio_group':
            case 'checkbox_group':
            case 'multi_select_dropdown':
                return (
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-tertiary))] select-none overflow-hidden max-w-xl">
                        <span className="font-semibold uppercase tracking-wider text-[9px] text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))]/65 px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/30 shrink-0">
                            Options
                        </span>
                        <span className="truncate italic">
                            {(field.options || []).map(o => o.label).join(' • ') || 'No options configured'}
                        </span>
                    </div>
                );
            case 'textarea':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        {field.placeholder || "textarea input preview"}
                    </div>
                );
            case 'gps_capture':
                return (
                    <div className="flex items-center gap-2 select-none w-full">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>GPS Location Lock</span>
                        </span>
                        <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))] truncate">
                            [5.6037° N, 0.1870° W]
                        </span>
                    </div>
                );
            case 'photo_capture':
                return (
                    <div className="flex items-center gap-3 select-none w-full">
                        <div className="w-12 h-8 rounded-lg bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))]/40 flex items-center justify-center text-[hsl(var(--text-tertiary))] shrink-0 overflow-hidden relative">
                            <Camera className="w-4 h-4 opacity-50" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--primary))]/5 to-transparent pointer-events-none" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] block leading-tight">Camera Placeholder</span>
                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] block leading-none">Click to snap photo</span>
                        </div>
                    </div>
                );
            case 'file_upload':
                return (
                    <div className={`border border-dashed border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))]/40 px-3 py-1.5 rounded-xl flex items-center gap-2.5 text-[hsl(var(--text-tertiary))] select-none`}>
                        <FileText className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] block leading-none">Drag &amp; drop files here</span>
                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] block mt-0.5 leading-none">PDF, PNG, JPG up to 10MB</span>
                        </div>
                    </div>
                );
            case 'signature_pad':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        signature trace preview
                    </div>
                );
            case 'barcode_scanner':
                return (
                    <div className={`flex items-center gap-2.5 ${surfaceColor} px-3 py-1.5 rounded-lg border ${borderStyle} relative overflow-hidden select-none`}>
                        <div className="w-1 h-full bg-rose-500 absolute left-0 top-0 animate-pulse" />
                        <Barcode className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
                        <span className="text-[10px] text-[hsl(var(--text-secondary))] font-mono">Initializing scanner lens feed...</span>
                    </div>
                );
            case 'audio_recorder':
                return (
                    <div className="flex items-center gap-2.5 w-full">
                        <button className="bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 rounded-full w-8 h-8 flex items-center justify-center text-sm border border-rose-500/20 outline-none shrink-0" disabled>
                            <Mic className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                        <div className="flex-1 h-3.5 bg-[hsl(var(--surface-elevated))] rounded-full overflow-hidden flex items-center gap-0.5 px-2">
                            <span className="h-1.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-2.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-1 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-3 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-0.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-2 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded animate-pulse"></span>
                            <span className="h-1.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded animate-pulse delay-75"></span>
                            <span className="h-2.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded animate-pulse delay-100"></span>
                            <span className="h-1 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                        </div>
                        <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))] select-none shrink-0">0:00</span>
                    </div>
                );
            case 'lookup_list':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        {field.placeholder || "lookup search preview"}
                    </div>
                );
            case 'object_collection':
                return (
                    <div className={`border border-dashed border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))]/40 px-3 py-1.5 rounded-xl flex items-center gap-2.5 text-[hsl(var(--text-tertiary))] select-none`}>
                        <Layers className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] block leading-none">Object Collection Area</span>
                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] block mt-0.5 leading-none truncate">Type: <strong className="text-[hsl(var(--primary))] font-mono">{field.object_schema_key || 'Unnamed Object'}</strong></span>
                        </div>
                    </div>
                );
            case 'object_instance':
                return (
                    <div className={`border border-[hsl(var(--border))]/85 bg-[hsl(var(--surface))] p-2.5 rounded-xl flex items-center justify-between text-[hsl(var(--text-secondary))] select-none`}>
                        <div className="flex items-center gap-2 min-w-0">
                            <Database className="w-4 h-4 text-[hsl(var(--primary))] shrink-0" />
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-[hsl(var(--text-primary))] truncate">{field.object_schema_key || 'Object Reference'}</p>
                            </div>
                        </div>
                        <span className="text-[9px] bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/30 text-[hsl(var(--text-secondary))] font-mono shrink-0">Catalog Source</span>
                    </div>
                );
            case 'toggle':
                return (
                    <div className="flex items-center gap-3 select-none">
                        <div className="w-8 h-4.5 bg-[hsl(var(--primary))] rounded-full p-0.5 flex items-center justify-end select-none shrink-0">
                            <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                        </div>
                        <span className="text-xs text-[hsl(var(--text-secondary))] font-medium">
                            {field.options?.find(o => o.value === 'true')?.label ?? 'Yes'}
                        </span>
                    </div>
                );
            case 'generic_range':
                return (
                    <div className="text-xs text-[hsl(var(--text-tertiary))] italic select-none">
                        {field.range_type || 'NUMBER'} range preview {(!field.has_no_min || !field.has_no_max) && `(${field.has_no_min ? '-∞' : 'Min'} to ${field.has_no_max ? '+∞' : 'Max'})`}
                    </div>
                );
            case 'rating_scale': {
                const minVal = Number(field.min) || 1;
                const maxVal = Number(field.max) || 5;
                const minLbl = field.min_label || 'Min Label';
                const maxLbl = field.max_label || 'Max Label';
                return (
                    <div className="flex items-center justify-between gap-3 py-1 select-none">
                        <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider truncate max-w-[100px]">
                            {minLbl}
                        </span>
                        <div className="flex items-center gap-1 justify-center flex-1 max-w-[180px] flex-wrap">
                            {Array.from({ length: maxVal - minVal + 1 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="w-6.5 h-6.5 rounded-lg bg-[hsl(var(--surface-elevated))]/70 border border-[hsl(var(--border))]/40 flex items-center justify-center text-[11px] font-semibold text-[hsl(var(--text-secondary))]"
                                >
                                    {minVal + i}
                                </div>
                            ))}
                        </div>
                        <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider text-right truncate max-w-[100px]">
                            {maxLbl}
                        </span>
                    </div>
                );
            }
            case 'matrix_table':
                return (
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-tertiary))] select-none overflow-hidden max-w-xl">
                        <span className="font-semibold uppercase tracking-wider text-[9px] text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))]/65 px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/30 shrink-0">
                            Headers
                        </span>
                        <span className="truncate italic">
                            {(field.table_columns || []).map(c => c.label).join(' • ') || 'No headers configured'}
                        </span>
                    </div>
                );
            default:
                return (
                    <div className="h-12 bg-white/40 dark:bg-black/20 rounded-lg px-4 flex items-center text-[hsl(var(--text-tertiary))] text-sm italic">
                        {(field.type as string).replace(/input_|_/g, ' ').trim()} preview
                        {field.default_value && <span className="ml-2 text-[10px] font-mono bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded text-[hsl(var(--primary))]">{field.default_value}</span>}
                        {field.is_sensitive && <span className="ml-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-1.5 py-0.5 rounded">🔒 sensitive</span>}
                    </div>
                );
        }
    };

    return (
        <StudioLayout
            activeNav="forms"
            onSelectNav={handleShellNavSelect}
            contentClassName="flex-1 overflow-hidden"
            alignRightRail
        >
            <div className={`flex h-full flex-col text-[hsl(var(--text-primary))] ${view === 'flow'
                ? 'bg-[linear-gradient(180deg,rgba(236,253,245,0.7),rgba(248,250,252,0.95)_16%,hsl(var(--background))_42%)]'
                : 'bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92)_18%,hsl(var(--background))_40%)]'
                }`}>
                {/* Header */}
                <header className={`flex h-16 shrink-0 items-center justify-between border-b px-6 backdrop-blur-md ${view === 'flow'
                    ? 'border-[hsl(var(--primary))]/18 bg-[linear-gradient(90deg,rgba(15,118,110,0.12),rgba(255,255,255,0.76)_28%,rgba(255,255,255,0.92))]'
                    : 'border-[hsl(var(--border))] bg-[linear-gradient(90deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]'
                    }`}>
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-md transition-all text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-md flex items-center justify-center shadow-lg shadow-black/10 shrink-0">
                            <Layout className="w-6 h-6 text-white" />
                        </div>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="min-w-0 max-w-[320px] bg-transparent border-none text-xl font-bold focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2"
                        />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        {formMeta?.kind === 'catalog' && (
                            <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
                                Catalog Mode
                            </div>
                        )}
                        <div className="rounded-md bg-[hsl(var(--surface-elevated))]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                            Studio Builder
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Vertical Rail */}
                    <aside
                        className="flex h-full shrink-0 border-r border-[hsl(var(--border))]/45 bg-[hsl(var(--surface-elevated))]/55 transition-all select-none"
                    >
                        <div className="w-14 flex flex-col items-center gap-4 py-4 px-2">
                            {/* Sections Tab Button */}
                            <button
                                id="section-list-trigger-rail"
                                onClick={() => {
                                    if (isSectionListOpen && activeLeftTab === 'sections') {
                                        setIsSectionListOpen(false);
                                    } else {
                                        setIsSectionListOpen(true);
                                        setActiveLeftTab('sections');
                                    }
                                }}
                                className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border transition-all ${
                                    isSectionListOpen && activeLeftTab === 'sections'
                                        ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))]'
                                }`}
                                title="Form Sections list"
                            >
                                <Layers className="w-4 h-4" />
                            </button>

                            {/* Widgets Tab Button */}
                            <button
                                id="widget-list-trigger-rail"
                                onClick={() => {
                                    if (isSectionListOpen && activeLeftTab === 'widgets') {
                                        setIsSectionListOpen(false);
                                    } else {
                                        setIsSectionListOpen(true);
                                        setActiveLeftTab('widgets');
                                    }
                                }}
                                className={`h-10 w-10 inline-flex items-center justify-center rounded-xl border transition-all ${
                                    isSectionListOpen && activeLeftTab === 'widgets'
                                        ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))]'
                                }`}
                                title="Fields Toolbox"
                            >
                                <ListTodo className="w-4 h-4" />
                            </button>
                        </div>
                    </aside>

                    <div className="flex flex-1 overflow-hidden">


                    <div className="flex min-h-0 flex-1 overflow-hidden relative">
                    {/* Left Panel: Section & Widget Navigator */}
                    {isSectionListOpen && (
                        <aside
                            ref={sectionListRef}
                            style={isLeftPanelPinned ? { width: leftPanelWidth } : { width: Math.max(defaultWidthForTab, 320) }}
                            className={`${
                                isLeftPanelPinned
                                    ? 'border-r border-[hsl(var(--border))]/45 bg-[hsl(var(--surface))] flex flex-col h-full overflow-hidden shrink-0 relative'
                                    : 'absolute left-4 top-3 bottom-4 z-40 border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface))] flex flex-col h-auto overflow-hidden rounded-2xl shadow-2xl'
                            } animate-in slide-in-from-left-4 fade-in duration-300`}
                        >
                            {/* Drag resize handle (pinned only) */}
                            {isLeftPanelPinned && (
                                <div
                                    onMouseDown={onResizeMouseDown}
                                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-[hsl(var(--primary))]/20 active:bg-[hsl(var(--primary))]/30 transition-colors"
                                    title="Drag to resize"
                                />
                            )}
                            {activeLeftTab === 'sections' && (
                                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                    <div className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--surface-elevated))]/45 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Section List</p>
                                                <h3 className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">Survey Sections</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => setIsLeftPanelPinned(!isLeftPanelPinned)}
                                                    className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors"
                                                    title={isLeftPanelPinned ? "Unpin (Float)" : "Pin (Dock)"}
                                                >
                                                    <Pin className={`w-3.5 h-3.5 ${isLeftPanelPinned ? 'fill-current rotate-45' : ''}`} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        addSection();
                                                        setSelectedFieldId(null);
                                                        setIsSectionListOpen(false);
                                                    }}
                                                    className="rounded-md border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface))] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all"
                                                >
                                                    + Section
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-3 relative flex items-center">
                                            <Search className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))] absolute left-3 pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Search sections..."
                                                value={sectionSearchQuery}
                                                onChange={(e) => setSectionSearchQuery(e.target.value)}
                                                className="w-full text-xs pl-9 pr-8 py-2 bg-[hsl(var(--surface))] rounded-lg border border-[hsl(var(--border))]/60 outline-none text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-tertiary))]/70 focus:border-[hsl(var(--primary))]/60 focus:ring-2 focus:ring-[hsl(var(--primary))]/10 transition-all shadow-inner"
                                            />
                                            {sectionSearchQuery && (
                                                <button
                                                    onClick={() => setSectionSearchQuery('')}
                                                    className="absolute right-2.5 p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] rounded transition-all text-xs"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-2">
                                        {sections
                                            .filter(section => section.title.toLowerCase().includes(sectionSearchQuery.toLowerCase()))
                                            .map((section) => {
                                                const originalIndex = sections.findIndex(s => s.id === section.id);
                                                const isActive = section.id === currentSectionId;
                                                return (
                                                    <button
                                                        key={section.id}
                                                        onClick={() => {
                                                            setCurrentSectionId(section.id);
                                                            setSelectedFieldId(null);
                                                            setIsSectionListOpen(false);
                                                            if (view === 'flow') {
                                                                centerSectionInFlowCanvas(section.id);
                                                            }
                                                        }}
                                                        className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${isActive
                                                            ? 'border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/6 text-[hsl(var(--primary))] shadow-sm'
                                                            : 'border-transparent bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-[hsl(var(--text-primary))]">{section.title || `Section ${originalIndex + 1}`}</p>
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{section.fields.length} field{section.fields.length !== 1 ? 's' : ''}</p>
                                                            </div>
                                                            <span className="rounded-md bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">S{originalIndex + 1}</span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        {sections.filter(section => section.title.toLowerCase().includes(sectionSearchQuery.toLowerCase())).length === 0 && (
                                            <div className="text-center py-6 text-xs text-[hsl(var(--text-tertiary))] italic">
                                                No sections match "{sectionSearchQuery}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {activeLeftTab === 'widgets' && (
                                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                    <div className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--surface-elevated))]/45 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Field Toolbox</p>
                                                <h3 className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">Form Fields</h3>
                                            </div>
                                            <button
                                                onClick={() => setIsLeftPanelPinned(!isLeftPanelPinned)}
                                                className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors"
                                                title={isLeftPanelPinned ? "Unpin (Float)" : "Pin (Dock)"}
                                            >
                                                <Pin className={`w-3.5 h-3.5 ${isLeftPanelPinned ? 'fill-current rotate-45' : ''}`} />
                                            </button>
                                        </div>
                                        <div className="mt-3 relative flex items-center">
                                            <Search className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))] absolute left-3 pointer-events-none" />
                                            <input
                                                type="text"
                                                placeholder="Search fields..."
                                                value={widgetSearchQuery}
                                                onChange={(e) => setWidgetSearchQuery(e.target.value)}
                                                className="w-full text-xs pl-9 pr-8 py-2 bg-[hsl(var(--surface))] rounded-lg border border-[hsl(var(--border))]/60 outline-none text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-tertiary))]/70 focus:border-[hsl(var(--primary))]/60 focus:ring-2 focus:ring-[hsl(var(--primary))]/10 transition-all shadow-inner"
                                            />
                                            {widgetSearchQuery && (
                                                <button
                                                    onClick={() => setWidgetSearchQuery('')}
                                                    className="absolute right-2.5 p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] rounded transition-all text-xs"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 hide-scrollbar select-none">
                                        {(() => {
                                            const filteredCategories = ['Standard Inputs', 'Time & Date', 'Selection Fields', 'Device Metrics', 'Media Input', 'Advanced Inputs'].map(category => {
                                                const categoryWidgets = widgetLibrary.filter(w => {
                                                    if (formMeta?.kind === 'catalog' && CATALOG_BLOCKED_TYPES.has(w.type)) {
                                                        return false;
                                                    }
                                                    return widgetCategoryMap[w.type] === category;
                                                });
                                                const filteredWidgets = categoryWidgets.filter(widget => {
                                                    const query = widgetSearchQuery.toLowerCase();
                                                    const labelMatches = widget.label.toLowerCase().includes(query);
                                                    const hintMatches = (widgetHints[widget.type] || '').toLowerCase().includes(query);
                                                    return labelMatches || hintMatches;
                                                });
                                                return { category, widgets: filteredWidgets };
                                            }).filter(cat => cat.widgets.length > 0);

                                            if (filteredCategories.length === 0 && widgetSearchQuery) {
                                                return (
                                                    <div className="text-center py-8 text-xs text-[hsl(var(--text-tertiary))] italic">
                                                        No fields match "{widgetSearchQuery}"
                                                    </div>
                                                );
                                            }

                                            return filteredCategories.map(({ category, widgets }) => {
                                                const isCollapsed = widgetSearchQuery ? false : !!collapsedWidgetCategories[category];
                                                return (
                                                    <div key={category} className="space-y-1">
                                                        <button
                                                            onClick={() => setCollapsedWidgetCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                                                            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-[hsl(var(--surface-elevated))]/50 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-colors"
                                                        >
                                                            <div className="flex items-center gap-1.5">
                                                                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                <span>{category}</span>
                                                            </div>
                                                            <span className="text-[9px] bg-[hsl(var(--surface-elevated))]/80 px-1.5 py-0.5 rounded-md border border-[hsl(var(--border))]/40">
                                                                {widgets.length}
                                                            </span>
                                                        </button>
                                                        {!isCollapsed && (
                                                            <div className="grid grid-cols-1 gap-1 pl-1 animate-in fade-in duration-100">
                                                                {widgets.map(widget => (
                                                                    <button
                                                                        key={widget.type}
                                                                        onClick={() => addField(widget.type)}
                                                                        title={widgetHints[widget.type]}
                                                                        className="group flex items-center justify-between w-full rounded-lg border border-transparent bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/85 hover:border-[hsl(var(--border))]/30 px-2.5 py-2 text-left transition-all"
                                                                    >
                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                            <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors ${getTypeIconStyle(widget.type)}`}>
                                                                                {widget.icon}
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="truncate text-xs font-semibold text-[hsl(var(--text-primary))]">{widget.label}</p>
                                                                                <p className="truncate text-[10px] text-[hsl(var(--text-tertiary))] group-hover:text-[hsl(var(--text-secondary))] mt-0.5" title={widgetHints[widget.type]}>
                                                                                    {widgetHints[widget.type]}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                        </aside>
                    )}

                    {/* Main Canvas — switches between Flow Mode and Inspector Mode */}
                    <main className="flex flex-1 flex-col overflow-hidden bg-transparent">


                        <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
                        {view === 'flow' ? (
                            /* ═══════════════════════════════════════════════
                               FLOW VIEW  — manage flow and section layout
                            ═══════════════════════════════════════════════ */
                            <div
                                key="flow-view"
                                className={`p-4 h-full flex flex-col overflow-hidden animate-in fade-in ${slideDir === 'back' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                                    } duration-300`}
                            >
                                <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                                    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/70 px-5 py-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))] mr-1">Flow</span>

                                            <button
                                                onClick={handleToggleAllCollapseModes}
                                                className="w-[120px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--surface-elevated))]/80 hover:bg-[hsl(var(--surface-elevated))] py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all shadow-sm"
                                                title="Toggle all sections view mode"
                                            >
                                                <ChevronsUpDown className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                                <span>{globalCollapseMode === 'full' ? '100%' : globalCollapseMode === 'summary' ? '50%' : globalCollapseMode === 'quarter' ? '25%' : 'collapse'}</span>
                                            </button>
                                            <button
                                                onClick={handleAutoArrangeSections}
                                                className="w-[120px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--border))]/70 bg-[hsl(var(--surface-elevated))]/80 hover:bg-[hsl(var(--surface-elevated))] py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all shadow-sm"
                                                title="Auto-arrange sections right-to-left"
                                            >
                                                <Sliders className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                                <span>Arrange</span>
                                            </button>
                                            <div className="flex items-center gap-2 border-l border-[hsl(var(--border))]/60 pl-3 ml-2 shrink-0">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">Zoom</span>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="1.5"
                                                    step="0.1"
                                                    value={zoom}
                                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                                    className="w-24 h-1.5 bg-[hsl(var(--border))]/80 rounded-lg appearance-none cursor-pointer accent-[hsl(var(--primary))]"
                                                    title="Zoom canvas"
                                                />
                                                <span className="text-[10px] font-mono font-bold text-[hsl(var(--text-secondary))] w-8 text-right">{Math.round(zoom * 100)}%</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => enterSection(sections.some(s => s.id === currentSectionId) ? currentSectionId : sections[0]?.id)}
                                            disabled={sections.length === 0}
                                            title="Compose Mode"
                                            className="rounded-xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--surface-elevated))]/80 hover:bg-[hsl(var(--surface-elevated))] p-2.5 text-[hsl(var(--text-primary))] transition-all hover:text-[hsl(var(--primary))] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-[hsl(var(--text-primary))] disabled:hover:bg-[hsl(var(--surface-elevated))]/80 shadow-sm"
                                        >
                                            <LayoutGrid className="w-[18px] h-[18px]" />
                                        </button>
                                    </div>

                                        <div
                                            ref={flowCanvasRef}
                                            onPointerDown={handleCanvasPointerDown}
                                            onPointerMove={handleCanvasPointerMove}
                                            onPointerUp={handleCanvasPointerUp}
                                            className={`relative min-h-[420px] flex-1 overflow-auto hide-scrollbar bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.04))] ${
                                                isPanning
                                                    ? 'cursor-grabbing select-none'
                                                    : isSpacePressed
                                                        ? 'cursor-grab'
                                                        : 'cursor-default'
                                            }`}
                                        >
                                            <div
                                                style={{
                                                    transform: `scale(${zoom})`,
                                                    transformOrigin: 'top left',
                                                    width: `${2400 * zoom}px`,
                                                    height: `${1600 * zoom}px`,
                                                }}
                                                className="relative"
                                            >
                                                <svg className="pointer-events-none absolute left-0 top-0 h-[1600px] w-[2400px]" viewBox="0 0 2400 1600" fill="none">
                                                {getFlowConnections().map((link) => {
                                                    const sourceIndex = sections.findIndex((section) => section.id === link.sourceId);
                                                    const targetIndex = sections.findIndex((section) => section.id === link.targetId);
                                                    if (sourceIndex === -1 || targetIndex === -1) {
                                                        return null;
                                                    }
                                                    const sourceLayout = ensureSectionLayout(sections[sourceIndex].layout, sourceIndex);
                                                    const targetLayout = ensureSectionLayout(sections[targetIndex].layout, targetIndex);
                                                    const startX = sourceLayout.x + (sourceLayout.width || FLOW_NODE_WIDTH);
                                                    const startY = sourceLayout.y + 96;
                                                    const endX = targetLayout.x;
                                                    const endY = targetLayout.y + 72;
                                                    const controlOffset = Math.max(120, Math.abs(endX - startX) / 2);
                                                    const stroke = link.tone === 'option' ? 'hsl(var(--primary))' : 'hsl(var(--warning))';
                                                    const labelX = startX + (endX - startX) / 2;
                                                    const labelY = startY + (endY - startY) / 2 - 12;

                                                    return (
                                                        <g key={link.id}>
                                                            <path
                                                                d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
                                                                fill="none"
                                                                stroke={stroke}
                                                                strokeWidth="2.5"
                                                                strokeDasharray={link.tone === 'option' ? '0' : '8 6'}
                                                                opacity="0.82"
                                                            />
                                                            <rect x={labelX - 60} y={labelY - 10} width="120" height="20" rx="10" fill="hsl(var(--surface))" stroke={stroke} strokeWidth="1" opacity="0.95" />
                                                            <text x={labelX} y={labelY + 4} textAnchor="middle" fill={stroke} fontSize="10" fontWeight="700">
                                                                {link.label.length > 18 ? `${link.label.slice(0, 18)}...` : link.label}
                                                            </text>
                                                        </g>
                                                    );
                                                })}
                                            </svg>

                                            <div className="relative h-[1600px] w-[2400px]">
                                                {sections.map((section, idx) => {
                                                    const layout = ensureSectionLayout(section.layout, idx);
                                                    const collapseMode = layout.collapse_mode || 'full';
                                                    const visibleFields = getVisibleFieldsForCard(section, layout);
                                                    const hiddenFieldCount = Math.max(0, section.fields.length - visibleFields.length);
                                                    const isActive = currentSectionId === section.id;
                                                    return (
                                                        <div
                                                            key={section.id}
                                                            className={`absolute rounded-2xl border transition-all select-none ${isActive
                                                                ? 'border-[hsl(var(--primary-orange))]/80 bg-[hsl(var(--surface))] shadow-[0_14px_40px_rgba(244,117,43,0.12)]'
                                                                : 'border-[hsl(var(--primary))]/55 bg-[hsl(var(--surface))]/95 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:border-[hsl(var(--primary))]/80'
                                                                }`}
                                                            style={{ left: layout.x, top: layout.y, width: layout.width || FLOW_NODE_WIDTH, zIndex: isActive ? 20 : 1 }}
                                                        >
                                                            <div
                                                                onPointerDown={(event) => {
                                                                    const isMiddleClick = event.button === 1;
                                                                    if (isSpacePressed || isMiddleClick) {
                                                                        return;
                                                                    }
                                                                    if ((event.target as HTMLElement).closest('button')) {
                                                                        return;
                                                                    }
                                                                    event.preventDefault();
                                                                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                                                    setCurrentSectionId(section.id);
                                                                    setSelectedFieldId(null);
                                                                    setDraggingSectionId(section.id);
                                                                    setSectionDragOffset({ x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom });
                                                                }}
                                                                className="flex cursor-grab items-start justify-between rounded-t-2xl border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/80 px-4 py-3 active:cursor-grabbing"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl transition-all ${isActive
                                                                            ? 'bg-[hsl(var(--primary-orange))]/12 text-[hsl(var(--primary-orange))]'
                                                                            : 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]'}`}>
                                                                            <Layers className="w-4 h-4" />
                                                                        </span>
                                                                        <div>
                                                                            <p className="truncate text-sm font-bold text-[hsl(var(--text-primary))]">{section.title}</p>
                                                                            <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Section {idx + 1}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => enterSection(section.id)}
                                                                    className={`rounded-lg border border-transparent bg-[hsl(var(--surface-elevated))]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-all hover:bg-[hsl(var(--surface-elevated))] ${isActive ? 'hover:text-[hsl(var(--primary-orange))]' : 'hover:text-[hsl(var(--primary))]'} shadow-sm`}
                                                                >
                                                                    Edit
                                                                </button>
                                                            </div>

                                                            <div
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => {
                                                                    setCurrentSectionId(section.id);
                                                                    setSelectedFieldId(null);
                                                                }}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        setCurrentSectionId(section.id);
                                                                        setSelectedFieldId(null);
                                                                    }
                                                                }}
                                                                className="block w-full px-4 pb-4 pt-3 text-left"
                                                            >
                                                                {collapseMode !== 'title' && section.properties.description && (
                                                                    <p className="mb-3 line-clamp-2 text-xs leading-5 text-[hsl(var(--text-secondary))]">{section.properties.description}</p>
                                                                )}

                                                                {collapseMode !== 'title' && (
                                                                    <div className="mb-3 flex flex-wrap gap-2">
                                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${section.properties.render_mode === 'single' ? (isActive ? 'bg-[hsl(var(--primary-orange))]/12 text-[hsl(var(--primary-orange))]' : 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]') : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'}`}>
                                                                            {section.properties.render_mode}
                                                                        </span>
                                                                        <span className="rounded-md bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--text-tertiary))]">{section.fields.length} fields</span>
                                                                        {(section.properties.platforms || []).slice(0, 3).map((platform) => (
                                                                            <span key={platform} className="rounded-md bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] capitalize text-[hsl(var(--text-tertiary))]">{platform}</span>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {collapseMode !== 'title' && (
                                                                    <div className="space-y-2">
                                                                    {section.fields.length === 0 ? (
                                                                        <div className="rounded-xl border border-dashed border-[hsl(var(--border))]/55 bg-[hsl(var(--surface-elevated))]/30 px-3 py-4 text-center text-[11px] text-[hsl(var(--text-tertiary))]">No fields yet</div>
                                                                    ) : visibleFields.map((field) => {
                                                                        const isDeleteRevealed = swipedFieldId === field.id;
                                                                        const currentSwipeOffset = isDeleteRevealed ? swipeOffset : 0;
                                                                        const isSelectedField = currentSectionId === section.id && selectedFieldId === field.id;
                                                                        return (
                                                                            <div
                                                                                id={`field-card-${field.id}`}
                                                                                key={field.id}
                                                                                onDragOver={(event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    setDragOverFieldId(field.id);
                                                                                }}
                                                                                onDrop={(event) => {
                                                                                    event.preventDefault();
                                                                                    event.stopPropagation();
                                                                                    const dragId = dragFieldIdRef.current;
                                                                                    if (!dragId || dragId === field.id) {
                                                                                        setDragOverFieldId(null);
                                                                                        return;
                                                                                    }
                                                                                    reorderFieldsInSection(section.id, dragId, field.id);
                                                                                    dragFieldIdRef.current = null;
                                                                                    setDragEnabledFieldId(null);
                                                                                    setDragOverFieldId(null);
                                                                                }}
                                                                                className={`relative overflow-hidden rounded-xl border transition-all ${isSelectedField
                                                                                    ? 'border-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/4 shadow-sm'
                                                                                    : dragOverFieldId === field.id
                                                                                        ? 'border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/3'
                                                                                        : 'border-[hsl(var(--border))]/55 bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80 hover:border-[hsl(var(--border))]/85'
                                                                                    }`}
                                                                            >
                                                                                <button
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        if (confirmDeleteFieldId === field.id) {
                                                                                            closeVariableSwipe();
                                                                                            removeField(field.id);
                                                                                        } else {
                                                                                            setConfirmDeleteFieldId(field.id);
                                                                                        }
                                                                                    }}
                                                                                    className={`absolute inset-y-0 right-0 z-0 flex w-[88px] items-center justify-center px-2 text-[11px] font-semibold text-white transition-all duration-200 ${
                                                                                        confirmDeleteFieldId === field.id
                                                                                            ? 'bg-red-700 hover:bg-red-800'
                                                                                            : 'bg-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/90'
                                                                                    }`}
                                                                                    title={confirmDeleteFieldId === field.id ? "Confirm delete variable" : "Delete variable"}
                                                                                >
                                                                                    {confirmDeleteFieldId === field.id ? 'Confirm?' : 'Delete'}
                                                                                </button>

                                                                                <div
                                                                                    onPointerDown={(event) => handleVariableSwipeStart(event, field.id)}
                                                                                    onPointerMove={(event) => handleVariableSwipeMove(event, field.id)}
                                                                                    onPointerUp={(event) => handleVariableSwipeEnd(event, field.id)}
                                                                                    onPointerCancel={closeVariableSwipe}
                                                                                    onClick={(event) => {
                                                                                        event.stopPropagation();
                                                                                        if (swipeStateRef.current.swiping) {
                                                                                            return;
                                                                                        }
                                                                                        closeVariableSwipe();
                                                                                        setCurrentSectionId(section.id);
                                                                                        setSelectedFieldId(field.id);
                                                                                    }}
                                                                                    className="relative z-10 flex items-center justify-between bg-[hsl(var(--surface))] px-3 py-2 transition-transform duration-200"
                                                                                    style={{ transform: `translateX(${currentSwipeOffset}px)` }}
                                                                                >
                                                                                    <div className="flex min-w-0 items-center gap-2">
                                                                                        <span
                                                                                            data-drag-handle="true"
                                                                                            draggable
                                                                                            onDragStart={(event) => {
                                                                                                event.stopPropagation();
                                                                                                closeVariableSwipe();
                                                                                                dragFieldIdRef.current = field.id;
                                                                                                setDragEnabledFieldId(field.id);
                                                                                                setDragOverFieldId(null);
                                                                                            }}
                                                                                            onDragEnd={() => {
                                                                                                dragFieldIdRef.current = null;
                                                                                                setDragEnabledFieldId(null);
                                                                                                setDragOverFieldId(null);
                                                                                            }}
                                                                                            className="cursor-grab text-[hsl(var(--text-tertiary))] active:cursor-grabbing"
                                                                                        >
                                                                                            ⋮⋮
                                                                                        </span>
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate text-xs font-semibold text-[hsl(var(--text-primary))]">{field.label}</p>
                                                                                            <p className="truncate text-[10px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{field.id}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="ml-3 flex shrink-0 items-center gap-2">
                                                                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{field.type.replace(/_/g, ' ')}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {hiddenFieldCount > 0 && <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">+{hiddenFieldCount} more fields</div>}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center justify-between border-t border-[hsl(var(--border))]/40 px-4 py-3">
                                                                <button
                                                                    onClick={() => addFieldToSection(section.id, 'input_text')}
                                                                    className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))] transition-all hover:text-[hsl(var(--primary))]"
                                                                >
                                                                    Add Variable
                                                                </button>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={() => updateSectionLayout(section.id, { collapse_mode: getNextCollapseMode(collapseMode) })}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))] transition-all hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--primary))]"
                                                                        title="Cycle card collapse mode"
                                                                    >
                                                                        <ChevronsUpDown className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                                                        <span>{collapseMode === 'full' ? '100%' : collapseMode === 'summary' ? '50%' : collapseMode === 'quarter' ? '25%' : 'collapse'}</span>
                                                                    </button>
                                                                    {sections.length > 1 && (
                                                                        <button
                                                                            onClick={() => {
                                                                                const next = sections.filter((candidate) => candidate.id !== section.id);
                                                                                setSections(next);
                                                                                if (currentSectionId === section.id && next.length) {
                                                                                    setCurrentSectionId(next[0].id);
                                                                                    setSelectedFieldId(null);
                                                                                }
                                                                            }}
                                                                            className="rounded-md p-1.5 text-[hsl(var(--text-tertiary))] transition-all hover:bg-[hsl(var(--error))]/10 hover:text-[hsl(var(--error))]"
                                                                            title="Delete section"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            </div>
                                        </div>

                                    </div>
                            </div>
                        ) : view === 'section' ? (
                            /* ═══════════════════════════════════════════════
                               SECTION VIEW  — edit fields inside one section
                            ═══════════════════════════════════════════════ */
                            <div
                                key={`section-view-${currentSectionId}`}
                                onClick={() => setSelectedFieldId(null)}
                                className={`p-4 h-full flex flex-col overflow-hidden animate-in fade-in ${slideDir === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                                    } duration-300`}
                            >
                                <div className="flex-1 flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                                    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/70 px-5 py-3">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Compose</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={exitSection}
                                            title="Flow Mode"
                                            className="rounded-xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--surface-elevated))]/80 hover:bg-[hsl(var(--surface-elevated))] p-2.5 text-[hsl(var(--text-primary))] transition-all hover:text-[hsl(var(--primary))] shadow-sm"
                                        >
                                            <GitBranch className="w-[18px] h-[18px]" />
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.03),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.04))]">
                                        <div className="w-full max-w-5xl mx-auto space-y-3">

                                    {fields.length === 0 ? (
                                        <div className="bg-[hsl(var(--surface-elevated))]/30 border border-dashed border-[hsl(var(--border))]/40 rounded-2xl p-20 text-center text-[hsl(var(--text-tertiary))]">
                                            <p className="text-lg font-medium">No fields yet</p>
                                            <p className="text-sm mt-2">Use the Field Toolbox in the left panel to add fields to this section.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {fields.map((field, currentIndex) => (
                                                <React.Fragment key={`field-block-${field.id}`}>
                                                    {/* Inline insertion zone before each card */}
                                                    <div className="relative group/insert h-6 -my-3 flex items-center justify-center z-20">
                                                        {/* Horizontal indicator line */}
                                                        <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent scale-x-0 group-hover/insert:scale-x-100 transition-transform duration-300 pointer-events-none" />

                                                        {/* Action buttons group */}
                                                        <div className="absolute opacity-0 group-hover/insert:opacity-100 flex items-center gap-1.5 transition-all scale-75 group-hover/insert:scale-100 pointer-events-auto z-30">
                                                            {/* Left common fields (most common) */}
                                                            {quickButtons.left.map((type) => {
                                                                const widget = widgetLibrary.find(w => w.type === type);
                                                                return (
                                                                    <button
                                                                        key={`left-${type}`}
                                                                        type="button"
                                                                        title={widget?.label || type}
                                                                        onClick={(e) => { e.stopPropagation(); handleQuickAddDirectly(currentIndex, type); }}
                                                                        className={`hover:brightness-95 dark:hover:brightness-110 flex items-center justify-center transition-all cursor-pointer w-7 h-7 shadow-sm shrink-0 rounded ${getSolidTypeIconStyle(type)}`}
                                                                    >
                                                                        {widget?.icon || <Plus className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                );
                                                            })}

                                                            {/* Action button */}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); handleOpenQuickAdd(currentIndex); }}
                                                                className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 text-[10px] font-bold px-2.5 rounded shadow-sm border border-emerald-300 dark:border-emerald-700 transition-all cursor-pointer h-7 shrink-0"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" /> Insert Field
                                                            </button>

                                                            {/* Right recent fields (last 2 used) */}
                                                            {quickButtons.right.map((type) => {
                                                                const widget = widgetLibrary.find(w => w.type === type);
                                                                return (
                                                                    <button
                                                                        key={`right-${type}`}
                                                                        type="button"
                                                                        title={widget?.label || type}
                                                                        onClick={(e) => { e.stopPropagation(); handleQuickAddDirectly(currentIndex, type); }}
                                                                        className={`hover:brightness-95 dark:hover:brightness-110 flex items-center justify-center transition-all cursor-pointer w-7 h-7 shadow-sm shrink-0 rounded ${getSolidTypeIconStyle(type)}`}
                                                                    >
                                                                        {widget?.icon || <Plus className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div
                                                        key={field.id}
                                                        draggable={dragEnabledFieldId === field.id}
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
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFieldId(field.id);
                                                        }}
                                                        className={`group relative flex transition-all duration-200 cursor-pointer border rounded-2xl p-4 pl-10 pr-10 ${
                                                            selectedFieldId === field.id
                                                                ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/4 shadow-md shadow-[hsl(var(--primary))]/5'
                                                                : dragOverFieldId === field.id
                                                                    ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/3 border-dashed'
                                                                    : 'border-[hsl(var(--border))]/60 hover:border-emerald-500/40 bg-[hsl(var(--surface))] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)]'
                                                        }`}
                                                    >
                                                        {/* LEFT DRAG AFFORDANCE */}
                                                        <div
                                                            onMouseEnter={() => setDragEnabledFieldId(field.id)}
                                                            onMouseLeave={() => setDragEnabledFieldId(null)}
                                                            className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 cursor-grab text-slate-300 dark:text-slate-700 hover:text-emerald-500 dark:hover:text-emerald-400 py-3 px-1 transition-colors duration-200"
                                                        >
                                                            <div className="grid grid-cols-2 gap-x-[3px] gap-y-[4px]">
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                            </div>
                                                        </div>

                                                        {/* Core Content Stack */}
                                                        <div className="flex-1 flex flex-col gap-3.5 min-w-0">
                                                            
                                                            {/* TOP ROW */}
                                                            <div className="flex items-center gap-3">
                                                                {/* Type Icon */}
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getTypeIconStyle(field.type)}`}>
                                                                    {getWidget(field.type)?.icon || <Smartphone className="w-[18px] h-[18px]" />}
                                                                </div>
                                                                {/* Name Input */}
                                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={field.label}
                                                                        onChange={(e) => updateFieldLabel(field.id, e.target.value)}
                                                                        className="text-[15px] font-bold text-[hsl(var(--text-primary))] bg-transparent border-b border-transparent focus:outline-none flex-1 min-w-0"
                                                                    />
                                                                    {formMeta?.kind === 'catalog' && formMeta.catalog_key_field_id === field.id && (
                                                                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shadow-sm whitespace-nowrap" title="Unique key identifier">
                                                                            ⚿ Key
                                                                        </span>
                                                                    )}
                                                                    {formMeta?.kind === 'catalog' && formMeta.catalog_label_field_id === field.id && (
                                                                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shadow-sm whitespace-nowrap" title="Dropdown display label">
                                                                            🏷 Label
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* BOTTOM ROW */}
                                                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t border-[hsl(var(--border))]/30 pt-3.5">
                                                                
                                                                {/* Bottom Left: Dynamic Visuals */}
                                                                <div className="flex items-center gap-3 flex-1 w-full overflow-hidden">
                                                                    {field.type === 'rating_scale' ? (
                                                                        <div className="flex items-center justify-between gap-4 py-1.5 w-full">
                                                                            <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider truncate max-w-[120px] select-none">
                                                                                {field.min_label || 'Min label'}
                                                                            </span>
                                                                            <div className="flex items-center gap-1.5 flex-1 justify-center max-w-[240px] flex-wrap">
                                                                                {Array.from({ length: (Number(field.max) || 5) - (Number(field.min) || 1) + 1 }).map((_, i) => (
                                                                                    <div
                                                                                        key={i}
                                                                                        className="w-7 h-7 rounded-lg bg-[hsl(var(--surface-elevated))]/70 border border-[hsl(var(--border))]/40 flex items-center justify-center text-xs font-semibold text-[hsl(var(--text-secondary))] select-none"
                                                                                    >
                                                                                        {(Number(field.min) || 1) + i}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider text-right truncate max-w-[120px] select-none">
                                                                                {field.max_label || 'Max label'}
                                                                            </span>
                                                                        </div>
                                                                    ) : (
                                                                        renderWidgetPreview(field)
                                                                    )}
                                                                </div>

                                                                {/* Bottom Right: Action Cluster */}
                                                                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 relative">
                                                                    {/* Required Toggle */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            updateField(field.id, { required: !field.required });
                                                                        }}
                                                                        title={field.required ? 'Required (click to make optional)' : 'Optional (click to make required)'}
                                                                        className={`w-8 h-8 rounded flex items-center justify-center border transition-all ${
                                                                            field.required
                                                                                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                                                                                : 'border-[hsl(var(--border))]/40 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))] bg-transparent'
                                                                        }`}
                                                                    >
                                                                        <Star className="w-4 h-4" fill={field.required ? 'currentColor' : 'none'} />
                                                                    </button>

                                                                    {/* Duplicate Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            copyField(field.id);
                                                                        }}
                                                                        title="Duplicate field"
                                                                        className="w-8 h-8 rounded flex items-center justify-center border border-[hsl(var(--border))]/40 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))]/30 transition-all bg-transparent"
                                                                    >
                                                                        <Copy className="w-4 h-4" />
                                                                    </button>

                                                                    {/* Move to section */}
                                                                    {sections.length > 1 && (
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setMoveMenuFieldId(moveMenuFieldId === field.id ? null : field.id);
                                                                                }}
                                                                                title="Move to section"
                                                                                className="w-8 h-8 rounded flex items-center justify-center border border-[hsl(var(--border))]/40 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] hover:border-[hsl(var(--primary))]/30 transition-all bg-transparent"
                                                                            >
                                                                                <MoveRight className="w-4 h-4" />
                                                                            </button>
                                                                            {moveMenuFieldId === field.id && (
                                                                                <div className="absolute right-0 bottom-10 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md shadow-lg z-50 min-w-40 py-1">
                                                                                    {sections.filter(s => s.id !== currentSectionId).map(s => (
                                                                                        <button
                                                                                            key={s.id}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                moveField(field.id, s.id);
                                                                                                setMoveMenuFieldId(null);
                                                                                            }}
                                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--surface-elevated))] transition-all"
                                                                                        >
                                                                                            → {s.title}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Delete Button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeField(field.id);
                                                                        }}
                                                                        title="Delete field"
                                                                        className="w-8 h-8 rounded flex items-center justify-center border border-[hsl(var(--border))]/40 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] hover:border-[hsl(var(--error))]/30 transition-all bg-transparent"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>

                                                            </div>

                                                        </div>

                                                        {/* RIGHT DRAG AFFORDANCE */}
                                                        <div
                                                            onMouseEnter={() => setDragEnabledFieldId(field.id)}
                                                            onMouseLeave={() => setDragEnabledFieldId(null)}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 cursor-grab text-slate-300 dark:text-slate-700 hover:text-emerald-500 dark:hover:text-emerald-400 py-3 px-1 transition-colors duration-200"
                                                        >
                                                            <div className="grid grid-cols-2 gap-x-[3px] gap-y-[4px]">
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                                <span className="w-1 h-1 bg-current rounded-full"></span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            ))}

                                            {/* Final inline insertion zone at the end of the section */}
                                            <div className="relative group/insert h-6 -my-3 flex items-center justify-center z-20">
                                                {/* Horizontal indicator line */}
                                                <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent scale-x-0 group-hover/insert:scale-x-100 transition-transform duration-300 pointer-events-none" />

                                                {/* Action buttons group */}
                                                <div className="absolute opacity-0 group-hover/insert:opacity-100 flex items-center gap-1.5 transition-all scale-75 group-hover/insert:scale-100 pointer-events-auto z-30">
                                                    {/* Left common fields (most common) */}
                                                    {quickButtons.left.map((type) => {
                                                        const widget = widgetLibrary.find(w => w.type === type);
                                                        return (
                                                            <button
                                                                key={`left-end-${type}`}
                                                                type="button"
                                                                title={widget?.label || type}
                                                                onClick={(e) => { e.stopPropagation(); handleQuickAddDirectly(fields.length, type); }}
                                                                className={`hover:brightness-95 dark:hover:brightness-110 flex items-center justify-center transition-all cursor-pointer w-7 h-7 shadow-sm shrink-0 rounded ${getSolidTypeIconStyle(type)}`}
                                                            >
                                                                {widget?.icon || <Plus className="w-3.5 h-3.5" />}
                                                            </button>
                                                        );
                                                    })}

                                                    {/* Action button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleOpenQuickAdd(fields.length); }}
                                                        className="bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 text-[10px] font-bold px-2.5 rounded shadow-sm border border-emerald-300 dark:border-emerald-700 transition-all cursor-pointer h-7 shrink-0"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" /> Insert Field
                                                    </button>

                                                    {/* Right recent fields (last 2 used) */}
                                                    {quickButtons.right.map((type) => {
                                                        const widget = widgetLibrary.find(w => w.type === type);
                                                        return (
                                                            <button
                                                                key={`right-end-${type}`}
                                                                type="button"
                                                                title={widget?.label || type}
                                                                onClick={(e) => { e.stopPropagation(); handleQuickAddDirectly(fields.length, type); }}
                                                                className={`hover:brightness-95 dark:hover:brightness-110 flex items-center justify-center transition-all cursor-pointer w-7 h-7 shadow-sm shrink-0 rounded ${getSolidTypeIconStyle(type)}`}
                                                            >
                                                                {widget?.icon || <Plus className="w-3.5 h-3.5" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        </div>
                    </main>


                    </div>

                    </div>

                    <aside className={`flex h-full shrink-0 border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55 relative transition-all duration-300 ${
                        isRightSidebarOpen && isRightSidebarPinned && view === 'section'
                            ? 'w-full md:w-1/2 border-l'
                            : isRightSidebarOpen && isRightSidebarPinned
                                ? 'border-l'
                                : 'w-0 border-l-0 overflow-hidden'
                    }`}>
                        {isRightSidebarOpen && (
                            <div
                                className={`${
                                    isRightSidebarPinned
                                        ? 'border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col overflow-hidden flex-grow min-w-0'
                                        : 'fixed md:absolute inset-0 md:inset-auto md:right-16 md:top-3 md:bottom-4 z-40 border-0 md:border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface))] flex flex-col overflow-hidden rounded-none md:rounded-2xl shadow-2xl w-auto max-w-full md:w-[560px]'
                                } animate-in slide-in-from-right-4 fade-in duration-300 relative`}
                                style={{
                                    width: isRightSidebarPinned
                                        ? (view === 'section' ? undefined : rightPanelWidth)
                                        : undefined
                                }}
                            >
                                {/* Drag resize handle (pinned only) */}
                                {isRightSidebarPinned && (
                                    <div
                                        onMouseDown={onRightResizeMouseDown}
                                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-50 hover:bg-[hsl(var(--primary))]/20 active:bg-[hsl(var(--primary))]/30 transition-colors"
                                        title="Drag to resize"
                                    />
                                )}
                                {/* Top Tab Bar */}
                                <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55 px-2 py-2 flex items-center justify-between gap-1 select-none">
                                    <div className="flex gap-1 flex-1">
                                        {(['form', 'section', 'widget'] as const).map((tab) => {
                                            const label = tab === 'form' ? 'Form' : tab === 'section' ? 'Section' : 'Field';
                                            const Icon = tab === 'form' ? Layout : tab === 'section' ? Settings : ListTodo;
                                            const isActive = activeSidebarTab === tab;
                                            return (
                                                <button
                                                    key={tab}
                                                    onClick={() => {
                                                        setActiveSidebarTab(tab);
                                                    }}
                                                    className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                        isActive
                                                            ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/25'
                                                            : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] bg-transparent'
                                                    }`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setIsRightSidebarPinned(!isRightSidebarPinned)}
                                        className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors ml-1 shrink-0"
                                        title={isRightSidebarPinned ? "Unpin (Float)" : "Pin (Dock)"}
                                    >
                                        <Pin className={`w-3.5 h-3.5 ${isRightSidebarPinned ? 'fill-current rotate-45' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => setIsRightSidebarOpen(false)}
                                        className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-red-500 rounded-lg transition-colors ml-1 shrink-0"
                                        title="Close Properties Panel"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Tab Contents */}
                                <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
                                    {/* ─── FORM TAB ─── */}
                                    {activeSidebarTab === 'form' && (
                                        <div className="flex-1 flex flex-col">
                                            <div className="flex-1 p-6 pt-4 overflow-y-auto hide-scrollbar">
                                                <div className="space-y-5 animate-in fade-in duration-200">
                                                    <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] flex items-center">
                                                        <Layout className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                                                        Form Properties
                                                    </h3>

                                                    {/* Form Title (editable) */}
                                                    <div>
                                                        <label className="label">Form Title</label>
                                                        <input
                                                            value={title}
                                                            onChange={(e) => setTitle(e.target.value)}
                                                            className="input"
                                                            placeholder="Untitled Form"
                                                        />
                                                    </div>

                                                    {/* Slug */}
                                                    <div>
                                                        <label className="label">Form Slug</label>
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                value={formMeta?.slug || ''}
                                                                readOnly
                                                                className="input flex-1 text-[hsl(var(--text-secondary))] bg-[hsl(var(--surface-elevated))]/40 cursor-default"
                                                                placeholder="auto-generated"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    if (formMeta?.slug) {
                                                                        navigator.clipboard.writeText(formMeta.slug);
                                                                    }
                                                                }}
                                                                className="p-2 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-lg transition-colors"
                                                                title="Copy slug"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Public toggle */}
                                                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                        <div>
                                                            <p className="text-sm font-semibold">Public Form</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Allow anonymous submissions via public URL</p>
                                                        </div>
                                                        <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                                            formMeta?.is_public
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                                                        }`}>
                                                            {formMeta?.is_public ? 'Public' : 'Private'}
                                                        </div>
                                                    </div>

                                                    {/* Status badge */}
                                                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                        <div>
                                                            <p className="text-sm font-semibold">Status</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Current form status</p>
                                                        </div>
                                                        <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                                            formMeta?.status === 'live'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        }`}>
                                                            {formMeta?.status || 'draft'}
                                                        </div>
                                                    </div>

                                                    {/* Stats summary */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl text-center">
                                                            <p className="text-lg font-bold text-[hsl(var(--text-primary))]">{sections.length}</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] font-medium uppercase tracking-wider">Sections</p>
                                                        </div>
                                                        <div className="p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl text-center">
                                                            <p className="text-lg font-bold text-[hsl(var(--text-primary))]">{sections.reduce((sum, s) => sum + s.fields.length, 0)}</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] font-medium uppercase tracking-wider">Fields</p>
                                                        </div>
                                                        <div className="p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl text-center">
                                                            <p className="text-lg font-bold text-[hsl(var(--text-primary))]">{formRules.length}</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] font-medium uppercase tracking-wider">Rules</p>
                                                        </div>
                                                        <div className="p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl text-center">
                                                            <p className="text-lg font-bold text-[hsl(var(--text-primary))]">v{formMeta?.version || 1}</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] font-medium uppercase tracking-wider">Version</p>
                                                        </div>
                                                    </div>

                                                    {/* Linked Forms */}
                                                    {projectForms.length > 0 && (
                                                        <div>
                                                            <label className="label">Linked Forms in Project</label>
                                                            <div className="space-y-1">
                                                                {projectForms.slice(0, 5).map(f => (
                                                                    <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-[hsl(var(--surface-elevated))]/40 rounded-lg text-xs">
                                                                        <FileText className="w-3 h-3 text-[hsl(var(--text-tertiary))] shrink-0" />
                                                                        <span className="text-[hsl(var(--text-secondary))] truncate">{f.title}</span>
                                                                    </div>
                                                                ))}
                                                                {projectForms.length > 5 && (
                                                                    <p className="text-[10px] text-[hsl(var(--text-tertiary))] pl-3">+{projectForms.length - 5} more</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeSidebarTab === 'section' && (
                                        <div className="flex-1 flex flex-col">
                                            {/* Identity Summary Card */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--surface-elevated))]/40 border-b border-[hsl(var(--border))]/40 select-none shrink-0">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20 shrink-0">
                                                    <Layers className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                            SECTION
                                                        </span>
                                                        <span className="text-[9px] font-mono text-[hsl(var(--text-tertiary))] truncate max-w-[100px]" title={currentSectionId}>
                                                            {currentSectionId}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-xs font-semibold text-[hsl(var(--text-primary))] truncate mt-0.5">
                                                        {sections.find(p => p.id === currentSectionId)?.title || 'Untitled Section'}
                                                    </h4>
                                                </div>
                                            </div>

                                            <div className="flex-1 px-0 py-0 overflow-y-auto hide-scrollbar select-none flex flex-col justify-between">
                                                <div className="space-y-4">
                                                    {/* Properties Grid Grouped by Category */}
                                                    {(() => {
                                                        const sectionPropertyMetaDetails: Record<string, { name: string; description: string }> = {
                                                            title: { name: 'Section Title', description: 'The title displayed at the top of this section/screen in the mobile app.' },
                                                            description: { name: 'Section Description', description: 'An optional introductory text shown below the section title to guide form-fillers.' },
                                                            render_mode: { name: 'Render Mode', description: 'Choose whether fields in this section display all at once (List) or one-by-one (Single field wizard).' },
                                                            platforms: { name: 'Platforms', description: 'The platforms (Mobile, Web, USSD) where this section should be rendered and accessible.' },
                                                            shuffle_options: { name: 'Shuffle Options', description: 'If enabled, the options of choices fields in this section will be randomized at runtime.' },
                                                            is_repeatable: { name: 'Repeatable Section', description: 'Allows users to fill this section multiple times dynamically (e.g. adding multiple store inventory cards).' },
                                                            max_repeats: { name: 'Max Repeats', description: 'The maximum number of times this repeatable section can be duplicated/filled.' },
                                                        };

                                                        const sectionPropRows = [
                                                            {
                                                                category: 'Appearance',
                                                                key: 'title',
                                                                label: 'Section Title',
                                                                metaKey: 'title',
                                                                visible: true,
                                                                render: () => (
                                                                    <input
                                                                        value={sections.find(p => p.id === currentSectionId)?.title || ''}
                                                                        onChange={(e) => updateCurrentSectionTitle(e.target.value)}
                                                                        className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                        placeholder="Section Title"
                                                                        onFocus={() => setHoveredProperty(sectionPropertyMetaDetails.title)}
                                                                        onBlur={() => setHoveredProperty(null)}
                                                                    />
                                                                )
                                                            },
                                                            {
                                                                category: 'Appearance',
                                                                key: 'description',
                                                                label: 'Description',
                                                                metaKey: 'description',
                                                                visible: true,
                                                                render: () => (
                                                                    <textarea
                                                                        value={sections.find(p => p.id === currentSectionId)?.properties.description || ''}
                                                                        onChange={(e) => updateCurrentSectionProperties({ description: e.target.value })}
                                                                        className="w-full bg-transparent px-1.5 py-1 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))] resize-none"
                                                                        rows={2}
                                                                        placeholder="Optional description..."
                                                                        onFocus={() => setHoveredProperty(sectionPropertyMetaDetails.description)}
                                                                        onBlur={() => setHoveredProperty(null)}
                                                                    />
                                                                )
                                                            },
                                                            {
                                                                category: 'Appearance',
                                                                key: 'render_mode',
                                                                label: 'Render Mode',
                                                                metaKey: 'render_mode',
                                                                visible: true,
                                                                render: () => {
                                                                    const currentProps = sections.find(p => p.id === currentSectionId)?.properties;
                                                                    return (
                                                                        <div className="flex gap-1 bg-[hsl(var(--surface-elevated))]/60 p-0.5 rounded-lg border border-[hsl(var(--border))]/25 w-full">
                                                                            {(['list', 'single'] as RenderMode[]).map((mode) => {
                                                                                const isActive = currentProps?.render_mode === mode;
                                                                                return (
                                                                                    <button
                                                                                        key={mode}
                                                                                        type="button"
                                                                                        onClick={() => updateCurrentSectionProperties({ render_mode: mode })}
                                                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-all flex-1 ${isActive
                                                                                            ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                                                                                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/80'
                                                                                        }`}
                                                                                    >
                                                                                        {mode}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                }
                                                            },
                                                            {
                                                                category: 'Behavior',
                                                                key: 'platforms',
                                                                label: 'Platforms',
                                                                metaKey: 'platforms',
                                                                visible: true,
                                                                render: () => {
                                                                    const currentProps = sections.find(p => p.id === currentSectionId)?.properties;
                                                                    return (
                                                                        <div className="flex gap-1">
                                                                            {(['mobile', 'web', 'ussd'] as Platform[]).map(platform => {
                                                                                const isActive = currentProps?.platforms?.includes(platform) ?? true;
                                                                                return (
                                                                                    <button
                                                                                        key={platform}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const next = new Set(currentProps?.platforms || []);
                                                                                            if (isActive) next.delete(platform);
                                                                                            else next.add(platform);
                                                                                            updateCurrentSectionProperties({ platforms: Array.from(next) });
                                                                                        }}
                                                                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                                                                            isActive
                                                                                                ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                                                                                : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                        }`}
                                                                                    >
                                                                                        {platform}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                }
                                                            },
                                                            {
                                                                category: 'Behavior',
                                                                key: 'shuffle_options',
                                                                label: 'Shuffle Options',
                                                                metaKey: 'shuffle_options',
                                                                visible: true,
                                                                render: () => (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!sections.find(p => p.id === currentSectionId)?.properties.shuffle_options}
                                                                        onChange={(e) => updateCurrentSectionProperties({ shuffle_options: e.target.checked })}
                                                                        className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30 cursor-pointer"
                                                                        onFocus={() => setHoveredProperty(sectionPropertyMetaDetails.shuffle_options)}
                                                                        onBlur={() => setHoveredProperty(null)}
                                                                    />
                                                                )
                                                            },
                                                            {
                                                                category: 'Behavior',
                                                                key: 'is_repeatable',
                                                                label: 'Repeatable',
                                                                metaKey: 'is_repeatable',
                                                                visible: true,
                                                                render: () => (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={sections.find(p => p.id === currentSectionId)?.properties.is_repeatable || false}
                                                                        onChange={(e) => updateCurrentSectionProperties({ is_repeatable: e.target.checked })}
                                                                        className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/30 cursor-pointer"
                                                                        onFocus={() => setHoveredProperty(sectionPropertyMetaDetails.is_repeatable)}
                                                                        onBlur={() => setHoveredProperty(null)}
                                                                    />
                                                                )
                                                            },
                                                            {
                                                                category: 'Behavior',
                                                                key: 'max_repeats',
                                                                label: 'Max Repeats',
                                                                metaKey: 'max_repeats',
                                                                visible: sections.find(p => p.id === currentSectionId)?.properties.is_repeatable || false,
                                                                render: () => (
                                                                    <input
                                                                        type="number"
                                                                        min={1}
                                                                        value={sections.find(p => p.id === currentSectionId)?.properties.max_repeats || ''}
                                                                        onChange={(e) => updateCurrentSectionProperties({ max_repeats: parseInt(e.target.value) || undefined })}
                                                                        className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                        placeholder="No limit"
                                                                        onFocus={() => setHoveredProperty(sectionPropertyMetaDetails.max_repeats)}
                                                                        onBlur={() => setHoveredProperty(null)}
                                                                    />
                                                                )
                                                            }
                                                        ];

                                                        const categories = formMeta?.kind === 'catalog'
                                                            ? ['Appearance', 'Behavior']
                                                            : ['Appearance', 'Logic & Events', 'Behavior'];

                                                        return (
                                                            <div className="overflow-y-auto hide-scrollbar border-b border-[hsl(var(--border))]/25 bg-[hsl(var(--background))] select-none">
                                                                {categories.map(categoryName => {
                                                                    const isCollapsed = !!collapsedPropCategories[categoryName];

                                                                    if (categoryName === 'Logic & Events') {
                                                                        const preRulesCount = formRules.filter(r => r.trigger_id === currentSectionId && r.timing === 'pre').length;
                                                                        const postRulesCount = formRules.filter(r => r.trigger_id === currentSectionId && r.timing === 'post').length;
                                                                        return (
                                                                            <div key={categoryName} className="border-b border-[hsl(var(--border))]/30 last:border-b-0">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setCollapsedPropCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                                                                                    className="w-full flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/45 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] select-none border-b border-[hsl(var(--border))]/25 transition-all"
                                                                                >
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                                        <span>{categoryName}</span>
                                                                                    </div>
                                                                                </button>

                                                                                {!isCollapsed && (
                                                                                    <div className="p-4 bg-[hsl(var(--surface))] space-y-3 border-t border-[hsl(var(--border))]/20">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const currentSection = sections.find(p => p.id === currentSectionId);
                                                                                                setRulesModalContext({
                                                                                                    triggerId: currentSectionId,
                                                                                                    triggerType: 'section',
                                                                                                    timing: 'pre',
                                                                                                    label: currentSection?.title || currentSectionId
                                                                                                });
                                                                                                setIsRulesModalOpen(true);
                                                                                            }}
                                                                                            className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80 border border-[hsl(var(--border))]/20 rounded-xl transition-all"
                                                                                        >
                                                                                            <div className="flex flex-col items-start text-left">
                                                                                                <span className="text-xs font-semibold text-[hsl(var(--text-primary))]">⚡ Pre-Render Logic (Pre)</span>
                                                                                                <span className="text-[9px] text-[hsl(var(--text-tertiary))]">Triggered before section loads</span>
                                                                                            </div>
                                                                                            <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">
                                                                                                {preRulesCount} Rules
                                                                                            </span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => {
                                                                                                const currentSection = sections.find(p => p.id === currentSectionId);
                                                                                                setRulesModalContext({
                                                                                                    triggerId: currentSectionId,
                                                                                                    triggerType: 'section',
                                                                                                    timing: 'post',
                                                                                                    label: currentSection?.title || currentSectionId
                                                                                                });
                                                                                                setIsRulesModalOpen(true);
                                                                                            }}
                                                                                            className="w-full flex items-center justify-between px-3 py-2 bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80 border border-[hsl(var(--border))]/20 rounded-xl transition-all"
                                                                                        >
                                                                                            <div className="flex flex-col items-start text-left">
                                                                                                <span className="text-xs font-semibold text-[hsl(var(--text-primary))]">⚡ Post-Exit Logic (Post)</span>
                                                                                                <span className="text-[9px] text-[hsl(var(--text-tertiary))]">Triggered on section exit</span>
                                                                                            </div>
                                                                                            <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">
                                                                                                {postRulesCount} Rules
                                                                                            </span>
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    const categoryRows = sectionPropRows.filter(r => r.category === categoryName && r.visible);
                                                                    if (categoryRows.length === 0) return null;

                                                                    return (
                                                                        <div key={categoryName} className="border-b border-[hsl(var(--border))]/30 last:border-b-0">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setCollapsedPropCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                                                                                className="w-full flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/45 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] select-none border-b border-[hsl(var(--border))]/25 transition-all"
                                                                            >
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                                    <span>{categoryName}</span>
                                                                                </div>
                                                                            </button>

                                                                            {!isCollapsed && (
                                                                                <div className="divide-y divide-[hsl(var(--border))]/20 bg-[hsl(var(--surface))]">
                                                                                    {categoryRows.map(row => (
                                                                                        <div
                                                                                            key={row.key}
                                                                                            onMouseEnter={() => row.metaKey && sectionPropertyMetaDetails[row.metaKey] && setHoveredProperty(sectionPropertyMetaDetails[row.metaKey])}
                                                                                            onMouseLeave={() => setHoveredProperty(null)}
                                                                                            className="flex items-center min-h-[32px] hover:bg-[hsl(var(--surface-elevated))]/20 transition-colors"
                                                                                        >
                                                                                            <div className="w-[40%] px-4 truncate select-none border-r border-[hsl(var(--border))]/20 text-[hsl(var(--text-secondary))] font-medium text-[11px] flex items-center py-1 self-stretch">
                                                                                                {row.label}
                                                                                            </div>
                                                                                            <div className="w-[60%] pl-3 pr-4 py-1 text-[11px] flex items-center min-w-0">
                                                                                                {row.render()}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Save as Template */}
                                                    <div className="pt-2 px-4">
                                                        <button
                                                            onClick={() => setIsSaveTemplateModalOpen(true)}
                                                            className="w-full py-2 bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 border border-transparent text-[hsl(var(--primary))] font-semibold rounded-md transition-all flex items-center justify-center gap-2 text-xs"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                            Save as Template
                                                        </button>
                                                        {sections.find(p => p.id === currentSectionId)?.template_id && (
                                                            <button
                                                                onClick={updateExistingTemplate}
                                                                className="w-full mt-2 py-1.5 text-xs font-semibold text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] transition-all flex items-center justify-center gap-1.5"
                                                            >
                                                                <Layers className="w-3.5 h-3.5" />
                                                                Update Linked Template
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="text-[hsl(var(--text-tertiary))] text-[10px] italic mt-4 px-4">Select a field in the canvas to see its individual properties.</p>
                                            </div>

                                            {/* Description Helper Panel */}
                                            <div className="h-[100px] border-t border-[hsl(var(--border))]/45 bg-[hsl(var(--surface-elevated))]/40 p-3 select-none flex flex-col justify-between shrink-0">
                                                {hoveredProperty ? (
                                                    <div className="animate-in fade-in duration-150">
                                                        <p className="text-xs font-bold text-[hsl(var(--text-primary))] flex items-center">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] mr-1.5" />
                                                            {hoveredProperty.name}
                                                        </p>
                                                        <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-1 leading-normal line-clamp-3">
                                                            {hoveredProperty.description}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-[10px] text-[hsl(var(--text-tertiary))] italic">
                                                        Hover over a property name to view description.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeSidebarTab === 'widget' && (
                                        <div className="flex-1 flex flex-col">
                                            {selectedField ? (
                                                <>
                                                    {/* Identity Summary Card */}
                                                    <div className="flex items-center gap-3 px-4 py-3 bg-[hsl(var(--surface-elevated))]/40 border-b border-[hsl(var(--border))]/40 select-none">
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20 shrink-0">
                                                            {widgetLibrary.find(w => w.type === selectedField.type)?.icon || <Type className="w-4 h-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                                    {selectedField.type.replace(/_/g, ' ')}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-[hsl(var(--text-tertiary))] truncate max-w-[100px]" title={selectedField.id}>
                                                                    {selectedField.id}
                                                                </span>
                                                            </div>
                                                            <h4 className="text-xs font-semibold text-[hsl(var(--text-primary))] truncate mt-0.5">
                                                                {selectedField.label || 'No label'}
                                                            </h4>
                                                        </div>
                                                    </div>

                                                                                                         <div className="flex-1 px-0 py-0 overflow-y-auto hide-scrollbar select-none">
                                                                {/* Properties Grid Grouped by Category */}
                                                                {(() => {
                                                                    const allPropRows = [
                                                                        // --- Appearance ---
                                                                        {
                                                                            category: 'Appearance',
                                                                            key: 'label',
                                                                            label: 'Label',
                                                                            metaKey: 'label',
                                                                            visible: true,
                                                                            render: () => (
                                                                                <input
                                                                                    id="field-label-input"
                                                                                    value={selectedField.label}
                                                                                    onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.label)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Appearance',
                                                                            key: 'placeholder',
                                                                            label: 'Placeholder',
                                                                            metaKey: 'placeholder',
                                                                            visible: ['input_text', 'input_number', 'email_input', 'phone_input', 'textarea'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.placeholder || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="Enter placeholder..."
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.placeholder)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Appearance',
                                                                            key: 'min_label',
                                                                            label: 'Min Label',
                                                                            metaKey: 'min_label',
                                                                            visible: selectedField.type === 'rating_scale',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.min_label || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { min_label: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="e.g. Very Difficult"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.min_label)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Appearance',
                                                                            key: 'max_label',
                                                                            label: 'Max Label',
                                                                            metaKey: 'max_label',
                                                                            visible: selectedField.type === 'rating_scale',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.max_label || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { max_label: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="e.g. Very Easy"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.max_label)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },

                                                                        // --- Data ---
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'bindKey',
                                                                            label: 'Bind Key',
                                                                            metaKey: 'bindKey',
                                                                            visible: true,
                                                                            render: () => (
                                                                                <div className="relative w-full h-full flex items-center">
                                                                                    <Terminal className="absolute left-1.5 w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                                                                    <input
                                                                                        value={selectedField.id}
                                                                                        onChange={(e) => updateFieldId(selectedField.id, e.target.value)}
                                                                                        className="w-full h-full bg-transparent pl-7 pr-1.5 py-0 border-0 outline-none font-mono text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                        onFocus={() => setHoveredProperty(propertyMetaDetails.bindKey)}
                                                                                        onBlur={() => setHoveredProperty(null)}
                                                                                    />
                                                                                </div>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'catalogKey',
                                                                            label: 'Catalog Key',
                                                                            metaKey: undefined as any,
                                                                            visible: formMeta?.kind === 'catalog' && CATALOG_DESIGNATABLE_FIELD_TYPES.has(selectedField.type),
                                                                            render: () => {
                                                                                const isKey = formMeta?.catalog_key_field_id === selectedField.id;
                                                                                return (
                                                                                    <div className="flex items-center justify-between w-full">
                                                                                        <span className="text-[10px] text-[hsl(var(--text-tertiary))] italic leading-none max-w-[70%]">
                                                                                            Designate as unique record ID
                                                                                        </span>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isKey}
                                                                                            onChange={async (e) => {
                                                                                                const checked = e.target.checked;
                                                                                                const nextKeyId = checked ? selectedField.id : null;
                                                                                                try {
                                                                                                    await formAPI.updateCatalogDesignations(formId!, {
                                                                                                        catalog_key_field_id: nextKeyId,
                                                                                                        catalog_label_field_id: formMeta?.catalog_label_field_id
                                                                                                    });
                                                                                                    setFormMeta(prev => prev ? {
                                                                                                        ...prev,
                                                                                                        catalog_key_field_id: nextKeyId
                                                                                                    } : null);
                                                                                                    if (checked) {
                                                                                                        updateField(selectedField.id, { required: true });
                                                                                                    }
                                                                                                    showToast('Designation updated', 'Catalog Key updated successfully.', 'success');
                                                                                                } catch (err) {
                                                                                                    console.error(err);
                                                                                                    showToast('Error', 'Failed to update catalog designation.', 'error');
                                                                                                }
                                                                                            }}
                                                                                            className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'catalogLabel',
                                                                            label: 'Display Label',
                                                                            metaKey: undefined as any,
                                                                            visible: formMeta?.kind === 'catalog' && CATALOG_DESIGNATABLE_FIELD_TYPES.has(selectedField.type),
                                                                            render: () => {
                                                                                const isLabel = formMeta?.catalog_label_field_id === selectedField.id;
                                                                                return (
                                                                                    <div className="flex items-center justify-between w-full">
                                                                                        <span className="text-[10px] text-[hsl(var(--text-tertiary))] italic leading-none max-w-[70%]">
                                                                                            Designate as field dropdown label
                                                                                        </span>
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={isLabel}
                                                                                            onChange={async (e) => {
                                                                                                const checked = e.target.checked;
                                                                                                const nextLabelId = checked ? selectedField.id : null;
                                                                                                try {
                                                                                                    await formAPI.updateCatalogDesignations(formId!, {
                                                                                                        catalog_key_field_id: formMeta?.catalog_key_field_id,
                                                                                                        catalog_label_field_id: nextLabelId
                                                                                                    });
                                                                                                    setFormMeta(prev => prev ? {
                                                                                                        ...prev,
                                                                                                        catalog_label_field_id: nextLabelId
                                                                                                    } : null);
                                                                                                    if (checked) {
                                                                                                        updateField(selectedField.id, { required: true });
                                                                                                    }
                                                                                                    showToast('Designation updated', 'Display Label updated successfully.', 'success');
                                                                                                } catch (err) {
                                                                                                    console.error(err);
                                                                                                    showToast('Error', 'Failed to update catalog designation.', 'error');
                                                                                                }
                                                                                            }}
                                                                                            className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'choices',
                                                                            label: 'Choices Setup',
                                                                            metaKey: 'choices',
                                                                            visible: ['dropdown', 'radio_group', 'checkbox_group'].includes(selectedField.type),
                                                                            render: () => (
                                                                                    <ChoicesSetupInput
                                                                                        selectedField={selectedField}
                                                                                        sections={sections}
                                                                                        updateField={updateField}
                                                                                    />
                                                                                )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'binaryLabels',
                                                                            label: 'Binary Options',
                                                                            metaKey: 'binaryLabels',
                                                                            visible: selectedField.type === 'toggle',
                                                                            render: () => {
                                                                                const currentYes = selectedField.options?.find(o => o.value === 'true')?.label || 'Yes';
                                                                                const currentNo = selectedField.options?.find(o => o.value === 'false')?.label || 'No';
                                                                                return (
                                                                                    <div className="flex gap-2 w-full select-text">
                                                                                        <div className="flex items-center gap-1 flex-1">
                                                                                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold">YES:</span>
                                                                                            <input
                                                                                                value={currentYes}
                                                                                                onChange={(e) => {
                                                                                                    const nextOpts = [
                                                                                                        { label: e.target.value || 'Yes', value: 'true' },
                                                                                                        { label: currentNo, value: 'false' }
                                                                                                    ];
                                                                                                    updateField(selectedField.id, { options: nextOpts });
                                                                                                }}
                                                                                                className="w-full bg-[hsl(var(--surface-elevated))]/40 border border-[hsl(var(--border))]/40 rounded px-1 py-0.5 text-xs outline-none focus:border-[hsl(var(--primary))]/60 text-[hsl(var(--text-primary))]"
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1 flex-1">
                                                                                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] font-bold">NO:</span>
                                                                                            <input
                                                                                                value={currentNo}
                                                                                                onChange={(e) => {
                                                                                                    const nextOpts = [
                                                                                                        { label: currentYes, value: 'true' },
                                                                                                        { label: e.target.value || 'No', value: 'false' }
                                                                                                    ];
                                                                                                    updateField(selectedField.id, { options: nextOpts });
                                                                                                }}
                                                                                                className="w-full bg-[hsl(var(--surface-elevated))]/40 border border-[hsl(var(--border))]/40 rounded px-1 py-0.5 text-xs outline-none focus:border-[hsl(var(--primary))]/60 text-[hsl(var(--text-primary))]"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'object_schema_key',
                                                                            label: 'Schema ID',
                                                                            metaKey: 'object_schema_key',
                                                                            visible: ['object_collection', 'object_instance'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.object_schema_key || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { object_schema_key: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded font-mono text-[hsl(var(--text-primary))]"
                                                                                    placeholder="schema_key"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.object_schema_key)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'catalog_source_type',
                                                                            label: 'Catalog Source',
                                                                            metaKey: 'catalog_source_type',
                                                                            visible: ['object_collection', 'object_instance'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.catalog_source_type || ''}
                                                                                    onChange={(e) => {
                                                                                        const nextValue = e.target.value === 'project_catalog' ? 'project_catalog' : undefined;
                                                                                        let patch: any = { catalog_source_type: nextValue };
                                                                                        if (nextValue === 'project_catalog') {
                                                                                            const currentDef: any = selectedField.object_definition || {};
                                                                                            const currentProps = currentDef.properties || [];
                                                                                            if (currentProps.length === 0) {
                                                                                                patch.object_definition = {
                                                                                                    ...currentDef,
                                                                                                    properties: [
                                                                                                        {
                                                                                                            key: 'product',
                                                                                                            label: 'Product',
                                                                                                            type: 'select',
                                                                                                            edit_mode: 'editable',
                                                                                                            required: true,
                                                                                                            reference: {
                                                                                                                source_type: 'catalog',
                                                                                                                field_mappings: {}
                                                                                                            }
                                                                                                        },
                                                                                                        {
                                                                                                            key: 'quantity',
                                                                                                            label: 'Quantity',
                                                                                                            type: 'integer',
                                                                                                            edit_mode: 'editable',
                                                                                                            default_value: 0
                                                                                                        },
                                                                                                        {
                                                                                                            key: 'unit_price',
                                                                                                            label: 'Unit Price',
                                                                                                            type: 'decimal',
                                                                                                            edit_mode: 'fixed'
                                                                                                        },
                                                                                                        {
                                                                                                            key: 'total',
                                                                                                            label: 'Total',
                                                                                                            type: 'computed',
                                                                                                            formula: 'quantity * unit_price'
                                                                                                        }
                                                                                                    ]
                                                                                                };
                                                                                            }
                                                                                        }
                                                                                        updateField(selectedField.id, patch);
                                                                                    }}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.catalog_source_type)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                >
                                                                                    <option value="">None / Custom Row</option>
                                                                                    <option value="project_catalog">Project Catalog</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'collection_layout',
                                                                            label: 'Layout Style',
                                                                            metaKey: 'collection_layout',
                                                                            visible: selectedField.type === 'object_collection',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.collection_layout || 'cards'}
                                                                                    onChange={(e) => updateField(selectedField.id, { collection_layout: e.target.value as 'cards' | 'table' })}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value="cards">Cards List</option>
                                                                                    <option value="table">Table Rows</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'catalog_prepopulate_mode',
                                                                            label: 'Prepopulate Format',
                                                                            visible: ['object_collection', 'object_instance'].includes(selectedField.type) && selectedField.catalog_source_type === 'project_catalog',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.catalog_prepopulate_mode || 'all'}
                                                                                    onChange={(e) => updateField(selectedField.id, { catalog_prepopulate_mode: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value="all">All Catalog Items</option>
                                                                                    <option value="required_only">Mandatory Items Only</option>
                                                                                    <option value="none">None - Start Empty</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'range_type',
                                                                            label: 'Range Type',
                                                                            metaKey: 'range_type',
                                                                            visible: selectedField.type === 'generic_range',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.range_type || 'NUMBER'}
                                                                                    onChange={(e) => {
                                                                                        const newRangeType = e.target.value as any;
                                                                                        const isNewTemporal = ['DATE', 'DATETIME', 'TIME'].includes(newRangeType);
                                                                                        const updates: any = { range_type: newRangeType };
                                                                                        if (!isNewTemporal) {
                                                                                            updates.step_unit = 'NONE';
                                                                                        } else if (newRangeType === 'DATE' && ['MINUTE', 'HOUR'].includes(selectedField.step_unit || '')) {
                                                                                            updates.step_unit = 'NONE';
                                                                                        }
                                                                                        updateField(selectedField.id, updates);
                                                                                    }}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value="NUMBER">Number</option>
                                                                                    <option value="INTEGER">Integer</option>
                                                                                    <option value="DATE">Date</option>
                                                                                    <option value="DATETIME">Datetime</option>
                                                                                    <option value="TIME">Time (HH:MM)</option>
                                                                                    <option value="WEEKDAY">Weekday</option>
                                                                                    <option value="MONTH">Month</option>
                                                                                    <option value="INDEX">Index Scale</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'step_value',
                                                                            label: 'Step Value',
                                                                            metaKey: 'step_value',
                                                                            visible: selectedField.type === 'generic_range',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.step_value || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { step_value: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="e.g. 1"
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'step_unit',
                                                                            label: 'Step Unit',
                                                                            metaKey: 'step_unit',
                                                                            visible: selectedField.type === 'generic_range',
                                                                            render: () => {
                                                                                const rt = selectedField.range_type || 'NUMBER';
                                                                                const allowedUnits = (() => {
                                                                                    if (!['DATE', 'DATETIME', 'TIME'].includes(rt)) {
                                                                                        return [{ value: 'NONE', label: 'None' }];
                                                                                    }
                                                                                    if (rt === 'DATE') {
                                                                                        return [
                                                                                            { value: 'NONE', label: 'None' },
                                                                                            { value: 'DAY', label: 'Day' },
                                                                                            { value: 'WEEK', label: 'Week' },
                                                                                            { value: 'MONTH', label: 'Month' },
                                                                                            { value: 'YEAR', label: 'Year' },
                                                                                        ];
                                                                                    }
                                                                                    return [
                                                                                        { value: 'NONE', label: 'None' },
                                                                                        { value: 'MINUTE', label: 'Minute' },
                                                                                        { value: 'HOUR', label: 'Hour' },
                                                                                        { value: 'DAY', label: 'Day' },
                                                                                        { value: 'WEEK', label: 'Week' },
                                                                                        { value: 'MONTH', label: 'Month' },
                                                                                        { value: 'YEAR', label: 'Year' },
                                                                                    ];
                                                                                })();

                                                                                return (
                                                                                    <select
                                                                                        value={selectedField.step_unit || 'NONE'}
                                                                                        onChange={(e) => updateField(selectedField.id, { step_unit: e.target.value as any })}
                                                                                        className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                    >
                                                                                        {allowedUnits.map(unit => (
                                                                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'default_value',
                                                                            label: 'Default Value',
                                                                            metaKey: 'default_value',
                                                                            visible: !['matrix_table', 'object_collection', 'object_instance'].includes(selectedField.type),
                                                                            render: () => {
                                                                                if (['dropdown', 'radio_group'].includes(selectedField.type)) {
                                                                                    return (
                                                                                        <select
                                                                                            value={selectedField.default_value || ''}
                                                                                            onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                                            className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                            onFocus={() => setHoveredProperty(propertyMetaDetails.default_value)}
                                                                                            onBlur={() => setHoveredProperty(null)}
                                                                                        >
                                                                                            <option value="">None</option>
                                                                                            {(selectedField.options || []).map((o, idx) => (
                                                                                                <option key={idx} value={o.value}>{o.label}</option>
                                                                                            ))}
                                                                                        </select>
                                                                                    );
                                                                                }
                                                                                if (selectedField.type === 'toggle') {
                                                                                    return (
                                                                                        <div className="flex gap-1 w-full">
                                                                                            <button
                                                                                                onClick={() => updateField(selectedField.id, { default_value: selectedField.default_value === 'true' ? undefined : 'true' })}
                                                                                                className={`flex-1 py-0.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded border transition-all ${
                                                                                                    selectedField.default_value === 'true'
                                                                                                        ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                                                                        : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                                }`}
                                                                                            >
                                                                                                {selectedField.options?.find(o => o.value === 'true')?.label ?? 'Yes'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => updateField(selectedField.id, { default_value: selectedField.default_value === 'false' ? undefined : 'false' })}
                                                                                                className={`flex-1 py-0.5 px-2 text-[10px] font-bold uppercase tracking-wider rounded border transition-all ${
                                                                                                    selectedField.default_value === 'false'
                                                                                                        ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                                                                        : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                                }`}
                                                                                            >
                                                                                                {selectedField.options?.find(o => o.value === 'false')?.label ?? 'No'}
                                                                                            </button>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (selectedField.type === 'textarea') {
                                                                                    return (
                                                                                        <input
                                                                                            value={selectedField.default_value || ''}
                                                                                            onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                                            className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                            placeholder="Default text..."
                                                                                            onFocus={() => setHoveredProperty(propertyMetaDetails.default_value)}
                                                                                            onBlur={() => setHoveredProperty(null)}
                                                                                        />
                                                                                    );
                                                                                }
                                                                                return (
                                                                                    <input
                                                                                        type={['input_number', 'lookup_list'].includes(selectedField.type) ? 'number' : selectedField.type === 'date_picker' ? 'date' : selectedField.type === 'time_picker' ? 'time' : 'text'}
                                                                                        value={selectedField.default_value || ''}
                                                                                        onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                                        className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                        placeholder={selectedField.type === 'input_text' ? "e.g. Ghana..." : selectedField.type === 'lookup_list' ? "Index e.g. 0..." : ""}
                                                                                        onFocus={() => setHoveredProperty(propertyMetaDetails.default_value)}
                                                                                        onBlur={() => setHoveredProperty(null)}
                                                                                    />
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'object_schema_key',
                                                                            label: 'Schema ID',
                                                                            metaKey: 'object_schema_key',
                                                                            visible: ['object_collection', 'object_instance'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.object_schema_key || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { object_schema_key: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="e.g. store_products"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.object_schema_key)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data',
                                                                            key: 'object_properties',
                                                                            label: 'Row Properties',
                                                                            metaKey: 'object_properties',
                                                                            visible: ['object_collection', 'object_instance'].includes(selectedField.type),
                                                                            render: () => (
                                                                                    <ObjectPropertiesInput
                                                                                        selectedObjectProperties={selectedObjectProperties}
                                                                                        addSelectedObjectProperty={addSelectedObjectProperty}
                                                                                        removeSelectedObjectProperty={removeSelectedObjectProperty}
                                                                                        updateSelectedObjectProperty={updateSelectedObjectProperty}
                                                                                    />
                                                                                )
                                                                        },

                                                                        // --- Validation ---
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'required',
                                                                            label: 'Required',
                                                                            metaKey: 'required',
                                                                            visible: true,
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedField.required}
                                                                                    onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.required)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'minLength',
                                                                            label: 'Min Length',
                                                                            metaKey: 'minLength',
                                                                            visible: ['input_text', 'email_input', 'phone_input', 'textarea'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    type="number"
                                                                                    value={selectedField.minLength || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { minLength: parseInt(e.target.value) || undefined })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="No limit"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.minLength)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'maxLength',
                                                                            label: 'Max Length',
                                                                            metaKey: 'maxLength',
                                                                            visible: ['input_text', 'email_input', 'phone_input', 'textarea'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    type="number"
                                                                                    value={selectedField.maxLength || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { maxLength: parseInt(e.target.value) || undefined })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="No limit"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.maxLength)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'min',
                                                                            label: 'Min Boundary',
                                                                            metaKey: 'min',
                                                                            visible: ['input_number', 'rating_scale', 'date_picker', 'time_picker'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    type={selectedField.type === 'date_picker' ? 'date' : selectedField.type === 'time_picker' ? 'time' : 'number'}
                                                                                    value={selectedField.min || ''}
                                                                                    onChange={(e) => {
                                                                                        const val = ['date_picker', 'time_picker'].includes(selectedField.type) ? e.target.value : parseInt(e.target.value);
                                                                                        updateField(selectedField.id, { min: val || undefined });
                                                                                    }}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="Minimum"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.min)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'max',
                                                                            label: 'Max Boundary',
                                                                            metaKey: 'max',
                                                                            visible: ['input_number', 'rating_scale', 'date_picker', 'time_picker'].includes(selectedField.type),
                                                                            render: () => (
                                                                                <input
                                                                                    type={selectedField.type === 'date_picker' ? 'date' : selectedField.type === 'time_picker' ? 'time' : 'number'}
                                                                                    value={selectedField.max || ''}
                                                                                    onChange={(e) => {
                                                                                        const val = ['date_picker', 'time_picker'].includes(selectedField.type) ? e.target.value : parseInt(e.target.value);
                                                                                        updateField(selectedField.id, { max: val || undefined });
                                                                                    }}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded text-[hsl(var(--text-primary))]"
                                                                                    placeholder="Maximum"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.max)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'is_sensitive',
                                                                            label: 'Sensitive PII',
                                                                            metaKey: 'is_sensitive',
                                                                            visible: selectedField.type !== 'matrix_table',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={!!selectedField.is_sensitive}
                                                                                    onChange={(e) => updateField(selectedField.id, { is_sensitive: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.is_sensitive)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'exclude_from_export',
                                                                            label: 'Exclude Export',
                                                                            metaKey: 'exclude_from_export',
                                                                            visible: selectedField.type !== 'matrix_table',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={!!selectedField.exclude_from_export}
                                                                                    onChange={(e) => updateField(selectedField.id, { exclude_from_export: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.exclude_from_export)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'allow_add_items',
                                                                            label: 'Allow Add Rows',
                                                                            metaKey: 'object_properties',
                                                                            visible: selectedField.type === 'object_collection',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedField.allow_add_items ?? true}
                                                                                    onChange={(e) => updateField(selectedField.id, { allow_add_items: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Validation',
                                                                            key: 'allow_remove_items',
                                                                            label: 'Allow Del Rows',
                                                                            metaKey: 'object_properties',
                                                                            visible: selectedField.type === 'object_collection',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedField.allow_remove_items ?? true}
                                                                                    onChange={(e) => updateField(selectedField.id, { allow_remove_items: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                />
                                                                            )
                                                                        },

                                                                        // --- Behavior ---
                                                                        {
                                                                            category: 'Behavior',
                                                                            key: 'mask',
                                                                            label: 'Input Mask',
                                                                            metaKey: 'mask',
                                                                            visible: selectedField.type === 'input_text',
                                                                            render: () => {
                                                                                const presets = [
                                                                                    { label: 'None', val: '' },
                                                                                    { label: 'US Phone', val: '(999) 999-9999' },
                                                                                    { label: 'Date', val: '99/99/9999' },
                                                                                    { label: 'SSN', val: '999-99-9999' },
                                                                                ];
                                                                                return (
                                                                                    <div className="w-full space-y-1 py-1">
                                                                                        <select
                                                                                            value={selectedField.mask || ''}
                                                                                            onChange={(e) => updateField(selectedField.id, { mask: e.target.value || undefined })}
                                                                                            className="w-full bg-[hsl(var(--surface-elevated))]/40 border border-[hsl(var(--border))]/40 rounded px-1 py-0.5 text-xs outline-none text-[hsl(var(--text-primary))]"
                                                                                            onFocus={() => setHoveredProperty(propertyMetaDetails.mask)}
                                                                                            onBlur={() => setHoveredProperty(null)}
                                                                                        >
                                                                                            {presets.map(p => (
                                                                                                <option key={p.label} value={p.val}>{p.label} {p.val ? `(${p.val})` : ''}</option>
                                                                                            ))}
                                                                                            {selectedField.mask && !presets.map(p => p.val).includes(selectedField.mask) && (
                                                                                                <option value={selectedField.mask}>Custom ({selectedField.mask})</option>
                                                                                            )}
                                                                                        </select>
                                                                                        <input
                                                                                            value={selectedField.mask || ''}
                                                                                            onChange={(e) => updateField(selectedField.id, { mask: e.target.value || undefined })}
                                                                                            placeholder="Custom mask..."
                                                                                            className="w-full bg-[hsl(var(--surface-elevated))]/20 border border-[hsl(var(--border))]/40 rounded px-1.5 py-0.5 text-[10px] outline-none font-mono text-[hsl(var(--text-primary))]"
                                                                                        />
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Behavior',
                                                                            key: 'formula',
                                                                            label: 'Formula',
                                                                            metaKey: 'formula',
                                                                            visible: selectedField.type === 'input_number',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.formula || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { formula: e.target.value || undefined })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded font-mono text-[hsl(var(--text-primary))]"
                                                                                    placeholder="e.g. qty * price"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.formula)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Behavior',
                                                                            key: 'collection_layout',
                                                                            label: 'Layout Mode',
                                                                            metaKey: undefined as any,
                                                                            visible: selectedField.type === 'object_collection',
                                                                            render: () => (
                                                                                <div className="flex gap-1 bg-[hsl(var(--surface-elevated))]/60 p-0.5 rounded-lg border border-[hsl(var(--border))]/25 w-full">
                                                                                    {([
                                                                                        { val: 'cards', label: 'Cards' },
                                                                                        { val: 'table', label: 'Table' }
                                                                                    ] as const).map((mode) => {
                                                                                        const isActive = (selectedField.collection_layout || 'cards') === mode.val;
                                                                                        return (
                                                                                            <button
                                                                                                key={mode.val}
                                                                                                type="button"
                                                                                                onClick={() => updateField(selectedField.id, { collection_layout: mode.val })}
                                                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize transition-all flex-1 ${isActive
                                                                                                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                                                                                                    : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/80'
                                                                                                }`}
                                                                                            >
                                                                                                {mode.label}
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Behavior',
                                                                            key: 'catalog_source_type',
                                                                            label: 'Catalog-backed',
                                                                            metaKey: undefined as any,
                                                                            visible: selectedField.type === 'object_collection',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selectedField.catalog_source_type === 'project_catalog'}
                                                                                    onChange={(e) => updateField(selectedField.id, { catalog_source_type: e.target.checked ? 'project_catalog' : undefined })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                />
                                                                            )
                                                                        },

                                                                        // --- Matrix Setup ---
                                                                        {
                                                                            category: 'Matrix Setup',
                                                                            key: 'table_cell_type',
                                                                            label: 'Cell Type',
                                                                            metaKey: 'table_cell_type',
                                                                            visible: selectedField.type === 'matrix_table',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.table_cell_type || 'radio'}
                                                                                    onChange={(e) => updateField(selectedField.id, { table_cell_type: e.target.value as TableCellType })}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.table_cell_type)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                >
                                                                                    <option value="radio">Radio Buttons</option>
                                                                                    <option value="checkbox">Checkboxes</option>
                                                                                    <option value="text">Text Inputs</option>
                                                                                    <option value="number">Number Inputs</option>
                                                                                    <option value="dropdown">Dropdown Options</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Matrix Setup',
                                                                            key: 'table_allow_multiple',
                                                                            label: 'Allow Multi',
                                                                            metaKey: 'table_allow_multiple',
                                                                            visible: selectedField.type === 'matrix_table' && selectedField.table_cell_type === 'checkbox',
                                                                            render: () => (
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={!!selectedField.table_allow_multiple}
                                                                                    onChange={e => updateField(selectedField.id, { table_allow_multiple: e.target.checked })}
                                                                                    className="h-3.5 w-3.5 rounded border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]/20 cursor-pointer"
                                                                                    onFocus={() => setHoveredProperty(propertyMetaDetails.table_allow_multiple)}
                                                                                    onBlur={() => setHoveredProperty(null)}
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Matrix Setup',
                                                                            key: 'table_columns',
                                                                            label: 'Columns List',
                                                                            metaKey: 'table_columns',
                                                                            visible: selectedField.type === 'matrix_table',
                                                                            render: () => (
                                                                                    <TableColumnsInput
                                                                                        selectedField={selectedField}
                                                                                        updateField={updateField}
                                                                                    />
                                                                                )
                                                                        },
                                                                        {
                                                                            category: 'Matrix Setup',
                                                                            key: 'flip_rows_cols',
                                                                            label: '',
                                                                            metaKey: undefined as any,
                                                                            visible: selectedField.type === 'matrix_table',
                                                                            render: () => (
                                                                                <button
                                                                                    type="button"
                                                                                    title="Flip rows and columns"
                                                                                    onClick={() => {
                                                                                        const cols = (selectedField.table_columns || []) as TableColumn[];
                                                                                        const rows = (selectedField.table_rows || []) as TableRow[];
                                                                                        updateField(selectedField.id, {
                                                                                            table_columns: rows.map(r => ({ id: r.id, label: r.label })),
                                                                                            table_rows: cols.map(c => ({ id: c.id, label: c.label })),
                                                                                        });
                                                                                    }}
                                                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[hsl(var(--border))]/50 hover:border-[hsl(var(--primary))]/40 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--primary))]/5 transition-all text-[10px] font-semibold w-full justify-center"
                                                                                >
                                                                                    <ChevronsUpDown className="w-3.5 h-3.5 rotate-90" />
                                                                                    Flip Rows ↔ Columns
                                                                                </button>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Matrix Setup',
                                                                            key: 'table_rows',
                                                                            label: 'Rows List',
                                                                            metaKey: 'table_rows',
                                                                            visible: selectedField.type === 'matrix_table',
                                                                            render: () => (
                                                                                    <TableRowsInput
                                                                                        selectedField={selectedField}
                                                                                        updateField={updateField}
                                                                                    />
                                                                                )
                                                                        },

                                                                        // --- Data Source ---
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_source_type',
                                                                            label: 'Lookup Source',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.lookup_source_type || 'preset'}
                                                                                    onChange={(e) => updateField(selectedField.id, { lookup_source_type: e.target.value as 'preset' | 'custom' })}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value="preset">Preset Dataset</option>
                                                                                    <option value="custom">Custom CSV / Raw Text</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_preset_id',
                                                                            label: 'Dataset Preset',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list' && selectedField.lookup_source_type === 'preset',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.lookup_preset_id || ''}
                                                                                    onChange={(e) => updateField(selectedField.id, { lookup_preset_id: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                >
                                                                                    <option value="">Select a dataset preset...</option>
                                                                                    <option value="ghana_districts">Ghana Districts & Regions</option>
                                                                                    <option value="kenya_counties">Kenya Counties & Subcounties</option>
                                                                                    <option value="un_countries">ISO Standard Countries</option>
                                                                                    <option value="world_currencies">Global Currencies</option>
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_custom_data',
                                                                            label: 'CSV Custom Data',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list' && selectedField.lookup_source_type === 'custom',
                                                                            render: () => (
                                                                                    <LookupCustomDataInput
                                                                                        selectedField={selectedField}
                                                                                        updateField={updateField}
                                                                                    />
                                                                                )
                                                                        },
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_separator',
                                                                            label: 'CSV Separator',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list' && selectedField.lookup_source_type === 'custom',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.lookup_separator || ','}
                                                                                    onChange={(e) => updateField(selectedField.id, { lookup_separator: e.target.value })}
                                                                                    className="w-full h-full bg-transparent px-1.5 py-0 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded font-mono text-[hsl(var(--text-primary))]"
                                                                                    placeholder=","
                                                                                />
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_label_column',
                                                                            label: 'CSV Label Col',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list' && selectedField.lookup_source_type === 'custom',
                                                                            render: () => {
                                                                                const parsed = parseCustomLookupData(selectedField.lookup_custom_data || '', selectedField.lookup_separator || ',');
                                                                                return (
                                                                                    <select
                                                                                        value={selectedField.lookup_label_column ?? ''}
                                                                                        onChange={(e) => updateField(selectedField.id, { lookup_label_column: e.target.value })}
                                                                                        className="w-full h-full bg-transparent px-1 py-0.5 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                    >
                                                                                        <option value="">Select label...</option>
                                                                                        {parsed.headers.map((h) => (
                                                                                            <option key={h} value={h}>{h}</option>
                                                                                        ))}
                                                                                        {parsed.headers.map((_, idx) => (
                                                                                            <option key={`idx-${idx}`} value={idx + 1}>Column {idx + 1}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                );
                                                                            }
                                                                        },
                                                                        {
                                                                            category: 'Data Source',
                                                                            key: 'lookup_value_column',
                                                                            label: 'CSV Value Col',
                                                                            metaKey: 'lookup_source',
                                                                            visible: selectedField.type === 'lookup_list' && selectedField.lookup_source_type === 'custom',
                                                                            render: () => {
                                                                                const parsed = parseCustomLookupData(selectedField.lookup_custom_data || '', selectedField.lookup_separator || ',');
                                                                                return (
                                                                                    <select
                                                                                        value={selectedField.lookup_value_column ?? ''}
                                                                                        onChange={(e) => updateField(selectedField.id, { lookup_value_column: e.target.value })}
                                                                                        className="w-full h-full bg-transparent px-1 py-0.5 border-0 outline-none text-xs focus:ring-1 focus:ring-[hsl(var(--primary))]/30 rounded cursor-pointer text-[hsl(var(--text-primary))]"
                                                                                    >
                                                                                        <option value="">Select value...</option>
                                                                                        {parsed.headers.map((h) => (
                                                                                            <option key={h} value={h}>{h}</option>
                                                                                        ))}
                                                                                        {parsed.headers.map((_, idx) => (
                                                                                            <option key={`idx-${idx}`} value={idx + 1}>Column {idx + 1}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                );
                                                                            }
                                                                        },

                                                                        // --- System Settings ---
                                                                        {
                                                                            category: 'System Settings',
                                                                            key: 'platforms',
                                                                            label: 'Platforms',
                                                                            metaKey: 'platforms',
                                                                            visible: true,
                                                                            render: () => (
                                                                                <div className="flex gap-1">
                                                                                    {(['mobile', 'web', 'ussd'] as Platform[]).map(platform => {
                                                                                        const isActive = selectedField.platforms?.includes(platform) ?? false;
                                                                                        return (
                                                                                            <button
                                                                                                key={platform}
                                                                                                onClick={() => {
                                                                                                    const next = new Set(selectedField.platforms || []);
                                                                                                    if (isActive) next.delete(platform);
                                                                                                    else next.add(platform);
                                                                                                    updateField(selectedField.id, { platforms: Array.from(next) });
                                                                                                }}
                                                                                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                                                                                    isActive
                                                                                                        ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                                                                                        : 'border-[hsl(var(--border))] bg-transparent text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
                                                                                                }`}
                                                                                            >
                                                                                                {platform}
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )
                                                                        },
                                                                        // --- Form Link Settings ---
                                                                        {
                                                                            category: 'Form Link',
                                                                            key: 'linked_form_id',
                                                                            label: 'Linked Form',
                                                                            metaKey: 'linked_form_id',
                                                                            visible: selectedField.type === 'form_link',
                                                                            render: () => (
                                                                                <select
                                                                                    value={selectedField.linked_form_id || ''}
                                                                                    onChange={e => {
                                                                                        const selectedId = e.target.value;
                                                                                        const match = projectForms.find(f => f.id === selectedId);
                                                                                        updateField(selectedField.id, {
                                                                                            linked_form_id: selectedId || undefined,
                                                                                            linked_form_slug: match?.slug || selectedField.linked_form_slug,
                                                                                        });
                                                                                    }}
                                                                                    onFocus={() => setHoveredProperty(null)}
                                                                                    className="w-full text-[11px] px-1.5 py-1 rounded border bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] outline-none"
                                                                                >
                                                                                    <option value="">— Select a form —</option>
                                                                                    {projectForms.map(f => (
                                                                                        <option key={f.id} value={f.id}>{f.title}</option>
                                                                                    ))}
                                                                                </select>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Form Link',
                                                                            key: 'linked_form_slug',
                                                                            label: 'Linked Form Slug',
                                                                            metaKey: 'linked_form_slug',
                                                                            visible: selectedField.type === 'form_link',
                                                                            render: () => (
                                                                                <input
                                                                                    value={selectedField.linked_form_slug || ''}
                                                                                    onChange={e => updateField(selectedField.id, { linked_form_slug: e.target.value })}
                                                                                    onFocus={() => setHoveredProperty(null)}
                                                                                    className="w-full text-[11px] px-1.5 py-1 rounded border bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))] outline-none"
                                                                                    placeholder="slug of target form"
                                                                                />
                                                                            )
                                                                        },

                                                                        // --- Input Parameter Settings ---
                                                                        {
                                                                            category: 'Navigation',
                                                                            key: 'is_input_param',
                                                                            label: 'Is Input Parameter',
                                                                            metaKey: 'is_input_param',
                                                                            visible: selectedField.type !== 'form_link',
                                                                            render: () => (
                                                                                <button
                                                                                    onClick={() => updateField(selectedField.id, { is_input_param: !selectedField.is_input_param })}
                                                                                    className={`w-7 h-4 rounded-full transition-colors ${selectedField.is_input_param ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--surface-elevated))]'}`}
                                                                                >
                                                                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${selectedField.is_input_param ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                                                </button>
                                                                            )
                                                                        },
                                                                        {
                                                                            category: 'Navigation',
                                                                            key: 'input_param_readonly',
                                                                            label: 'Lock When Pre-filled',
                                                                            metaKey: 'input_param_readonly',
                                                                            visible: selectedField.is_input_param === true,
                                                                            render: () => (
                                                                                <button
                                                                                    onClick={() => updateField(selectedField.id, { input_param_readonly: !selectedField.input_param_readonly })}
                                                                                    className={`w-7 h-4 rounded-full transition-colors ${selectedField.input_param_readonly ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--surface-elevated))]'}`}
                                                                                >
                                                                                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${selectedField.input_param_readonly ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                                                </button>
                                                                            )
                                                                        },
                                                                    ];

                                                                                                                                         const categories = ['Appearance', 'Data', 'Logic & Events', 'Validation', 'Behavior', 'Matrix Setup', 'Data Source', 'Form Link', 'Navigation', 'System Settings'].filter(cat => !(formMeta?.kind === 'catalog' && cat === 'Logic & Events'));

                                                                     return (
                                                                         <div className="overflow-y-auto hide-scrollbar border-b border-[hsl(var(--border))]/25 bg-[hsl(var(--background))]">
                                                                             {categories.map(categoryName => {
                                                                                 const isCollapsed = !!collapsedPropCategories[categoryName];

                                                                                 if (categoryName === 'Logic & Events') {
                                                                                     const preRulesCount = formRules.filter(r => r.trigger_id === selectedField.id && r.timing === 'pre').length;
                                                                                     const postRulesCount = formRules.filter(r => r.trigger_id === selectedField.id && r.timing === 'post').length;
                                                                                     return (
                                                                                         <div key={categoryName} className="border-b border-[hsl(var(--border))]/30 last:border-b-0">
                                                                                             <button
                                                                                                 type="button"
                                                                                                 onClick={() => setCollapsedPropCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                                                                                                 className="w-full flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/45 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] select-none border-b border-[hsl(var(--border))]/25 transition-all"
                                                                                             >
                                                                                                 <div className="flex items-center gap-1.5">
                                                                                                     <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                                                     <span>{categoryName}</span>
                                                                                                 </div>
                                                                                             </button>

                                                                                             {!isCollapsed && (
                                                                                                 <div className="p-4 bg-[hsl(var(--surface))] space-y-3 border-t border-[hsl(var(--border))]/20">
                                                                                                     <button
                                                                                                         type="button"
                                                                                                         onClick={() => {
                                                                                                             setRulesModalContext({
                                                                                                                 triggerId: selectedField.id,
                                                                                                                 triggerType: 'field',
                                                                                                                 timing: 'pre',
                                                                                                                 label: selectedField.label || selectedField.id
                                                                                                             });
                                                                                                             setIsRulesModalOpen(true);
                                                                                                         }}
                                                                                                         className="w-full flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80 border border-[hsl(var(--border))]/20 rounded-xl transition-all"
                                                                                                     >
                                                                                                         <div className="flex flex-col items-start text-left">
                                                                                                             <span className="text-xs font-semibold text-[hsl(var(--text-primary))]">⚡ Pre-Render Logic (Pre)</span>
                                                                                                             <span className="text-[9px] text-[hsl(var(--text-tertiary))]">Triggered before field loads</span>
                                                                                                         </div>
                                                                                                         <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">
                                                                                                             {preRulesCount} Rules
                                                                                                         </span>
                                                                                                     </button>
                                                                                                     <button
                                                                                                         type="button"
                                                                                                         onClick={() => {
                                                                                                             setRulesModalContext({
                                                                                                                 triggerId: selectedField.id,
                                                                                                                 triggerType: 'field',
                                                                                                                 timing: 'post',
                                                                                                                 label: selectedField.label || selectedField.id
                                                                                                             });
                                                                                                             setIsRulesModalOpen(true);
                                                                                                         }}
                                                                                                         className="w-full flex items-center justify-between px-3 py-2.5 bg-[hsl(var(--surface-elevated))]/40 hover:bg-[hsl(var(--surface-elevated))]/80 border border-[hsl(var(--border))]/20 rounded-xl transition-all"
                                                                                                     >
                                                                                                         <div className="flex flex-col items-start text-left">
                                                                                                             <span className="text-xs font-semibold text-[hsl(var(--text-primary))]">⚡ Post-Exit Logic (Post)</span>
                                                                                                             <span className="text-[9px] text-[hsl(var(--text-tertiary))]">Triggered on navigation/exit</span>
                                                                                                         </div>
                                                                                                         <span className="text-[10px] font-bold text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">
                                                                                                             {postRulesCount} Rules
                                                                                                         </span>
                                                                                                     </button>
                                                                                                 </div>
                                                                                             )}
                                                                                         </div>
                                                                                     );
                                                                                 }

                                                                                 const categoryRows = allPropRows.filter(r => r.category === categoryName && r.visible);
                                                                                if (categoryRows.length === 0) return null;

                                                                                return (
                                                                                    <div key={categoryName} className="border-b border-[hsl(var(--border))]/30 last:border-b-0">
                                                                                        <button
                                                                                            onClick={() => setCollapsedPropCategories(prev => ({ ...prev, [categoryName]: !prev[categoryName] }))}
                                                                                            className="w-full flex items-center justify-between px-4 py-2 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/45 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] select-none border-b border-[hsl(var(--border))]/25 transition-all"
                                                                                        >
                                                                                            <div className="flex items-center gap-1.5">
                                                                                                <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                                                                <span>{categoryName}</span>
                                                                                            </div>
                                                                                        </button>

                                                                                        {!isCollapsed && (
                                                                                            <div className="divide-y divide-[hsl(var(--border))]/20 bg-[hsl(var(--surface))]">
                                                                                                {categoryRows.map(row => {
                                                                                                    if (row.key === 'choices' || row.key === 'flip_rows_cols') {
                                                                                                        return (
                                                                                                            <div
                                                                                                                key={row.key}
                                                                                                                className="w-full flex flex-col bg-[hsl(var(--surface))] border-b border-[hsl(var(--border))]/20 last:border-b-0"
                                                                                                            >
                                                                                                                {row.render()}
                                                                                                            </div>
                                                                                                        );
                                                                                                    }
                                                                                                    return (
                                                                                                        <div
                                                                                                            key={row.key}
                                                                                                            onMouseEnter={() => row.metaKey && propertyMetaDetails[row.metaKey] && setHoveredProperty(propertyMetaDetails[row.metaKey])}
                                                                                                            onMouseLeave={() => setHoveredProperty(null)}
                                                                                                            className="flex items-center min-h-[32px] hover:bg-[hsl(var(--surface-elevated))]/20 transition-colors"
                                                                                                        >
                                                                                                            <div className="w-[40%] px-4 truncate select-none border-r border-[hsl(var(--border))]/20 text-[hsl(var(--text-secondary))] font-medium text-[11px] flex items-center py-1 self-stretch">
                                                                                                                {row.label}
                                                                                                            </div>
                                                                                                            <div className="w-[60%] pl-3 pr-4 py-1 text-[11px] flex items-center min-w-0">
                                                                                                                {row.render()}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                                                                                 })()}
                                                     </div>
                                                {/* Description Helper Panel */}
                                                    <div className="h-[100px] border-t border-[hsl(var(--border))]/45 bg-[hsl(var(--surface-elevated))]/40 p-3 select-none flex flex-col justify-between shrink-0">
                                                        {hoveredProperty ? (
                                                            <div className="animate-in fade-in duration-150">
                                                                <p className="text-xs font-bold text-[hsl(var(--text-primary))] flex items-center">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] mr-1.5" />
                                                                    {hoveredProperty.name}
                                                                </p>
                                                                <p className="text-[10px] text-[hsl(var(--text-secondary))] mt-1 leading-normal line-clamp-3">
                                                                    {hoveredProperty.description}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <div className="flex h-full items-center justify-center text-[10px] text-[hsl(var(--text-tertiary))] italic">
                                                                Hover over a property name to view description.
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
                                                    <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--surface-elevated))]/60 border border-[hsl(var(--border))]/40 flex items-center justify-center text-[hsl(var(--text-tertiary))] mb-4 shadow-sm">
                                                        <Type className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-primary))]">No Widget Selected</h4>
                                                    <p className="mt-2 text-xs text-[hsl(var(--text-secondary))] max-w-[200px] leading-relaxed">
                                                        Click on any widget card in the canvas to view and configure its properties.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ─── FLOATING CONSOLE WINDOW ─── */}
                        {isConsoleOpen && (
                            <div ref={consoleWindowRef} className="absolute top-3 bottom-4 right-20 z-50 w-96 border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface))] flex flex-col overflow-hidden rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55 px-4 py-3 shrink-0">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Builder Panel</p>
                                            <h3 className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">Form Console</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                {view === 'flow' ? 'flow' : 'inspector'}
                                            </div>
                                            <button
                                                onClick={() => setIsConsoleOpen(false)}
                                                className="p-1.5 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg transition-colors"
                                                title="Close Console"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]/90 backdrop-blur-sm shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ${hasUnsavedChanges ? 'bg-[hsl(var(--warning))] animate-pulse' : 'bg-[hsl(var(--success))]'}`} />
                                            <span className="text-[11px] font-semibold text-[hsl(var(--text-secondary))]">{hasUnsavedChanges ? 'Unsaved Changes' : 'All Saved'}</span>
                                        </div>
                                        <div className="ml-auto flex items-center gap-2">
                                            <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${
                                                formMeta?.status === 'live'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                            }`}>
                                                {formMeta?.status || 'draft'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto hide-scrollbar divide-y divide-[hsl(var(--border))]/40">
                                    {/* Form Actions (Save & Publish) */}
                                    <div className="p-4 space-y-3 bg-[hsl(var(--surface-elevated))]/10">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] mb-1 select-none">Form Actions</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className={`py-2 px-3 rounded-lg border font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                                    hasUnsavedChanges
                                                        ? 'bg-[hsl(var(--primary))] text-white border-transparent hover:bg-[hsl(var(--primary))]/90 hover:scale-[1.01] active:scale-[0.99]'
                                                        : 'bg-[hsl(var(--surface-elevated))]/50 text-[hsl(var(--text-tertiary))] border-[hsl(var(--border))]/60 hover:text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/80'
                                                } disabled:opacity-50 disabled:pointer-events-none`}
                                                title="Save working draft to cloud"
                                            >
                                                {isSaving ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Save className="w-3.5 h-3.5" />
                                                )}
                                                <span>{hasUnsavedChanges ? 'Save Changes' : 'Saved'}</span>
                                            </button>

                                            <button
                                                onClick={_handlePublish}
                                                disabled={isPublishing || isSaving}
                                                className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-transparent font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none"
                                                title="Publish current draft live"
                                            >
                                                {isPublishing ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Globe className="w-3.5 h-3.5" />
                                                )}
                                                <span>Publish Live</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Simulate Buttons */}
                                    <div className="p-4 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] mb-1 select-none">Simulation</p>
                                        <button
                                            onClick={() => navigate(`/simulator/${formId}`)}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors rounded-lg flex items-center space-x-2 border border-[hsl(var(--border))]/40"
                                        >
                                            <Play className="w-4 h-4 text-[hsl(var(--primary))]" />
                                            <span>Run From Beginning</span>
                                        </button>
                                        {view === 'section' && (
                                            <button
                                                onClick={() => navigate(`/simulator/${formId}?section=${currentSectionId}`)}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors rounded-lg flex items-center space-x-2 border border-[hsl(var(--border))]/40"
                                            >
                                                <Layers className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                <span>Run Current Section</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Backup Slots */}
                                    <div className="p-4 space-y-2.5">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] mb-1 select-none">Backup & Restore</p>
                                        <div className="space-y-2">
                                            {([2, 3] as const).map(slot => {
                                                const slotName = slot === 2 ? 'Slot A' : 'Slot B';
                                                const version = getSlotVersion(slot);
                                                const hasBackup = !!version;
                                                return (
                                                    <div key={slot} className="flex items-center justify-between p-2 rounded-lg border border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/20">
                                                        <div className="min-w-0">
                                                            <span className="font-semibold text-[hsl(var(--text-primary))] text-xs">{slotName}</span>
                                                            <span className="block text-[9px] text-[hsl(var(--text-tertiary))] truncate mt-0.5">
                                                                {hasBackup 
                                                                    ? `Saved v${version.version_number} • ${new Date(version.created_at || '').toLocaleTimeString()}` 
                                                                    : 'Empty slot'}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => _handleSaveToBackup(slot)}
                                                                disabled={isSaving}
                                                                className="px-2 py-1 text-[10px] font-semibold rounded bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] border border-[hsl(var(--border))]/60 transition-colors disabled:opacity-50"
                                                                title={`Save current state to ${slotName}`}
                                                            >
                                                                Backup
                                                            </button>
                                                            <button
                                                                onClick={() => _handleRestoreBackupToDraft(slot)}
                                                                disabled={!hasBackup || isSaving}
                                                                className="px-2 py-1 text-[10px] font-semibold rounded bg-[hsl(var(--primary))]/10 hover:bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] border border-transparent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                                                title={`Restore ${slotName} to draft`}
                                                            >
                                                                Restore
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Summary Stats */}
                                    <div className="p-4 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))] mb-1 select-none">Summary</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/50 px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Sections</p>
                                                <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">{sections.length}</p>
                                            </div>
                                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/50 px-3 py-2">
                                                <p className="text-[10px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Fields</p>
                                                <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">{sections.reduce((acc, s) => acc + s.fields.length, 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Far-Right Vertical Rail */}
                        <div
                            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                            className="w-14 h-full flex flex-col items-center justify-between py-4 px-2 border-l border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/30 cursor-pointer hover:bg-[hsl(var(--surface-elevated))]/40 transition-all select-none"
                        >
                            {/* Top Tab Icons */}
                            <div className="flex flex-col items-center gap-3 w-full">
                                {(['form', 'section', 'widget'] as const).map((tab) => {
                                    const Icon = tab === 'form' ? Layout : tab === 'section' ? Settings : ListTodo;
                                    const tooltip = tab === 'form' ? 'Form Properties' : tab === 'section' ? 'Section Settings' : 'Field Settings';
                                    const isActive = isRightSidebarOpen && activeSidebarTab === tab;

                                    const btnStyle = isActive
                                        ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))]';

                                    return (
                                        <button
                                            key={tab}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isRightSidebarOpen && activeSidebarTab === tab) {
                                                    setIsRightSidebarOpen(false);
                                                } else {
                                                    setIsRightSidebarOpen(true);
                                                    setActiveSidebarTab(tab);
                                                }
                                            }}
                                            className={`h-10 w-10 relative inline-flex items-center justify-center rounded-lg border transition-all ${btnStyle}`}
                                            title={tooltip}
                                        >
                                            <Icon className="w-4 h-4" />
                                        </button>
                                    );
                                })}

                                {/* Console Button — separate from property tabs */}
                                <div className="border-t border-[hsl(var(--border))]/30 pt-3 mt-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsConsoleOpen(!isConsoleOpen);
                                        }}
                                        className={`h-10 w-10 relative inline-flex items-center justify-center rounded-lg border transition-all ${
                                            isConsoleOpen
                                                ? hasUnsavedChanges
                                                    ? 'border-[hsl(var(--warning))]/50 bg-[hsl(var(--warning))]/12 text-[hsl(var(--warning))] shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                                    : formMeta?.status === 'live'
                                                        ? 'border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/12 text-[hsl(var(--success))] shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                                                        : 'border-[hsl(var(--info))]/50 bg-[hsl(var(--info))]/12 text-[hsl(var(--info))] shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                                                : hasUnsavedChanges
                                                    ? 'border-[hsl(var(--warning))]/35 bg-[hsl(var(--warning))]/6 text-[hsl(var(--warning))] hover:bg-[hsl(var(--warning))]/12 hover:border-[hsl(var(--warning))]/60'
                                                    : formMeta?.status === 'live'
                                                        ? 'border-[hsl(var(--success))]/35 bg-[hsl(var(--success))]/6 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/12 hover:border-[hsl(var(--success))]/60'
                                                        : 'border-[hsl(var(--info))]/35 bg-[hsl(var(--info))]/6 text-[hsl(var(--info))] hover:bg-[hsl(var(--info))]/12 hover:border-[hsl(var(--info))]/60'
                                        }`}
                                        title="Form Console"
                                    >
                                        <Terminal className="w-4 h-4" />
                                        <span className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
                                            hasUnsavedChanges
                                                ? 'bg-[hsl(var(--warning))] animate-pulse'
                                                : formMeta?.status === 'live'
                                                    ? 'bg-[hsl(var(--success))]'
                                                    : 'bg-[hsl(var(--info))]'
                                        }`} />
                                    </button>
                                </div>
                            </div>

                            {/* Middle State Indicators (Draft/Live & Saved/Unsaved) */}
                            <div className="flex flex-col items-center gap-3.5 w-full py-4 border-t border-b border-[hsl(var(--border))]/20 my-4 select-none">
                                {formMeta?.status === 'live' ? (
                                    <div className="flex flex-col items-center gap-1.5 text-[hsl(var(--success))] bg-[hsl(var(--success))]/8 border border-[hsl(var(--success))]/20 rounded-xl py-2.5 px-2 w-10 shadow-sm transition-all" title="Published & Live">
                                        <Globe className="w-3.5 h-3.5" />
                                        <span className="text-[7.5px] font-black uppercase tracking-[0.15em] [writing-mode:vertical-rl] rotate-180 mt-1">Live</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5 text-[hsl(var(--text-secondary))] bg-[hsl(var(--surface-elevated))]/60 border border-[hsl(var(--border))]/55 rounded-xl py-2.5 px-2 w-10 shadow-sm transition-all" title="Draft Mode">
                                        <FileText className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                                        <span className="text-[7.5px] font-black uppercase tracking-[0.15em] [writing-mode:vertical-rl] rotate-180 mt-1 text-[hsl(var(--text-secondary))]">Draft</span>
                                    </div>
                                )}

                                {hasUnsavedChanges ? (
                                    <div className="flex flex-col items-center gap-1.5 text-[hsl(var(--warning))] bg-[hsl(var(--warning))]/8 border border-[hsl(var(--warning))]/20 rounded-xl py-2.5 px-2 w-10 shadow-sm transition-all animate-pulse" title="Unsaved Changes">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <span className="text-[7.5px] font-black uppercase tracking-[0.15em] [writing-mode:vertical-rl] rotate-180 mt-1">Unsaved</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-1.5 text-[hsl(var(--success))] bg-[hsl(var(--success))]/8 border border-[hsl(var(--success))]/20 rounded-xl py-2.5 px-2 w-10 shadow-sm transition-all" title="All changes saved to cloud">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span className="text-[7.5px] font-black uppercase tracking-[0.15em] [writing-mode:vertical-rl] rotate-180 mt-1">Saved</span>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Vertical Label */}
                            <div className="flex flex-col items-center w-full">
                                <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))] mb-2 select-none">
                                    Settings & Config
                                </div>
                            </div>
                        </div>
                    </aside>


                </div>

                <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none !important;
                    scrollbar-width: none !important;
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

                {/* Save Template Modal */}
                {
                    isSaveTemplateModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                            <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex justify-between items-center bg-[hsl(var(--surface-elevated))]">
                                    <h2 className="text-lg font-bold text-[hsl(var(--text-primary))]">Save as Template</h2>
                                    <button onClick={() => setIsSaveTemplateModalOpen(false)} className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-colors">
                                        ✕
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div>
                                        <label className="label">Template Name</label>
                                        <input
                                            value={templateName}
                                            onChange={e => setTemplateName(e.target.value)}
                                            className="input"
                                            placeholder={sections.find(s => s.id === currentSectionId)?.title || "My Template"}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Description (optional)</label>
                                        <textarea
                                            value={templateDesc}
                                            onChange={e => setTemplateDesc(e.target.value)}
                                            className="input resize-none h-20"
                                            placeholder="Describe this template..."
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Visibility</label>
                                        <select
                                            value={templateVis}
                                            onChange={e => setTemplateVis(e.target.value as 'organization' | 'team')}
                                            className="input"
                                        >
                                            <option value="organization">Entire Organization</option>
                                            <option value="team" disabled title="Coming soon">Specific Teams</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="px-6 py-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] flex justify-end gap-3">
                                    <button
                                        onClick={() => setIsSaveTemplateModalOpen(false)}
                                        className="px-4 py-2 rounded-md text-sm font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))] transition-all border border-transparent shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveTemplate}
                                        className="px-4 py-2 rounded-md text-sm font-semibold text-white bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] transition-all shadow-md shadow-[hsl(var(--primary))]/20"
                                    >
                                        Save Template
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Scoped Rules Builder Modal */}
                {
                    isRulesModalOpen && rulesModalContext && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                            <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                                {/* Modal Header */}
                                <div className="px-6 py-4 border-b border-[hsl(var(--border))] flex justify-between items-center bg-[hsl(var(--surface-elevated))]/65 shrink-0">
                                    <div>
                                        <span className="text-[10px] font-bold text-[hsl(var(--primary))] uppercase tracking-widest bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-md">
                                            {rulesModalContext.timing === 'pre' ? 'Pre-Render Logic (Pre)' : 'Post-Exit Logic (Post)'}
                                        </span>
                                        <h2 className="text-lg font-bold text-[hsl(var(--text-primary))] mt-1">
                                            Rules for: <span className="text-[hsl(var(--primary))] font-mono">{rulesModalContext.label}</span>
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsRulesModalOpen(false);
                                            setRulesModalContext(null);
                                        }}
                                        className="h-8 w-8 rounded-lg bg-[hsl(var(--surface-elevated))]/50 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all flex items-center justify-center border border-[hsl(var(--border))]/20"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-hidden p-6 bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.02),transparent_32%)]">
                                    <RulesBuilder
                                        fields={allFieldsFlattened}
                                        sections={sections.map(s => ({ id: s.id, title: s.title }))}
                                        rules={formRules}
                                        onRulesChange={(newRules) => setFormRules(newRules)}
                                        triggerId={rulesModalContext.triggerId}
                                        triggerType={rulesModalContext.triggerType}
                                        timing={rulesModalContext.timing}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                }
            </div>

            {/* Quick-Add Searchable Selection Modal */}
            {quickAddOpen && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-text"
                    onClick={() => {
                        setQuickAddOpen(false);
                        setQuickAddSearchQuery('');
                    }}
                >
                    <div
                        className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            const filteredWidgets = widgetLibrary
                                .filter(w => !(formMeta?.kind === 'catalog' && CATALOG_BLOCKED_TYPES.has(w.type)))
                                .filter(w =>
                                    w.label.toLowerCase().includes(quickAddSearchQuery.toLowerCase()) ||
                                    w.type.toLowerCase().includes(quickAddSearchQuery.toLowerCase())
                                );
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                setQuickAddOpen(false);
                                setQuickAddSearchQuery('');
                            } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setQuickAddKeyboardIndex((prev) => (filteredWidgets.length > 0 ? (prev + 1) % filteredWidgets.length : 0));
                            } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setQuickAddKeyboardIndex((prev) => (filteredWidgets.length > 0 ? (prev - 1 + filteredWidgets.length) % filteredWidgets.length : 0));
                            } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (filteredWidgets.length > 0 && quickAddKeyboardIndex >= 0 && quickAddKeyboardIndex < filteredWidgets.length) {
                                    const widget = filteredWidgets[quickAddKeyboardIndex];
                                    handleAddField(widget.type, widget.label);
                                }
                            }
                        }}
                    >
                        {/* Modal Header with Search Input */}
                        <div className="px-5 py-4 border-b border-[hsl(var(--border))]/20 bg-[hsl(var(--surface-elevated))]/40 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))]">Insert Field</h3>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickAddOpen(false);
                                        setQuickAddSearchQuery('');
                                    }}
                                    className="h-6 w-6 rounded-md bg-[hsl(var(--surface-elevated))]/50 hover:bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-all flex items-center justify-center border border-[hsl(var(--border))]/20 text-xs cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-[hsl(var(--text-tertiary))]" />
                                <input
                                    type="text"
                                    autoFocus
                                    value={quickAddSearchQuery}
                                    onChange={(e) => {
                                        setQuickAddSearchQuery(e.target.value);
                                        setQuickAddKeyboardIndex(0);
                                    }}
                                    placeholder="Search fields (e.g., text, radio, gps)..."
                                    className="w-full bg-[hsl(var(--surface))] border border-[hsl(var(--border))]/40 rounded-xl pl-9 pr-4 py-2 text-xs text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-tertiary))] outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] transition-all"
                                />
                            </div>
                        </div>

                        {/* Modal Body with Categories/Results */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4" id="quick-add-widgets-list">
                            {(() => {
                                const filteredWidgets = widgetLibrary
                                    .filter(w => !(formMeta?.kind === 'catalog' && CATALOG_BLOCKED_TYPES.has(w.type)))
                                    .filter(w =>
                                        w.label.toLowerCase().includes(quickAddSearchQuery.toLowerCase()) ||
                                        w.type.toLowerCase().includes(quickAddSearchQuery.toLowerCase())
                                    );

                                if (filteredWidgets.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-xs text-[hsl(var(--text-tertiary))] italic">
                                            No matches found for "{quickAddSearchQuery}"
                                        </div>
                                    );
                                }

                                // Find all categories containing filtered widgets
                                const matchedCategories = Array.from(new Set(filteredWidgets.map(w => widgetCategoryMap[w.type])));

                                return matchedCategories.map((category) => {
                                    const widgetsInCategory = filteredWidgets.filter(w => widgetCategoryMap[w.type] === category);
                                    return (
                                        <div key={category} className="space-y-1.5 animate-in fade-in duration-100">
                                            <div className="text-[10px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-wider px-2">
                                                {category}
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {widgetsInCategory.map((widget) => {
                                                    const flatIdx = filteredWidgets.indexOf(widget);
                                                    const isActive = flatIdx === quickAddKeyboardIndex;
                                                    return (
                                                        <button
                                                            key={widget.type}
                                                            type="button"
                                                            data-active-widget={isActive ? "true" : "false"}
                                                            onMouseEnter={() => setQuickAddKeyboardIndex(flatIdx)}
                                                            onClick={() => handleAddField(widget.type, widget.label)}
                                                            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                                isActive
                                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shadow-sm'
                                                                    : 'border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40 hover:border-[hsl(var(--border))]/70 text-[hsl(var(--text-primary))]'
                                                            }`}
                                                        >
                                                            <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${getTypeIconStyle(widget.type)}`}>
                                                                {widget.icon}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-semibold truncate leading-none">
                                                                    {widget.label}
                                                                </div>
                                                                <div className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1 line-clamp-2 leading-tight">
                                                                    {widgetHints[widget.type]}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Modal Footer helper */}
                        <div className="px-5 py-2.5 border-t border-[hsl(var(--border))]/15 bg-[hsl(var(--surface-elevated))]/25 text-[10px] text-[hsl(var(--text-tertiary))] flex items-center gap-3 shrink-0 select-none">
                            <span><kbd className="bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/50 font-mono">↑↓</kbd> Navigate</span>
                            <span><kbd className="bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/50 font-mono">Enter</kbd> Select</span>
                            <span><kbd className="bg-[hsl(var(--surface-elevated))] px-1.5 py-0.5 rounded border border-[hsl(var(--border))]/50 font-mono">Esc</kbd> Close</span>
                        </div>
                    </div>
                </div>
            )}
        </StudioLayout >
    );
};

export default FormBuilder;
