import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formAPI, projectAPI, sectionTemplateAPI } from '../lib/api';
import { useOrg } from '../contexts/OrgContext';
import StudioLayout from '../components/StudioLayout';
import {
    Save, Play, Trash2, Settings, Smartphone, Layout,
    MapPin, Camera, Type, Hash, CheckSquare, List, Mail,
    Phone, Calendar, Clock, FileText, ToggleLeft, Mic, PenTool, Barcode,
    ChevronDown, ArrowLeft, Zap, GitBranch, Terminal,
    Layers, Copy, MoveRight, Table2, Database,
    Eye, RotateCcw, Star, Search, Plus
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
    | 'audio_recorder'
    | 'matrix_table'
    | 'lookup_list'
    | 'rating_scale'
    | 'object_collection'
    | 'object_instance';

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
    lookup_label_column?: number;
    lookup_value_column?: number;
    min_label?: string;
    max_label?: string;

    // Object types
    object_schema_key?: string;
    object_definition?: FormObjectDefinition;
    collection_layout?: 'cards' | 'table';
    allow_add_items?: boolean;
    allow_remove_items?: boolean;
    catalog_source_type?: 'project_catalog';
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

type SectionCollapseMode = 'full' | 'summary' | 'title';

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
    { type: 'matrix_table', label: 'Table / Matrix', icon: <Table2 className="w-4 h-4" /> },
    { type: 'lookup_list', label: 'Lookup List', icon: <Database className="w-4 h-4" />, defaults: { lookup_source_type: 'preset' } },
    { type: 'rating_scale', label: 'Rating Scale', icon: <Star className="w-4 h-4" />, defaults: { min: 1, max: 5, min_label: 'Very Difficult', max_label: 'Very Easy' } },
    { type: 'object_collection', label: 'Object Collection', icon: <Layers className="w-4 h-4" />, defaults: { allow_add_items: true, allow_remove_items: true, collection_layout: 'cards' } },
    { type: 'object_instance', label: 'Object Reference', icon: <FileText className="w-4 h-4" /> },
];

const widgetCategoryMap: Record<FieldType, string> = {
    input_text: 'Standard Inputs',
    input_number: 'Standard Inputs',
    email_input: 'Standard Inputs',
    phone_input: 'Standard Inputs',
    textarea: 'Standard Inputs',
    date_picker: 'Time & Date',
    time_picker: 'Time & Date',
    dropdown: 'Selection Widgets',
    radio_group: 'Selection Widgets',
    checkbox_group: 'Selection Widgets',
    toggle: 'Selection Widgets',
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
};

const widgetHints: Record<FieldType, string> = {
    input_text: 'Standard text response single-line text entry field',
    input_number: 'Numeric only text input with custom increment boundaries',
    email_input: 'Validated contact address format query input text box',
    phone_input: 'Contact telephone numeric format input placeholder',
    date_picker: 'Calendar dropdown select widget to stamp standard format dates',
    time_picker: 'Clock dial select interface to stamp standard format times',
    dropdown: 'Compact select dropdown containing customizable choices',
    radio_group: 'Radio-button choices layout. Single option select only',
    checkbox_group: 'Multi-checkbox list selector. Allows multiple options',
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
};


const FLOW_NODE_WIDTH = 320;
const FLOW_NODE_GAP_X = 380;
const FLOW_NODE_GAP_Y = 220;
const VARIABLE_DELETE_REVEAL_WIDTH = 88;

const getNextCollapseMode = (mode: SectionCollapseMode): SectionCollapseMode => {
    if (mode === 'full') return 'summary';
    if (mode === 'summary') return 'title';
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
    const collapseMode = rawCollapseMode === 'full' || rawCollapseMode === 'summary' || rawCollapseMode === 'title'
        ? rawCollapseMode
        : layout?.collapse_mode === 'full' || layout?.collapse_mode === 'summary' || layout?.collapse_mode === 'title'
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
    } | null>(null);
    const [title, setTitle] = useState('Untitled Form');
    const [, setTemplates] = useState<any[]>([]);
    const defaultSectionProperties = (): SectionProperties => ({ render_mode: 'list', platforms: ['mobile', 'web'] });
    const [sections, setSections] = useState<FormSection[]>([{ id: 'screen_1', title: 'Section 1', fields: [], properties: defaultSectionProperties(), layout: ensureSectionLayout(undefined, 0) }]);
    const [currentSectionId, setCurrentSectionId] = useState<string>('screen_1');
    const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
    const [logic, setLogic] = useState<LogicRule[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [propertyTab, setPropertyTab] = useState<'content' | 'logic'>('content');
    const [view, setView] = useState<'flow' | 'section'>('flow');
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
    const [showSimulatorMenu, setShowSimulatorMenu] = useState(false);
    const [showMultiActionMenu, setShowMultiActionMenu] = useState(false);
    const [showBackupTools, setShowBackupTools] = useState(false);
    const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
    const [activeSidebarTab, setActiveSidebarTab] = useState<'section' | 'widget' | 'console'>('section');
    const [isSectionListOpen, setIsSectionListOpen] = useState(false);
    const sectionListRef = React.useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (selectedFieldId) {
            setActiveSidebarTab('widget');
            setIsRightSidebarOpen(true);
        } else {
            setActiveSidebarTab('section');
        }
    }, [selectedFieldId]);
    const [inspectorWidgetType, setInspectorWidgetType] = useState<FieldType>('input_text');
    const [isSmartDropdownOpen, setIsSmartDropdownOpen] = useState(false);
    const [smartSearchQuery, setSmartSearchQuery] = useState('');
    const smartDropdownRef = React.useRef<HTMLDivElement | null>(null);
    const [initialHash, setInitialHash] = useState<string>('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [swipedFieldId, setSwipedFieldId] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [activeVersions, setActiveVersions] = useState<Array<{
        id: string;
        kind: 'draft' | 'live';
        slot_index?: number | null;
        version_number: number;
        created_at?: string;
        blueprint?: any;
    }>>([]);
    const [catalogItems, setCatalogItems] = useState<ProjectCatalogItem[]>([]);
    const [previewSlot, setPreviewSlot] = useState<2 | 3 | null>(null);
    const multiActionMenuRef = React.useRef<HTMLDivElement | null>(null);

    const computeHash = (t: string, s: any[], l: any[]) => JSON.stringify({ t, s, l });

    useEffect(() => {
        if (initialHash) {
            const currentHash = computeHash(title, sections, logic);
            setHasUnsavedChanges(currentHash !== initialHash);
        }
    }, [title, sections, logic, initialHash]);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (multiActionMenuRef.current && !multiActionMenuRef.current.contains(event.target as Node)) {
                setShowMultiActionMenu(false);
                setShowBackupTools(false);
            }
            if (smartDropdownRef.current && !smartDropdownRef.current.contains(event.target as Node)) {
                setIsSmartDropdownOpen(false);
            }
            if (sectionListRef.current && !sectionListRef.current.contains(event.target as Node)) {
                const trigger = document.getElementById('section-list-trigger');
                const triggerRail = document.getElementById('section-list-trigger-rail');
                if ((!trigger || !trigger.contains(event.target as Node)) &&
                    (!triggerRail || !triggerRail.contains(event.target as Node))) {
                    setIsSectionListOpen(false);
                }
            }
            if (swipedFieldId) {
                const swipedCard = document.getElementById(`field-card-${swipedFieldId}`);
                if (swipedCard && !swipedCard.contains(event.target as Node)) {
                    closeVariableSwipe();
                }
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [swipedFieldId]);

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

        const targetScrollLeft = layout.x - (viewportWidth / 2) + (nodeWidth / 2);
        const targetScrollTop = layout.y - (viewportHeight / 2) + (nodeHeight / 2);

        flowCanvasRef.current.scrollTo({
            left: Math.max(0, targetScrollLeft),
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
        });
    };


    const currentSectionIndex = sections.findIndex(p => p.id === currentSectionId) !== -1 ? sections.findIndex(p => p.id === currentSectionId) : 0;
    const fields = sections[currentSectionIndex]?.fields || [];
    const selectedField = sections.flatMap(p => p.fields).find(f => f.id === selectedFieldId) || null;
    const selectedSection = sections[currentSectionIndex] || sections[0] || null;
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
            const nextX = Math.max(24, event.clientX - canvasRect.left - sectionDragOffset.x + flowCanvasRef.current!.scrollLeft);
            const nextY = Math.max(24, event.clientY - canvasRect.top - sectionDragOffset.y + flowCanvasRef.current!.scrollTop);
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
    }, [draggingSectionId, sectionDragOffset]);

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

        logic.forEach((rule) => {
            if (!rule.target_id || !sectionById.has(rule.target_id)) {
                return;
            }
            if (!['section_jump', 'section_skip'].includes(rule.type)) {
                return;
            }
            const sourceId = rule.source_id && sectionById.has(rule.source_id)
                ? rule.source_id
                : sections.find((section) => section.fields.some((field) => field.id === rule.source_id))?.id;
            if (!sourceId || !sectionById.has(sourceId)) {
                return;
            }
            links.push({
                id: `logic-${rule.id}`,
                sourceId,
                targetId: rule.target_id,
                label: rule.action === 'skip' ? 'Skip' : 'Jump',
                tone: 'logic',
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

    const createCatalogPresetProperties = (items: ProjectCatalogItem[]): ObjectPropertyDefinition[] => [
        {
            key: 'item_ref',
            type: 'select',
            label: 'Item',
            required: true,
            edit_mode: 'editable',
            reference: {
                source_type: 'catalog',
                source_id: 'project_catalog',
                label_field: 'label',
                value_field: 'id',
                source_items: buildCatalogSourceItems(items),
                field_mappings: {
                    sku_code: 'sku_code',
                    item_label: 'label',
                    unit: 'unit',
                    brand: 'brand',
                    unit_price: 'default_price',
                },
            },
        },
        {
            key: 'sku_code',
            type: 'string',
            label: 'Item Code',
            edit_mode: 'fixed',
        },
        {
            key: 'item_label',
            type: 'string',
            label: 'Item Label',
            edit_mode: 'fixed',
        },
        {
            key: 'quantity',
            type: 'integer',
            label: 'Quantity',
            required: true,
            default_value: 1,
            edit_mode: 'editable',
        },
        {
            key: 'unit',
            type: 'string',
            label: 'Unit',
            edit_mode: 'fixed',
        },
        {
            key: 'brand',
            type: 'string',
            label: 'Brand',
            edit_mode: 'hidden',
        },
        {
            key: 'unit_price',
            type: 'decimal',
            label: 'Unit Price',
            required: true,
            edit_mode: 'defaulted',
        },
        {
            key: 'line_total',
            type: 'computed',
            label: 'Line Total',
            formula: 'quantity * unit_price',
            edit_mode: 'fixed',
        },
        {
            key: 'comment',
            type: 'string',
            label: 'Comment',
            edit_mode: 'editable',
        },
    ];

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

    const applyCatalogRowTemplate = () => {
        if (!selectedField) {
            return;
        }

        const schemaKey = selectedField.object_schema_key || toSmartValue(selectedField.label || 'line_items');
        updateField(selectedField.id, {
            object_schema_key: schemaKey,
            catalog_source_type: 'project_catalog',
            object_definition: createObjectDefinition(
                { ...selectedField, object_schema_key: schemaKey },
                createCatalogPresetProperties(catalogItems),
            ),
        });
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
                default_value: child.default_value,
                is_sensitive: !!child.is_sensitive,
                exclude_from_export: !!child.exclude_from_export,
                table_columns: child.table_columns,
                table_rows: child.table_rows,
                table_cell_type: child.table_cell_type,
                table_allow_multiple: !!child.table_allow_multiple,
                object_schema_key: child.object_schema_key,
                object_definition: child.object_definition,
                collection_layout: child.collection_layout,
                allow_add_items: child.allow_add_items,
                allow_remove_items: child.allow_remove_items,
                catalog_source_type: child.catalog_source_type,
            })) : []
        }));

        setSections(loadedSections);
        setCurrentSectionId(loadedSections[0].id);
        setLogic(blueprint.logic || []);
        setTitle(blueprint?.meta?.title || fallbackTitle || title);
        setInitialHash(computeHash(blueprint?.meta?.title || fallbackTitle || title, loadedSections, blueprint.logic || []));
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
                });
                setActiveVersions(Array.isArray(versions) ? versions : []);
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
                            default_value: child.default_value,
                            is_sensitive: !!child.is_sensitive,
                            exclude_from_export: !!child.exclude_from_export,
                            table_columns: child.table_columns,
                            table_rows: child.table_rows,
                            table_cell_type: child.table_cell_type,
                            table_allow_multiple: !!child.table_allow_multiple,
                            object_schema_key: child.object_schema_key,
                            object_definition: child.object_definition,
                            collection_layout: child.collection_layout,
                            allow_add_items: child.allow_add_items,
                            allow_remove_items: child.allow_remove_items,
                            catalog_source_type: child.catalog_source_type,
                        })) : []
                    }));
                    setSections(loadedSections);
                    setCurrentSectionId(loadedSections[0].id);
                    setLogic(blueprint.logic || []);
                    setInitialHash(computeHash(data.title || 'Untitled Form', loadedSections, blueprint.logic || []));
                } else {
                    const defaultSecs: FormSection[] = [{ id: 'screen_1', title: 'Section 1', fields: [], properties: { render_mode: 'list', platforms: ['mobile', 'web'] }, layout: ensureSectionLayout(undefined, 0) }];
                    setSections(defaultSecs);
                    setCurrentSectionId('screen_1');
                    setLogic([]);
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

    const longPressTimeoutRef = React.useRef<any>(null);
    const isLongPressActiveRef = React.useRef<boolean>(false);

    const handlePlusButtonMouseDown = (e: React.MouseEvent) => {
        if (e.shiftKey) {
            addField(inspectorWidgetType, undefined, true);
            return;
        }
        isLongPressActiveRef.current = false;
        longPressTimeoutRef.current = setTimeout(() => {
            isLongPressActiveRef.current = true;
            addField(inspectorWidgetType, undefined, true);
            showToast('Added to top', `Widget inserted at the top of the list`, 'success');
        }, 1000);
    };

    const handlePlusButtonMouseUp = (e: React.MouseEvent) => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
        }
        if (!isLongPressActiveRef.current && !e.shiftKey) {
            addField(inspectorWidgetType);
        }
    };

    const handlePlusButtonMouseLeave = () => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
        }
    };

    const handlePlusButtonTouchStart = () => {
        isLongPressActiveRef.current = false;
        longPressTimeoutRef.current = setTimeout(() => {
            isLongPressActiveRef.current = true;
            addField(inspectorWidgetType, undefined, true);
            showToast('Added to top', `Widget inserted at the top of the list`, 'success');
        }, 1000);
    };

    const handlePlusButtonTouchEnd = (e: React.TouchEvent) => {
        if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
        }
        if (!isLongPressActiveRef.current) {
            e.preventDefault();
            addField(inspectorWidgetType);
        }
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
        object_schema_key: field.object_schema_key,
        object_definition: hydrateCatalogReferences(field.object_definition, field),
        collection_layout: field.collection_layout,
        allow_add_items: field.allow_add_items,
        allow_remove_items: field.allow_remove_items,
        catalog_source_type: field.catalog_source_type,
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
                logic: logic
            };
            // Working draft is always slot 1.
            await formAPI.updateBlueprint(formId, blueprint, 1);

            const versions = await formAPI.listVersions(formId);
            setActiveVersions(Array.isArray(versions) ? versions : []);

            const newHash = computeHash(title, sections, logic);
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

    const handlePublish = async () => {
        if (!formId || isPublishing) return;
        setIsPublishing(true);

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

    const handleSaveToBackup = async (slot: 2 | 3) => {
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
                logic: logic
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

    const handleRestoreBackupToDraft = async (slot: 2 | 3) => {
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

    const renderWidgetPreview = (field: FormField) => {
        const borderStyle = "border-[hsl(var(--border))]/80";
        const textSecColor = "text-[hsl(var(--text-secondary))]";
        const surfaceColor = "bg-[hsl(var(--surface))]";

        switch(field.type) {
            case 'input_text':
                return (
                    <div className="relative max-w-sm">
                        <input 
                            type="text" 
                            placeholder={field.placeholder || "Respond here..."} 
                            className={`w-full text-xs px-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} outline-none cursor-not-allowed ${textSecColor}`} 
                            disabled 
                        />
                    </div>
                );
            case 'input_number':
                return (
                    <div className={`flex items-center max-w-[150px] ${surfaceColor} rounded-lg border ${borderStyle} overflow-hidden`}>
                        <button className="px-2.5 py-1.5 bg-[hsl(var(--surface-elevated))] text-xs font-bold border-r border-[hsl(var(--border))]/40 text-[hsl(var(--text-secondary))]" disabled>-</button>
                        <input type="text" value={field.default_value || "0"} className={`w-full text-center text-xs outline-none bg-transparent text-[hsl(var(--text-primary))]`} disabled />
                        <button className="px-2.5 py-1.5 bg-[hsl(var(--surface-elevated))] text-xs font-bold border-l border-[hsl(var(--border))]/40 text-[hsl(var(--text-secondary))]" disabled>+</button>
                    </div>
                );
            case 'email_input':
                return (
                    <div className="relative max-w-sm flex items-center">
                        <span className="absolute left-3 text-xs text-[hsl(var(--text-tertiary))]">@</span>
                        <input 
                            type="email" 
                            placeholder={field.placeholder || "example@domain.com"} 
                            className={`w-full text-xs pl-7 pr-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} outline-none cursor-not-allowed ${textSecColor}`} 
                            disabled 
                        />
                    </div>
                );
            case 'phone_input':
                return (
                    <div className="relative max-w-sm flex items-center">
                        <span className="absolute left-3 text-xs text-[hsl(var(--text-tertiary))]">📞</span>
                        <input 
                            type="tel" 
                            placeholder={field.placeholder || "+1 (555) 019-2834"} 
                            className={`w-full text-xs pl-8 pr-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} outline-none cursor-not-allowed ${textSecColor}`} 
                            disabled 
                        />
                    </div>
                );
            case 'date_picker':
                return (
                    <div className="relative max-w-xs">
                        <input 
                            type="date" 
                            className={`w-full text-xs px-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} outline-none ${textSecColor} cursor-not-allowed`} 
                            disabled 
                        />
                    </div>
                );
            case 'time_picker':
                return (
                    <div className="flex items-center gap-2 max-w-xs">
                        <select className={`text-xs ${surfaceColor} border border-[hsl(var(--border))]/60 px-2 py-1.5 rounded-lg ${textSecColor}`} disabled><option>12</option></select>
                        <span className="font-bold text-[hsl(var(--text-tertiary))]">:</span>
                        <select className={`text-xs ${surfaceColor} border border-[hsl(var(--border))]/60 px-2 py-1.5 rounded-lg ${textSecColor}`} disabled><option>00</option></select>
                        <select className={`text-xs ${surfaceColor} border border-[hsl(var(--border))]/60 px-2 py-1.5 rounded-lg ${textSecColor}`} disabled><option>PM</option></select>
                    </div>
                );
            case 'dropdown':
                return (
                    <div className="relative max-w-xs">
                        <select className={`w-full appearance-none text-xs px-3 py-2 ${surfaceColor} border border-[hsl(var(--border))]/60 rounded-lg ${textSecColor} outline-none`} disabled>
                            <option>Select from options...</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                        </div>
                    </div>
                );
            case 'radio_group':
                return (
                    <div className="flex flex-row flex-wrap gap-x-4 gap-y-1.5">
                        {(field.options || [{ label: 'Option A', value: 'a' }, { label: 'Option B', value: 'b' }]).map((opt, idx) => (
                            <label key={idx} className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))] cursor-not-allowed select-none">
                                <span className={`w-3.5 h-3.5 rounded-full border border-[hsl(var(--border))]/85 flex items-center justify-center shrink-0`}>
                                    {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))]" />}
                                </span>
                                <span>{opt.label}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'checkbox_group':
                return (
                    <div className="flex flex-row flex-wrap gap-x-4 gap-y-1.5">
                        {(field.options || [{ label: 'Option A', value: 'a' }, { label: 'Option B', value: 'b' }]).map((opt, idx) => (
                            <label key={idx} className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))] cursor-not-allowed select-none">
                                <span className={`w-3.5 h-3.5 rounded border border-[hsl(var(--border))]/85 flex items-center justify-center shrink-0`}>
                                    {idx === 0 && <span className="w-2 h-2 bg-[hsl(var(--primary))] rounded-sm" />}
                                </span>
                                <span>{opt.label}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'textarea':
                return (
                    <div className={`w-full text-xs px-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} text-[hsl(var(--text-tertiary))] italic cursor-not-allowed truncate select-none`}>
                        {field.placeholder || "Write multiple lines response..."}
                    </div>
                );
            case 'gps_capture':
                return (
                    <div className="flex items-center gap-3 justify-between">
                        <div className="bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/10 rounded-lg px-2.5 py-1 text-[11px] text-[hsl(var(--primary))] font-mono flex items-center gap-1 truncate select-none">
                            <MapPin className="w-3 h-3 text-[hsl(var(--primary))] shrink-0" />
                            <span className="truncate">Lat: 5.6037°, Lon: -0.1870°</span>
                        </div>
                        <button className="bg-[hsl(var(--primary))] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm shrink-0" disabled>Capture</button>
                    </div>
                );
            case 'photo_capture':
                return (
                    <div className={`flex items-center gap-2.5 border border-dashed border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))]/50 px-3 py-1.5 rounded-xl text-[hsl(var(--text-tertiary))] select-none`}>
                        <Camera className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] block leading-none">No camera feed active</span>
                            <span className="text-[9px] text-[hsl(var(--text-tertiary))] block mt-0.5 leading-none">Click to initialize system lens</span>
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
                    <div className={`border border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))] h-9 px-3 rounded-lg relative flex items-center justify-between select-none text-[hsl(var(--text-tertiary))] font-serif italic`}>
                        <span className="text-xs">Draw signature mark...</span>
                        <div className="absolute bottom-2.5 left-2 right-2 border-t border-dashed border-[hsl(var(--border))]/40"></div>
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
                    <div className="flex items-center gap-2.5">
                        <button className="bg-rose-500/10 hover:bg-rose-500/15 text-rose-500 rounded-full w-7 h-7 flex items-center justify-center text-sm border border-rose-500/20 outline-none shrink-0" disabled>
                            <Mic className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                        <div className="flex-1 h-3.5 bg-[hsl(var(--surface-elevated))] rounded-full overflow-hidden flex items-center gap-0.5 px-2">
                            <span className="h-1.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-2.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-1 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-2 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                            <span className="h-0.5 w-0.5 bg-[hsl(var(--primary))]/60 inline-block rounded"></span>
                        </div>
                        <span className="text-[10px] font-mono text-[hsl(var(--text-tertiary))] select-none shrink-0">0:00</span>
                    </div>
                );
            case 'lookup_list':
                return (
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder={field.placeholder || "Search database records list..."} 
                            className={`w-full text-xs px-3 py-2 ${surfaceColor} rounded-lg border ${borderStyle} outline-none cursor-not-allowed ${textSecColor} pr-8`} 
                            disabled 
                        />
                        <div className="absolute right-3 top-2.5 text-xs text-[hsl(var(--text-tertiary))]"><Database className="w-3.5 h-3.5" /></div>
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
                    <div className={`flex items-center gap-3 border border-dashed border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))]/40 px-3 py-2 rounded-xl text-[hsl(var(--text-tertiary))] select-none`}>
                        <Table2 className="w-4 h-4 text-[hsl(var(--text-tertiary))] shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                            <div className="text-left">
                                <span className="text-[10px] font-bold text-[hsl(var(--text-secondary))] block leading-none">Matrix Table Grid</span>
                                <span className="text-[9px] text-[hsl(var(--text-tertiary))] block mt-0.5 leading-none">
                                    {(field.table_rows || []).length || 3} rows × {(field.table_columns || []).length || 5} columns
                                </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="w-2.5 h-2.5 rounded-full border border-[hsl(var(--border))]/80 flex items-center justify-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))]" />
                                </span>
                                <span className="w-2.5 h-2.5 rounded-full border border-[hsl(var(--border))]/80" />
                                <span className="w-2.5 h-2.5 rounded-full border border-[hsl(var(--border))]/80" />
                            </div>
                        </div>
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
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="p-2 hover:bg-[hsl(var(--surface-elevated))] rounded-md transition-all text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 bg-[hsl(var(--primary))] rounded-md flex items-center justify-center shadow-lg shadow-black/10">
                            <Layout className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="min-w-0 bg-transparent border-none text-xl font-bold focus:outline-none focus:ring-1 focus:ring-[hsl(var(--border-hover))] rounded px-2"
                            />
                            <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                Studio Builder
                            </div>
                            <div className="relative inline-grid grid-cols-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/92 p-0.5 shadow-sm">
                                <div
                                    className={`pointer-events-none absolute top-0.5 h-[calc(100%-0.25rem)] w-[calc(50%-0.125rem)] rounded-full bg-[linear-gradient(135deg,rgba(134,239,172,0.95),rgba(167,243,208,0.92))] shadow-[0_4px_10px_rgba(74,222,128,0.2)] transition-all duration-300 ${view === 'flow' ? 'left-0.5' : 'left-[calc(50%)]'
                                        }`}
                                />
                                <button
                                    onClick={() => {
                                        exitSection();
                                    }}
                                    className={`relative z-10 inline-flex min-w-[110px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === 'flow'
                                        ? 'text-slate-950'
                                        : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]'
                                        }`}
                                >
                                    <GitBranch className="h-3.5 w-3.5" />
                                    <span>Flow Mode</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedSection) {
                                            return;
                                        }
                                        enterSection(selectedSection.id);
                                    }}
                                    disabled={!selectedSection}
                                    className={`relative z-10 inline-flex min-w-[110px] items-center justify-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === 'section'
                                        ? 'text-slate-950'
                                        : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))]'
                                        } ${!selectedSection ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                    <Layout className="h-3.5 w-3.5" />
                                    <span>Inspector Mode</span>
                                </button>
                            </div>
                            {view === 'section' && (
                                <button
                                    id="section-list-trigger"
                                    onClick={() => setIsSectionListOpen(!isSectionListOpen)}
                                    className="flex items-center gap-2 max-w-[220px] truncate rounded-full border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/8 hover:bg-[hsl(var(--primary))]/12 px-3 py-1.5 text-[11px] font-semibold text-[hsl(var(--primary))] shadow-sm transition-all animate-in fade-in duration-200"
                                    title="View sections list"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>{sections.find(s => s.id === currentSectionId)?.title || 'Section'}</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isSectionListOpen ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg border ${formMeta?.status === 'live'
                            ? 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30'
                            : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] border-[hsl(var(--border))]'
                            }`}>
                            {formMeta?.status === 'live'
                                ? `Live v${formMeta?.published_version ?? formMeta?.version ?? 0}`
                                : 'Draft'}
                        </div>
                        {hasUnsavedChanges && (
                            <div className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border border-[hsl(var(--warning))]/30">
                                Unsaved Changes
                            </div>
                        )}
                    </div>
                </header>

                <div className={`flex flex-1 overflow-hidden ${view === 'section' ? 'p-4 pt-3' : ''}`}>
                    {/* Left Vertical Rail */}
                    <aside
                        onClick={() => setIsSectionListOpen(!isSectionListOpen)}
                        className="flex h-full shrink-0 border-r border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/55 cursor-pointer hover:bg-[hsl(var(--surface-elevated))]/80 transition-all"
                    >
                        <div className="w-14 flex flex-col items-center gap-3 py-3 px-2">
                            <button
                                id="section-list-trigger-rail"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsSectionListOpen(!isSectionListOpen);
                                }}
                                className={`h-10 w-10 inline-flex items-center justify-center rounded-lg border transition-all ${
                                    isSectionListOpen
                                        ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))]'
                                }`}
                                title="Toggle Section List"
                            >
                                <Layers className="w-4 h-4" />
                            </button>
                            <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))] mt-2">
                                Sections
                            </div>
                        </div>
                    </aside>

                    <div className={`flex flex-1 overflow-hidden ${view === 'section'
                        ? 'flex-col rounded-[28px] border border-[hsl(var(--border))] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.92))] shadow-[0_24px_60px_rgba(15,23,42,0.08)]'
                        : ''
                        }`}>


                    <div className="flex min-h-0 flex-1 overflow-hidden relative">
                    {/* Left Panel: Section Navigator */}
                    {isSectionListOpen && (
                        <aside ref={sectionListRef} className="absolute left-4 top-3 bottom-4 z-40 w-80 border border-[hsl(var(--border))]/60 bg-[hsl(var(--surface))] flex h-auto overflow-hidden rounded-2xl shadow-2xl animate-in slide-in-from-left-4 fade-in duration-300">
                            <div className="flex w-14 flex-col items-center gap-2 border-r border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/80 px-2 py-3">
                                <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))] shadow-[inset_2px_0_0_hsl(var(--primary))]">
                                    <Layers className="w-4 h-4" />
                                </span>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                                <div className="border-b border-[hsl(var(--border))]/60 bg-[hsl(var(--surface-elevated))]/45 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Section List</p>
                                            <h3 className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">Survey Sections</h3>
                                        </div>
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
                                    <p className="mt-2 text-xs text-[hsl(var(--text-secondary))]">Select a section to edit its widgets in the center canvas.</p>
                                </div>

                                <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-2">
                                    {sections.map((section, index) => {
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
                                                        <p className="truncate text-sm font-semibold text-[hsl(var(--text-primary))]">{section.title || `Section ${index + 1}`}</p>
                                                        <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{section.fields.length} widget{section.fields.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                    <span className="rounded-md bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">S{index + 1}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    )}

                    {/* Main Canvas — switches between Flow Mode and Inspector Mode */}
                    <main className={`flex flex-1 flex-col overflow-hidden ${view === 'flow'
                        ? 'bg-transparent'
                        : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.66),rgba(248,250,252,0.9))]'
                        }`}>


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
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Canvas</p>
                                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    <span className="rounded-lg bg-[hsl(var(--surface-elevated))]/80 px-2.5 py-1 border border-[hsl(var(--border))]/20 shadow-sm">{sections.length} sections</span>
                                                    <span className="rounded-lg bg-[hsl(var(--surface-elevated))]/80 px-2.5 py-1 border border-[hsl(var(--border))]/20 shadow-sm">{logic.length + getFlowConnections().filter((link) => link.tone === 'option').length} routes</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={addSection}
                                            className="rounded-xl border border-transparent bg-[hsl(var(--surface-elevated))]/80 hover:bg-[hsl(var(--surface-elevated))] px-3.5 py-1.5 text-xs font-bold text-[hsl(var(--text-primary))] transition-all hover:text-[hsl(var(--primary))] shadow-sm"
                                        >
                                            Add Section
                                        </button>
                                    </div>

                                        <div ref={flowCanvasRef} className="relative min-h-[420px] flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(15,23,42,0.04))]">
                                            <svg className="pointer-events-none absolute left-0 top-0 h-[1600px] w-[1600px]" viewBox="0 0 1600 1600" fill="none">
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

                                            <div className="relative h-[1600px] w-[1600px]">
                                                {sections.map((section, idx) => {
                                                    const layout = ensureSectionLayout(section.layout, idx);
                                                    const collapseMode = layout.collapse_mode || 'full';
                                                    const visibleFields = getVisibleFieldsForCard(section, layout);
                                                    const hiddenFieldCount = Math.max(0, section.fields.length - visibleFields.length);
                                                    const isActive = currentSectionId === section.id;
                                                    return (
                                                        <div
                                                            key={section.id}
                                                            className={`absolute rounded-2xl border transition-all ${isActive
                                                                ? 'border-[hsl(var(--primary))]/45 bg-[hsl(var(--surface))] shadow-[0_14px_40px_rgba(15,23,42,0.08)]'
                                                                : 'border-[hsl(var(--border))]/40 bg-[hsl(var(--surface))]/95 shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:border-[hsl(var(--primary))]/25'
                                                                }`}
                                                            style={{ left: layout.x, top: layout.y, width: layout.width || FLOW_NODE_WIDTH }}
                                                        >
                                                            <div
                                                                onPointerDown={(event) => {
                                                                    if ((event.target as HTMLElement).closest('button')) {
                                                                        return;
                                                                    }
                                                                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                                                    setCurrentSectionId(section.id);
                                                                    setSelectedFieldId(null);
                                                                    setDraggingSectionId(section.id);
                                                                    setSectionDragOffset({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                                                                }}
                                                                className="flex cursor-grab items-start justify-between rounded-t-2xl border-b border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/80 px-4 py-3 active:cursor-grabbing"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]">
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
                                                                    className="rounded-lg border border-transparent bg-[hsl(var(--surface-elevated))]/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-all hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--primary))] shadow-sm"
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
                                                                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${section.properties.render_mode === 'single' ? 'bg-[hsl(var(--primary))]/12 text-[hsl(var(--primary))]' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))]'}`}>
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
                                                                                        closeVariableSwipe();
                                                                                        removeField(field.id);
                                                                                    }}
                                                                                    className="absolute inset-y-0 right-0 z-0 flex w-[88px] items-center justify-center bg-[hsl(var(--error))] px-2 text-[11px] font-semibold text-white"
                                                                                    title="Delete variable"
                                                                                >
                                                                                    Delete
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
                                                                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))] transition-all hover:bg-[hsl(var(--surface-elevated))] hover:text-[hsl(var(--primary))]"
                                                                        title="Cycle card collapse mode"
                                                                    >
                                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapseMode === 'title' ? '-rotate-90' : collapseMode === 'summary' ? 'rotate-0' : 'rotate-180'}`} />
                                                                        <span>{collapseMode === 'full' ? 'All' : collapseMode === 'summary' ? '50%' : 'Title'}</span>
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
                        ) : (
                            /* ═══════════════════════════════════════════════
                               SECTION VIEW  — edit fields inside one section
                            ═══════════════════════════════════════════════ */
                            <div
                                key={`section-view-${currentSectionId}`}
                                onClick={() => setSelectedFieldId(null)}
                                className={`min-h-full p-4 lg:p-6 animate-in fade-in ${slideDir === 'forward' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'
                                    } duration-300`}
                            >
                                <div className="w-full max-w-5xl space-y-6">

                                    {/* ── Section selector chip with integrated Widget Inserter ───────────────────────────── */}
                                    {(() => {
                                        const sec = sections.find(s => s.id === currentSectionId)!;
                                        const isSelected = selectedFieldId === null;
                                        return (
                                            <div className="sticky -top-4 lg:-top-6 z-30 bg-[hsl(var(--background))] py-2.5 -my-2.5 border-b border-[hsl(var(--border))]/10">
                                                <div
                                                    onClick={() => setSelectedFieldId(null)}
                                                    className={`w-full flex flex-col gap-4 px-5 py-4 rounded-xl border transition-all text-left group cursor-pointer ${isSelected
                                                        ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 shadow-sm shadow-[hsl(var(--primary))]/5'
                                                        : 'border-transparent bg-[hsl(var(--surface-elevated))]/45 hover:bg-[hsl(var(--surface-elevated))]/85 hover:border-transparent'
                                                        }`}
                                                >
                                                    {/* Row 1: Section Name and field count */}
                                                    <div className="flex items-center justify-between w-full">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            {/* Section icon */}
                                                            <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-all ${isSelected
                                                                ? 'bg-[hsl(var(--primary))] text-white'
                                                                : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-tertiary))] group-hover:bg-[hsl(var(--primary))]/10 group-hover:text-[hsl(var(--primary))]'
                                                                }`}>
                                                                <Layout className="w-4.5 h-4.5" />
                                                            </div>

                                                            {/* Section info */}
                                                            <div className="min-w-0">
                                                                <p className={`font-bold text-sm truncate ${isSelected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--text-primary))]'}`}>
                                                                    {sec.title}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Field count and status */}
                                                        <div className="text-xs text-[hsl(var(--text-tertiary))] bg-[hsl(var(--surface-elevated))]/60 px-2.5 py-1 rounded-md border border-[hsl(var(--border))]/25 shadow-sm">
                                                            {sec.fields.length} field{sec.fields.length !== 1 ? 's' : ''} · <span className="capitalize">{sec.properties.render_mode} mode</span>
                                                            {sec.properties.shuffle_options && ' · shuffled'}
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Widget Component taking full width */}
                                                    <div className="w-full flex items-center justify-between gap-4" onClick={(e) => e.stopPropagation()}>
                                                        <div className="relative w-full" ref={smartDropdownRef}>
                                                            <div className="flex items-stretch rounded-xl border border-[hsl(var(--border))]/80 bg-[hsl(var(--surface))] shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-[hsl(var(--primary))]/20 focus-within:border-[hsl(var(--primary))] transition-all duration-200 w-full">
                                                                
                                                                {/* Main Area: Toggle Search Dropdown */}
                                                                <button
                                                                    onClick={() => {
                                                                        setIsSmartDropdownOpen(!isSmartDropdownOpen);
                                                                        setSmartSearchQuery('');
                                                                    }}
                                                                    className="flex-1 bg-transparent hover:bg-[hsl(var(--surface-elevated))]/40 active:bg-[hsl(var(--surface-elevated))]/80 text-left px-4 py-2.5 flex items-center justify-between text-[hsl(var(--text-primary))] transition-all duration-150 outline-none select-none"
                                                                    title="Click to search widgets & change active item"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-[hsl(var(--primary))] shrink-0">
                                                                            {getWidget(inspectorWidgetType)?.icon || <Type className="w-4 h-4" />}
                                                                        </span>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-[8px] text-[hsl(var(--text-tertiary))] uppercase font-bold tracking-wider leading-none">Add Widget</span>
                                                                            <span className="text-xs font-bold text-[hsl(var(--text-primary))] mt-0.5">
                                                                                {getWidget(inspectorWidgetType)?.label || inspectorWidgetType}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <ChevronDown className="w-4 h-4 text-[hsl(var(--text-tertiary))]/60 transition-transform" />
                                                                </button>

                                                                {/* Right Side: Insert Active Widget */}
                                                                <button
                                                                    onMouseDown={handlePlusButtonMouseDown}
                                                                    onMouseUp={handlePlusButtonMouseUp}
                                                                    onMouseLeave={handlePlusButtonMouseLeave}
                                                                    onTouchStart={handlePlusButtonTouchStart}
                                                                    onTouchEnd={handlePlusButtonTouchEnd}
                                                                    className="px-4 flex items-center justify-center bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-white transition-all duration-150 outline-none select-none border-l border-[hsl(var(--border))]/85 active:scale-95 active:bg-[hsl(var(--primary))]/20"
                                                                    title="Click to insert at bottom. Long-press or Shift+Click to insert at top."
                                                                >
                                                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                                                </button>
                                                            </div>

                                                        {/* Dropdown Panel */}
                                                        {isSmartDropdownOpen && (
                                                            <div className="absolute right-0 mt-2 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col w-[360px] max-h-[420px] transition-all duration-200 animate-in fade-in slide-in-from-top-2">
                                                                
                                                                {/* Search Input Block */}
                                                                <div className="p-3 bg-[hsl(var(--surface-elevated))]/60 border-b border-[hsl(var(--border))]/45 sticky top-0 flex items-center gap-2">
                                                                    <Search className="w-4 h-4 text-[hsl(var(--text-tertiary))]" />
                                                                    <input
                                                                        type="text"
                                                                        value={smartSearchQuery}
                                                                        onChange={(e) => setSmartSearchQuery(e.target.value)}
                                                                        placeholder="Type to filter options..."
                                                                        className="w-full bg-transparent text-xs text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-tertiary))] outline-none font-medium"
                                                                        autoFocus
                                                                    />
                                                                    {smartSearchQuery && (
                                                                        <button 
                                                                            onClick={() => setSmartSearchQuery('')} 
                                                                            className="text-[10px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] font-semibold px-1"
                                                                        >
                                                                            Clear
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* List of Categorized Widgets */}
                                                                <div className="flex-1 overflow-y-auto hide-scrollbar p-1.5 divide-y divide-[hsl(var(--border))]/20">
                                                                    {(() => {
                                                                        const filteredWidgets = widgetLibrary.filter(widget => {
                                                                            const query = smartSearchQuery.toLowerCase().trim();
                                                                            if (!query) return true;
                                                                            const hint = widgetHints[widget.type]?.toLowerCase() || '';
                                                                            const label = widget.label.toLowerCase();
                                                                            return label.includes(query) || hint.includes(query);
                                                                        });

                                                                        // Group by categories
                                                                        const categories = [...new Set(widgetLibrary.map(w => widgetCategoryMap[w.type]))];

                                                                        return categories.map(category => {
                                                                            const items = filteredWidgets.filter(w => widgetCategoryMap[w.type] === category);
                                                                            if (items.length === 0) return null;

                                                                            return (
                                                                                <div key={category} className="py-2 first:pt-1 last:pb-1">
                                                                                    <div className="text-[9px] font-bold text-[hsl(var(--text-tertiary))] uppercase tracking-[0.15em] px-3 py-1.5 select-none">
                                                                                        {category}
                                                                                    </div>
                                                                                    <div className="space-y-0.5">
                                                                                        {items.map(widget => {
                                                                                            const isActive = widget.type === inspectorWidgetType;
                                                                                            return (
                                                                                                <button
                                                                                                    key={widget.type}
                                                                                                    onClick={() => {
                                                                                                        setInspectorWidgetType(widget.type);
                                                                                                        addField(widget.type);
                                                                                                        setIsSmartDropdownOpen(false);
                                                                                                    }}
                                                                                                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between rounded-lg transition-all duration-150 group ${
                                                                                                        isActive 
                                                                                                            ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 text-[hsl(var(--primary))]' 
                                                                                                            : 'border border-transparent hover:bg-[hsl(var(--surface-elevated))]/65 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
                                                                                                    }`}
                                                                                                >
                                                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                                                        <span className={`text-sm shrink-0 transition-colors ${isActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--text-tertiary))] group-hover:text-[hsl(var(--primary))]'}`}>
                                                                                                            {widget.icon}
                                                                                                        </span>
                                                                                                        <div className="flex flex-col min-w-0">
                                                                                                            <span className="font-semibold truncate">{widget.label}</span>
                                                                                                            <span className="text-[10px] text-[hsl(var(--text-tertiary))] group-hover:text-[hsl(var(--text-secondary))] truncate mt-0.5">
                                                                                                                {widgetHints[widget.type]}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {isActive && <span className="text-xs text-[hsl(var(--primary))] font-bold pl-2 select-none">✓</span>}
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>

                                                                {/* Footer match count */}
                                                                <div className="px-3 py-2 bg-[hsl(var(--surface-elevated))]/40 border-t border-[hsl(var(--border))]/40 flex items-center justify-between text-[10px] text-[hsl(var(--text-tertiary))] font-medium">
                                                                    <span>
                                                                        Matches:{' '}
                                                                        <strong className="text-[hsl(var(--text-secondary))]">
                                                                            {
                                                                                widgetLibrary.filter(widget => {
                                                                                    const query = smartSearchQuery.toLowerCase().trim();
                                                                                    if (!query) return true;
                                                                                    const hint = widgetHints[widget.type]?.toLowerCase() || '';
                                                                                    const label = widget.label.toLowerCase();
                                                                                    return label.includes(query) || hint.includes(query);
                                                                                }).length
                                                                            }
                                                                        </strong>{' '}
                                                                        / {widgetLibrary.length}
                                                                    </span>
                                                                    <span>Auto-inserts on select</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                    {fields.length === 0 ? (
                                        <div className="bg-[hsl(var(--surface-elevated))]/30 border border-dashed border-[hsl(var(--border))]/40 rounded-2xl p-20 text-center text-[hsl(var(--text-tertiary))]">
                                            <p className="text-lg font-medium">No widgets yet</p>
                                            <p className="text-sm mt-2">Use the widget inserter in the header above to add the first widget.</p>
                                        </div>
                                    ) : (
                                        fields.map((field) => (
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
                                                className={`p-6 rounded-xl group relative transition-all shadow-sm cursor-pointer border ${selectedFieldId === field.id
                                                    ? 'border-[hsl(var(--primary))] ring-2 ring-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/4 shadow-md shadow-[hsl(var(--primary))]/5'
                                                    : dragOverFieldId === field.id
                                                        ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/3 border-dashed'
                                                        : 'border-transparent bg-[hsl(var(--surface))] shadow-[0_2px_8px_rgba(15,23,42,0.03)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:bg-[hsl(var(--surface-elevated))]/20 hover:border-transparent'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center space-x-3 w-full">
                                                        {/* Drag handle */}
                                                        <span
                                                            onMouseEnter={() => setDragEnabledFieldId(field.id)}
                                                            onMouseLeave={() => setDragEnabledFieldId(null)}
                                                            className="text-[hsl(var(--text-tertiary))] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all px-1 select-none"
                                                        >
                                                            ⠿
                                                        </span>
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
                                                                    <div className="absolute right-0 top-8 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md shadow-lg z-50 min-w-40 py-1">
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
                                                {field.type === 'rating_scale' ? (
                                                    <div className="flex items-center justify-between gap-4 py-1.5">
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
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                    </main>


                    </div>

                    </div>

                    <aside className="flex h-full shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55">
                        {isRightSidebarOpen && (
                            <div className="w-80 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex flex-col overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
                                {/* Top Tab Bar */}
                                <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55 px-3 py-2 flex gap-1">
                                    {(['section', 'widget', 'console'] as const).map((tab) => {
                                        const label = tab === 'section' ? 'Section' : tab === 'widget' ? 'Widget' : 'Console';
                                        const Icon = tab === 'section' ? Settings : tab === 'widget' ? Type : Terminal;
                                        const isActive = activeSidebarTab === tab;
                                        return (
                                            <button
                                                key={tab}
                                                onClick={() => {
                                                    setActiveSidebarTab(tab);
                                                }}
                                                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
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

                                {/* Tab Contents */}
                                <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col">
                                    {activeSidebarTab === 'section' && (
                                        <div className="flex-1 flex flex-col">
                                            {/* Sub-tab Pill Selector */}
                                            <div className="px-4 pt-4 pb-2 flex gap-2">
                                                <button
                                                    onClick={() => setPropertyTab('content')}
                                                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                        propertyTab === 'content'
                                                            ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                            : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                    }`}
                                                >
                                                    Settings
                                                </button>
                                                <button
                                                    onClick={() => setPropertyTab('logic')}
                                                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                        propertyTab === 'logic'
                                                            ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                            : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                    }`}
                                                >
                                                    Logic Rules
                                                </button>
                                            </div>

                                            <div className="flex-1 p-6 pt-2 overflow-y-auto hide-scrollbar">
                                                {propertyTab === 'content' ? (
                                                    <div className="space-y-5 animate-in fade-in duration-200">
                                                                                                            {/* Section Title */}
                                                    <div>
                                                        <h3 className="text-sm font-bold text-[hsl(var(--text-primary))] mb-4 flex items-center">
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
                                                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-xs font-semibold ${isActive
                                                                            ? 'border-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shadow-sm'
                                                                            : 'border-transparent bg-[hsl(var(--surface-elevated))]/80 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
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
                                                                    <label key={platform} className="flex items-center space-x-3 p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl border border-transparent cursor-pointer hover:bg-[hsl(var(--surface-elevated))] transition-all">
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
                                                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
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
                                                        <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
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

                                                    {/* Save as Template */}
                                                    <div className="pt-4">
                                                        <button
                                                            onClick={() => setIsSaveTemplateModalOpen(true)}
                                                            className="w-full py-2 bg-[hsl(var(--surface-elevated))] hover:bg-[hsl(var(--primary))]/10 border border-transparent text-[hsl(var(--primary))] font-semibold rounded-md transition-all flex items-center justify-center gap-2"
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

                                                    <p className="text-[hsl(var(--text-tertiary))] text-xs italic">Select a field in the canvas to see its individual properties.</p>

                                                    </div>
                                                ) : (
                                                    <div className="space-y-6 animate-in fade-in duration-200">
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
                                                            <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl space-y-4 relative group">
                                                                <button
                                                                    onClick={() => removeLogicRule(rule.id)}
                                                                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>

                                                                {/* Timing badge */}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">IF</span>
                                                                    <div className="flex items-center bg-[hsl(var(--surface-elevated))]/40 p-0.5 gap-0.5 rounded-xl">
                                                                        {(['pre', 'post'] as const).map(t => (
                                                                            <button
                                                                                key={t}
                                                                                onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20'
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
                                                            className="w-full py-2.5 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                        >
                                                            + Add Visibility Rule
                                                        </button>
                                                    </div>

                                                    {/* Section Skip / Jump Rules */}
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Navigation</p>
                                                        {logic.filter(r => r.type === 'section_jump' && r.source_id === currentSectionId).map(rule => (
                                                            <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))] rounded-md border border-[hsl(var(--border))] space-y-4 relative group">
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
                                                            className="w-full py-2.5 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                        >
                                                            + Add Skip Rule
                                                        </button>
                                                    </div>

                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeSidebarTab === 'widget' && (
                                        <div className="flex-1 flex flex-col">
                                            {selectedField ? (
                                                <>
                                                    {/* Sub-tab Pill Selector */}
                                                    <div className="px-4 pt-4 pb-2 flex gap-2">
                                                        <button
                                                            onClick={() => setPropertyTab('content')}
                                                            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                                propertyTab === 'content'
                                                                    ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                                    : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                            }`}
                                                        >
                                                            Settings
                                                        </button>
                                                        <button
                                                            onClick={() => setPropertyTab('logic')}
                                                            className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md border transition-all ${
                                                                propertyTab === 'logic'
                                                                    ? 'border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))]'
                                                                    : 'border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                            }`}
                                                        >
                                                            Logic Rules
                                                        </button>
                                                    </div>

                                                    <div className="flex-1 p-6 pt-2 overflow-y-auto hide-scrollbar">
                                                        {propertyTab === 'content' ? (
                                                            <div className="space-y-5 animate-in fade-in duration-200">
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

                                                    <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                        <label className="text-sm font-semibold !mb-0">Required Field</label>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedField.required}
                                                            onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                                            className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                        />
                                                    </div>

                                                    {/* ── Matrix Table Editor ───────────────────── */}
                                                    {selectedField.type === 'matrix_table' && (
                                                        <div className="space-y-5 animate-in fade-in duration-200">
                                                            {/* Divider */}
                                                            <div className="flex items-center gap-2">
                                                                <Table2 className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                                                <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">Matrix Structure</span>
                                                                <div className="flex-1 h-px bg-[hsl(var(--border))]" />
                                                            </div>

                                                            {/* Cell Type */}
                                                            <div>
                                                                <label className="label">Cell Type</label>
                                                                <div className="grid grid-cols-3 gap-1.5">
                                                                    {(['radio', 'checkbox', 'text', 'number', 'dropdown'] as TableCellType[]).map(ct => (
                                                                        <button
                                                                            key={ct}
                                                                            onClick={() => updateField(selectedField.id, { table_cell_type: ct })}
                                                                            className={`py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all capitalize ${(selectedField.table_cell_type || 'radio') === ct
                                                                                ? 'border-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/8 text-[hsl(var(--primary))] shadow-sm'
                                                                                : 'border-transparent bg-[hsl(var(--surface-elevated))]/80 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                                                }`}
                                                                        >
                                                                            {ct}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Allow Multiple — only for checkbox */}
                                                            {selectedField.table_cell_type === 'checkbox' && (
                                                                <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                                    <div>
                                                                        <p className="text-sm font-semibold">Allow Multiple per Row</p>
                                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Check more than one cell per row</p>
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={!!selectedField.table_allow_multiple}
                                                                        onChange={e => updateField(selectedField.id, { table_allow_multiple: e.target.checked })}
                                                                        className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                    />
                                                                </div>
                                                            )}

                                                            {/* Columns */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <label className="label !mb-0 text-xs">Columns (Scale Points)</label>
                                                                    <div className="flex items-center gap-0.5 bg-[hsl(var(--surface-elevated))]/80 rounded-lg p-0.5">
                                                                        <button
                                                                            onClick={() => {
                                                                                const cols = selectedField.table_columns || [];
                                                                                if (cols.length <= 1) return;
                                                                                updateField(selectedField.id, { table_columns: cols.slice(0, -1) });
                                                                            }}
                                                                            className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))] font-bold text-sm transition-all"
                                                                        >−</button>
                                                                        <span className="text-xs font-bold w-5 text-center tabular-nums">{(selectedField.table_columns || []).length}</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                const cols = selectedField.table_columns || [];
                                                                                const n = cols.length + 1;
                                                                                updateField(selectedField.id, { table_columns: [...cols, { id: `col_${Date.now()}`, label: `Column ${n}` }] });
                                                                            }}
                                                                            className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))] font-bold text-sm transition-all"
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {(selectedField.table_columns || []).map((col, ci) => (
                                                                        <div key={col.id} className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] text-[hsl(var(--text-tertiary))] w-4 text-right shrink-0 tabular-nums">{ci + 1}</span>
                                                                            <input
                                                                                value={col.label}
                                                                                onChange={e => {
                                                                                    const cols = [...(selectedField.table_columns || [])];
                                                                                    cols[ci] = { ...cols[ci], label: e.target.value };
                                                                                    updateField(selectedField.id, { table_columns: cols });
                                                                                }}
                                                                                className="input text-sm py-1.5 flex-1"
                                                                                placeholder={`Column ${ci + 1}`}
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const cols = (selectedField.table_columns || []).filter((_, i) => i !== ci);
                                                                                    updateField(selectedField.id, { table_columns: cols });
                                                                                }}
                                                                                className="p-1.5 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg transition-all shrink-0"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            const cols = selectedField.table_columns || [];
                                                                            const n = cols.length + 1;
                                                                            updateField(selectedField.id, { table_columns: [...cols, { id: `col_${Date.now()}`, label: `Column ${n}` }] });
                                                                        }}
                                                                        className="w-full py-1.5 border border-dashed border-[hsl(var(--border))]/75 bg-[hsl(var(--surface-elevated))]/40 rounded-xl text-[10px] font-semibold text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--primary))]/45 hover:text-[hsl(var(--primary))] transition-all"
                                                                    >
                                                                        + Add Column
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Rows / Statements */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <label className="label !mb-0 text-xs">Rows (Statements)</label>
                                                                    <div className="flex items-center gap-0.5 bg-[hsl(var(--surface-elevated))]/80 rounded-lg p-0.5">
                                                                        <button
                                                                            onClick={() => {
                                                                                const rows = selectedField.table_rows || [];
                                                                                if (rows.length <= 1) return;
                                                                                updateField(selectedField.id, { table_rows: rows.slice(0, -1) });
                                                                            }}
                                                                            className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))] font-bold text-sm transition-all"
                                                                        >−</button>
                                                                        <span className="text-xs font-bold w-5 text-center tabular-nums">{(selectedField.table_rows || []).length}</span>
                                                                        <button
                                                                            onClick={() => {
                                                                                const rows = selectedField.table_rows || [];
                                                                                const n = rows.length + 1;
                                                                                updateField(selectedField.id, { table_rows: [...rows, { id: `row_${Date.now()}`, label: `Statement ${n}` }] });
                                                                            }}
                                                                            className="w-6 h-6 flex items-center justify-center rounded text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface))] font-bold text-sm transition-all"
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {(selectedField.table_rows || []).map((row, ri) => (
                                                                        <div key={row.id} className="flex items-center gap-1.5">
                                                                            <span className="text-[10px] text-[hsl(var(--text-tertiary))] w-4 text-right shrink-0 tabular-nums">{ri + 1}</span>
                                                                            <input
                                                                                value={row.label}
                                                                                onChange={e => {
                                                                                    const rows = [...(selectedField.table_rows || [])];
                                                                                    rows[ri] = { ...rows[ri], label: e.target.value };
                                                                                    updateField(selectedField.id, { table_rows: rows });
                                                                                }}
                                                                                className="input text-sm py-1.5 flex-1"
                                                                                placeholder={`Statement ${ri + 1}`}
                                                                            />
                                                                            <button
                                                                                onClick={() => {
                                                                                    const rows = (selectedField.table_rows || []).filter((_, i) => i !== ri);
                                                                                    updateField(selectedField.id, { table_rows: rows });
                                                                                }}
                                                                                className="p-1.5 hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg transition-all shrink-0"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            const rows = selectedField.table_rows || [];
                                                                            const n = rows.length + 1;
                                                                            updateField(selectedField.id, { table_rows: [...rows, { id: `row_${Date.now()}`, label: `Statement ${n}` }] });
                                                                        }}
                                                                        className="w-full py-1.5 border border-dashed border-[hsl(var(--border))]/75 bg-[hsl(var(--surface-elevated))]/40 rounded-xl text-[10px] font-semibold text-[hsl(var(--text-secondary))] hover:border-[hsl(var(--primary))]/45 hover:text-[hsl(var(--primary))] transition-all"
                                                                    >
                                                                        + Add Row
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {['object_collection', 'object_instance'].includes(selectedField.type) && (
                                                        <div className="space-y-4">
                                                            <div>
                                                                <label className="label">Object Schema ID</label>
                                                                <input
                                                                    value={selectedField.object_schema_key || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { object_schema_key: e.target.value })}
                                                                    className="input"
                                                                    placeholder="e.g. participant_profile"
                                                                />
                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1">
                                                                    The ID of the object schema to render here.
                                                                </p>
                                                            </div>

                                                            <div>
                                                                <label className="label">Catalog Source</label>
                                                                <select
                                                                    value={selectedField.catalog_source_type || ''}
                                                                    onChange={(e) => {
                                                                        const nextValue = e.target.value === 'project_catalog' ? 'project_catalog' : undefined;
                                                                        updateField(selectedField.id, { catalog_source_type: nextValue });
                                                                    }}
                                                                    className="input py-2"
                                                                >
                                                                    <option value="">None</option>
                                                                    <option value="project_catalog">Project Catalog</option>
                                                                </select>
                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1">
                                                                    Use the project catalog as a reusable reference source for row selection and default values.
                                                                </p>
                                                            </div>

                                                            {selectedField.catalog_source_type === 'project_catalog' && (
                                                                <div className="rounded-xl bg-[hsl(var(--surface-elevated))]/70 p-4 space-y-3">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div>
                                                                            <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Catalog Snapshot</p>
                                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                                                                {catalogItems.length} active item{catalogItems.length === 1 ? '' : 's'} available for this form.
                                                                            </p>
                                                                        </div>
                                                                        <button
                                                                            onClick={applyCatalogRowTemplate}
                                                                            className="rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                                                                        >
                                                                            Apply Catalog Row Template
                                                                        </button>
                                                                    </div>
                                                                    <p className="text-[10px] leading-5 text-[hsl(var(--text-tertiary))]">
                                                                        The template creates a reusable line-item row with item reference, quantity, unit price, and computed total fields backed by the current project catalog. You can then adapt the row properties below.
                                                                    </p>
                                                                </div>
                                                            )}

                                                            {selectedField.type === 'object_collection' && (
                                                                <>
                                                                    <div>
                                                                        <label className="label">Layout Style</label>
                                                                        <select
                                                                            value={selectedField.collection_layout || 'cards'}
                                                                            onChange={(e) => updateField(selectedField.id, { collection_layout: e.target.value as 'cards' | 'table' })}
                                                                            className="input py-2"
                                                                        >
                                                                            <option value="cards">Cards</option>
                                                                            <option value="table">Table</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                                            <div>
                                                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Allow Adding</p>
                                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Users can add new items</p>
                                                                            </div>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedField.allow_add_items ?? true}
                                                                                onChange={(e) => updateField(selectedField.id, { allow_add_items: e.target.checked })}
                                                                                className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                            />
                                                                        </div>
                                                                        <div className="flex items-center justify-between p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl">
                                                                            <div>
                                                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Allow Removing</p>
                                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Users can remove items</p>
                                                                            </div>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={selectedField.allow_remove_items ?? true}
                                                                                onChange={(e) => updateField(selectedField.id, { allow_remove_items: e.target.checked })}
                                                                                className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}

                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <label className="label !mb-0">Row Properties</label>
                                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-1">
                                                                            Define the row fields, editability rules, and computed formulas for this object schema.
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={addSelectedObjectProperty}
                                                                        className="rounded-md border border-transparent px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--text-secondary))] transition-all hover:bg-[hsl(var(--surface-elevated))]/80 hover:text-[hsl(var(--primary))]"
                                                                    >
                                                                        Add Property
                                                                    </button>
                                                                </div>

                                                                {selectedObjectProperties.length === 0 ? (
                                                                    <div className="rounded-xl border border-dashed border-[hsl(var(--border))]/55 bg-[hsl(var(--surface-elevated))]/40 p-4 text-center text-[11px] text-[hsl(var(--text-tertiary))]">
                                                                        No row properties defined yet.
                                                                    </div>
                                                                ) : selectedObjectProperties.map((property, propertyIndex) => (
                                                                    <div key={`${property.key}_${propertyIndex}`} className="rounded-xl bg-[hsl(var(--surface-elevated))]/70 p-4 space-y-3">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                                                Property {propertyIndex + 1}
                                                                            </p>
                                                                            <button
                                                                                onClick={() => removeSelectedObjectProperty(propertyIndex)}
                                                                                className="p-1.5 text-[hsl(var(--text-tertiary))] transition-all hover:text-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10 rounded-lg"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="label">Key</label>
                                                                                <input
                                                                                    value={property.key}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { key: toSmartValue(e.target.value || `property_${propertyIndex + 1}`) })}
                                                                                    className="input"
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="label">Label</label>
                                                                                <input
                                                                                    value={property.label || ''}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { label: e.target.value })}
                                                                                    className="input"
                                                                                />
                                                                            </div>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div>
                                                                                <label className="label">Type</label>
                                                                                <select
                                                                                    value={property.type}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { type: e.target.value as ObjectPropertyType })}
                                                                                    className="input py-2"
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
                                                                                <label className="label">Edit Mode</label>
                                                                                <select
                                                                                    value={property.edit_mode || 'editable'}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { edit_mode: e.target.value as ObjectPropertyEditMode })}
                                                                                    className="input py-2"
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
                                                                                <label className="label">Formula</label>
                                                                                <input
                                                                                    value={property.formula || ''}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { formula: e.target.value })}
                                                                                    className="input font-mono text-xs"
                                                                                    placeholder="e.g. quantity * unit_price"
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <div>
                                                                                <label className="label">Default Value</label>
                                                                                <input
                                                                                    value={property.default_value ?? ''}
                                                                                    onChange={(e) => updateSelectedObjectProperty(propertyIndex, { default_value: e.target.value })}
                                                                                    className="input"
                                                                                    placeholder="Optional"
                                                                                />
                                                                            </div>
                                                                        )}

                                                                        <label className="flex items-center justify-between rounded-xl bg-[hsl(var(--surface))] p-4 cursor-pointer shadow-sm">
                                                                            <div>
                                                                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">Required</p>
                                                                                <p className="text-[10px] text-[hsl(var(--text-tertiary))]">This row property must be present before submit.</p>
                                                                            </div>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!property.required}
                                                                                onChange={(e) => updateSelectedObjectProperty(propertyIndex, { required: e.target.checked })}
                                                                                className="h-4 w-4 rounded-md border-[hsl(var(--border))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                                                                            />
                                                                        </label>

                                                                        {property.reference?.source_type === 'catalog' && (
                                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                                                                This property uses the project item catalog and will map selected item values into sibling row fields when rendered on mobile.
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

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

                                                    {selectedField.type === 'toggle' && (
                                                        <div>
                                                            <label className="label">Binary Labels</label>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mb-2">Choose what the two states mean to respondents.</p>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {[
                                                                    { yes: 'Yes', no: 'No' },
                                                                    { yes: 'True', no: 'False' },
                                                                    { yes: 'On', no: 'Off' },
                                                                    { yes: 'Agree', no: 'Disagree' },
                                                                    { yes: 'Enabled', no: 'Disabled' },
                                                                    { yes: 'Allow', no: 'Deny' },
                                                                ].map(({ yes, no }) => {
                                                                    const currentYes = selectedField.options?.find(o => o.value === 'true')?.label;
                                                                    const isActive = currentYes === yes;
                                                                    return (
                                                                        <button
                                                                            key={yes}
                                                                            onClick={() => updateField(selectedField.id, {
                                                                                options: [
                                                                                    { label: yes, value: 'true' },
                                                                                    { label: no, value: 'false' },
                                                                                ],
                                                                            })}
                                                                            className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                                                                                isActive
                                                                                    ? 'border-[hsl(var(--primary))]/45 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                                                                    : 'border-transparent bg-[hsl(var(--surface-elevated))]/80 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                                            }`}
                                                                        >
                                                                            {yes} / {no}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {['dropdown', 'radio_group', 'checkbox_group'].includes(selectedField.type) && (
                                                        <div>
                                                            <label className="label">Choices</label>
                                                            <div className="space-y-2">
                                                                {(selectedField.options || []).map((opt, idx) => (
                                                                    <div key={idx} className="p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl space-y-2">
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
                                                                    className="w-full py-2 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-semibold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                                >
                                                                    + Add Option
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {selectedField.type === 'lookup_list' && (
                                                        <div className="space-y-4">
                                                            <div className="flex gap-1 bg-[hsl(var(--surface-elevated))]/60 p-1 rounded-xl w-full text-xs">
                                                                <button
                                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedField.lookup_source_type === 'preset' ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20' : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] bg-transparent hover:bg-transparent'}`}
                                                                    onClick={() => updateField(selectedField.id, { lookup_source_type: 'preset' })}
                                                                >
                                                                    Preset Data
                                                                </button>
                                                                <button
                                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedField.lookup_source_type === 'custom' ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20' : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] bg-transparent hover:bg-transparent'}`}
                                                                    onClick={() => updateField(selectedField.id, { lookup_source_type: 'custom' })}
                                                                >
                                                                    Custom List (CSV)
                                                                </button>
                                                            </div>

                                                            {selectedField.lookup_source_type === 'preset' && (
                                                                <div>
                                                                    <label className="label">Dataset</label>
                                                                    <select
                                                                        value={selectedField.lookup_preset_id || ''}
                                                                        onChange={(e) => updateField(selectedField.id, { lookup_preset_id: e.target.value })}
                                                                        className="input py-2 flex-1 w-full"
                                                                    >
                                                                        <option value="">Select a dataset...</option>
                                                                        <option value="global_countries">All Countries</option>
                                                                        <option value="african_countries">African Countries</option>
                                                                        <option value="us_states">US States</option>
                                                                    </select>
                                                                </div>
                                                            )}

                                                            {selectedField.lookup_source_type === 'custom' && (
                                                                <div className="space-y-3">
                                                                    <div>
                                                                        <label className="label">CSV / Text Data</label>
                                                                        <textarea
                                                                            value={selectedField.lookup_custom_data || ''}
                                                                            onChange={(e) => updateField(selectedField.id, { lookup_custom_data: e.target.value })}
                                                                            className="input min-h-[120px] font-mono text-xs whitespace-pre"
                                                                            placeholder="Paste comma-separated values, or one item per line..."
                                                                        />
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <div>
                                                                            <label className="label text-[10px] mb-1">Separator</label>
                                                                            <input
                                                                                value={selectedField.lookup_separator || ''}
                                                                                onChange={(e) => updateField(selectedField.id, { lookup_separator: e.target.value })}
                                                                                className="input text-xs"
                                                                                placeholder="e.g. ,"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="label text-[10px] mb-1">Label Col</label>
                                                                            <input
                                                                                type="number"
                                                                                value={selectedField.lookup_label_column ?? 0}
                                                                                onChange={(e) => updateField(selectedField.id, { lookup_label_column: parseInt(e.target.value) || 0 })}
                                                                                className="input text-xs"
                                                                            />
                                                                        </div>
                                                                        <div>
                                                                            <label className="label text-[10px] mb-1">Value Col</label>
                                                                            <input
                                                                                type="number"
                                                                                value={selectedField.lookup_value_column ?? 0}
                                                                                onChange={(e) => updateField(selectedField.id, { lookup_value_column: parseInt(e.target.value) || 0 })}
                                                                                className="input text-xs"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            let parsedCount = 0;
                                                                            if (selectedField.lookup_custom_data) {
                                                                                parsedCount = selectedField.lookup_custom_data.split('\n').filter(Boolean).length;
                                                                            }
                                                                            showToast('Data Validated', `Successfully parsed ${parsedCount} rows from your CSV data.`, 'success');
                                                                        }}
                                                                        className="w-full py-2.5 bg-[hsl(var(--surface-elevated))]/60 hover:bg-[hsl(var(--primary))]/10 border border-transparent rounded-xl text-xs font-semibold text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-all flex items-center justify-center space-x-2 shadow-sm"
                                                                    >
                                                                        <CheckSquare className="w-4 h-4" />
                                                                        <span>Validate Data Structure</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {selectedField.type === 'input_text' && (
                                                        <div>
                                                            <label className="label flex items-center justify-between">
                                                                <span>Input Mask Format</span>
                                                            </label>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mb-1.5 leading-tight">Use <strong className="text-[hsl(var(--text-primary))]">9</strong> for numbers, <strong className="text-[hsl(var(--text-primary))]">A</strong> for uppercase, <strong className="text-[hsl(var(--text-primary))]">a</strong> for lowercase, and <strong className="text-[hsl(var(--text-primary))]">*</strong> for any character. Symbols render as-is.</p>
                                                            <div className="flex gap-2 mb-2 flex-wrap">
                                                                {[
                                                                    { label: 'None', val: '' },
                                                                    { label: 'Phone', val: '+233 99 999 9999' },
                                                                    { label: 'Card', val: '9999-9999-9999-9999' },
                                                                    { label: 'Date', val: '99/99/9999' },
                                                                    { label: 'Ghana Card', val: 'GHA-999999999-9' }
                                                                ].map(preset => (
                                                                    <button
                                                                        key={preset.label}
                                                                        onClick={() => updateField(selectedField.id, { mask: preset.val })}
                                                                        className={`px-2.5 py-1 text-[10px] rounded-lg font-semibold transition-all ${
                                                                            selectedField.mask === preset.val || (!selectedField.mask && preset.val === '')
                                                                                ? 'bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/30 text-[hsl(var(--primary))]'
                                                                                : 'bg-[hsl(var(--surface-elevated))]/60 border border-transparent text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/90 hover:text-[hsl(var(--text-primary))]'
                                                                        }`}
                                                                    >
                                                                        {preset.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <input
                                                                value={selectedField.mask || ''}
                                                                onChange={(e) => updateField(selectedField.id, { mask: e.target.value || undefined })}
                                                                className="input font-mono text-sm"
                                                                placeholder="e.g. (999) 999-9999"
                                                            />
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

                                                    {selectedField.type === 'rating_scale' && (
                                                        <div className="space-y-4 animate-in fade-in duration-200">
                                                            <div className="flex items-center gap-2">
                                                                <Star className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                                                <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--primary))]">Scale Configuration</span>
                                                                <div className="flex-1 h-px bg-[hsl(var(--border))]" />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <label className="label">Min Value</label>
                                                                    <input
                                                                        type="number"
                                                                        value={selectedField.min || 1}
                                                                        onChange={(e) => updateField(selectedField.id, { min: parseInt(e.target.value) || 1 })}
                                                                        className="input"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="label">Max Value</label>
                                                                    <input
                                                                        type="number"
                                                                        value={selectedField.max || 5}
                                                                        onChange={(e) => updateField(selectedField.id, { max: parseInt(e.target.value) || 5 })}
                                                                        className="input"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="label">Min Label</label>
                                                                <input
                                                                    value={selectedField.min_label || ''}
                                                                    placeholder="e.g. Not at all"
                                                                    onChange={(e) => updateField(selectedField.id, { min_label: e.target.value })}
                                                                    className="input"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="label">Max Label</label>
                                                                <input
                                                                    value={selectedField.max_label || ''}
                                                                    placeholder="e.g. Extremely likely"
                                                                    onChange={(e) => updateField(selectedField.id, { max_label: e.target.value })}
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

                                                    {['date_picker', 'time_picker'].includes(selectedField.type) && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="label">Min {selectedField.type === 'date_picker' ? 'Date' : 'Time'}</label>
                                                                <input
                                                                    type={selectedField.type === 'date_picker' ? 'date' : 'time'}
                                                                    value={selectedField.min || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { min: e.target.value || undefined })}
                                                                    className="input"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="label">Max {selectedField.type === 'date_picker' ? 'Date' : 'Time'}</label>
                                                                <input
                                                                    type={selectedField.type === 'date_picker' ? 'date' : 'time'}
                                                                    value={selectedField.max || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { max: e.target.value || undefined })}
                                                                    className="input"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="label">Platforms</label>
                                                        <div className="grid grid-cols-1 gap-2">
                                                            {(['mobile', 'web', 'ussd'] as Platform[]).map((platform) => (
                                                                <label key={platform} className="flex items-center space-x-3 p-2.5 bg-[hsl(var(--surface-elevated))]/60 rounded-xl border border-transparent cursor-pointer hover:bg-[hsl(var(--surface-elevated))] transition-all">
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

                                                    {selectedField.type === 'input_number' && (
                                                        <div>
                                                            <label className="label">Computed Formula</label>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mb-1.5">
                                                                Optional. Example: <span className="font-mono">sum(line_items.line_total)</span>. When set, this field becomes read-only in the runtime.
                                                            </p>
                                                            <input
                                                                value={selectedField.formula || ''}
                                                                onChange={(e) => updateField(selectedField.id, { formula: e.target.value || undefined })}
                                                                className="input font-mono text-xs"
                                                                placeholder="e.g. sum(line_items.line_total)"
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Default Value — not applicable for matrix tables */}
                                                    {selectedField.type !== 'matrix_table' && (
                                                        <div>
                                                            <label className="label">Default Value</label>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mb-1.5">Pre-filled automatically; overridable during administration.</p>
                                                            {['dropdown', 'radio_group'].includes(selectedField.type) ? (
                                                                <select
                                                                    value={selectedField.default_value || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                    className="input text-sm py-2"
                                                                >
                                                                    <option value="">No Default</option>
                                                                    {(selectedField.options || []).map((o, i) => (
                                                                        <option key={i} value={o.value}>{o.label}</option>
                                                                    ))}
                                                                </select>
                                                            ) : selectedField.type === 'toggle' ? (
                                                                <div className="flex gap-2 mt-2">
                                                                    {[
                                                                        { label: selectedField.options?.find(o => o.value === 'true')?.label ?? 'Yes', value: 'true' },
                                                                        { label: selectedField.options?.find(o => o.value === 'false')?.label ?? 'No', value: 'false' },
                                                                        { label: 'None', value: '' },
                                                                    ].map(({ label, value }) => {
                                                                        const active = (selectedField.default_value ?? '') === value;
                                                                        return (
                                                                            <button
                                                                                key={value}
                                                                                onClick={() => updateField(selectedField.id, { default_value: value || undefined })}
                                                                                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                                                                                    active
                                                                                        ? 'border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                                                        : 'border border-transparent bg-[hsl(var(--surface-elevated))]/60 text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]'
                                                                                }`}
                                                                            >
                                                                                {label}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : selectedField.type === 'textarea' ? (
                                                                <textarea
                                                                    value={selectedField.default_value || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                    className="input min-h-[80px]"
                                                                    placeholder="Enter default text..."
                                                                />
                                                            ) : (
                                                                <input
                                                                    type={['input_number', 'lookup_list'].includes(selectedField.type) ? 'number' : selectedField.type === 'date_picker' ? 'date' : selectedField.type === 'time_picker' ? 'time' : 'text'}
                                                                    value={selectedField.default_value || ''}
                                                                    onChange={(e) => updateField(selectedField.id, { default_value: e.target.value || undefined })}
                                                                    className="input"
                                                                    placeholder={selectedField.type === 'input_text' ? "e.g. Yes, 0, Ghana..." : selectedField.type === 'lookup_list' ? "Index (0 = first item)..." : ""}
                                                                />
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Flags — not applicable for matrix tables */}
                                                    {selectedField.type !== 'matrix_table' && (
                                                        <div className="space-y-2">
                                                            <label className="label">Field Flags</label>
                                                            {[
                                                                { key: 'is_sensitive', label: 'Sensitive', desc: 'Contains PII or health data' },
                                                                { key: 'exclude_from_export', label: 'Exclude from Export', desc: 'Hide from data views & CSV exports' },
                                                            ].map(({ key, label, desc }) => (
                                                                <label key={key} className="flex items-center justify-between p-3 bg-[hsl(var(--surface-elevated))]/60 rounded-xl border border-transparent cursor-pointer hover:bg-[hsl(var(--surface-elevated))] transition-all">
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
                                                    )}
                                                </div>

                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6 animate-in fade-in duration-200">
                                                                                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-sm font-bold flex items-center">
                                                            <Zap className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                                                            Field Logic
                                                        </h3>
                                                    </div>
                                                    <p className="text-[hsl(var(--text-secondary))] text-xs">Define rules for when this field should be visible.</p>

                                                    <div className="space-y-4">
                                                        {logic.filter(r => r.type === 'field_visibility' && r.target_id === selectedField.id).map(rule => (
                                                            <div key={rule.id} className="p-4 bg-[hsl(var(--surface-elevated))]/60 rounded-xl space-y-4 relative group">
                                                                <button
                                                                    onClick={() => removeLogicRule(rule.id)}
                                                                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-all hover:bg-[hsl(var(--error))]/10 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] rounded-lg"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>

                                                                {/* Timing badge */}
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 px-2 py-0.5 rounded-lg">IF</span>
                                                                    <div className="flex items-center bg-[hsl(var(--surface-elevated))]/40 p-0.5 gap-0.5 rounded-xl">
                                                                        {(['pre', 'post'] as const).map(t => (
                                                                            <button
                                                                                key={t}
                                                                                onClick={() => updateLogicRule(rule.id, { timing: t })}
                                                                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${rule.timing === t
                                                                                    ? 'bg-[hsl(var(--surface))] text-[hsl(var(--primary))] shadow-sm border border-[hsl(var(--border))]/20'
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
                                                            className="w-full py-3 border border-dashed border-[hsl(var(--border))]/55 rounded-xl text-xs font-bold text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))] transition-all bg-[hsl(var(--surface-elevated))]/20 hover:bg-[hsl(var(--surface-elevated))]/40"
                                                        >
                                                            + Add Visibility Rule
                                                        </button>
                                                    </div>

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

                                    {activeSidebarTab === 'console' && (
                                        <div className="flex-1 flex flex-col overflow-hidden">
                                            <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/55 px-4 py-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))]">Builder Panel</p>
                                                        <h3 className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">Form Console</h3>
                                                    </div>
                                                    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                        {view === 'flow' ? 'flow' : 'inspector'}
                                                    </div>
                                                </div>
                                            </div>

                                                                            <div className="p-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))]/90 backdrop-blur-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div ref={multiActionMenuRef} className="relative">
                                            <div className="w-full flex rounded-md overflow-hidden border border-[hsl(var(--primary))] shadow-lg shadow-black/10">
                                                <button
                                                    onClick={handleSave}
                                                    disabled={isSaving || isPublishing}
                                                    className="flex-1 flex items-center justify-center px-3 py-2.5 bg-[hsl(var(--primary))] text-white hover:brightness-110 transition-all disabled:opacity-60"
                                                    title="Save draft"
                                                >
                                                    <span className="font-semibold text-sm">{isSaving ? 'Saving...' : 'Save Draft'}</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowMultiActionMenu(prev => {
                                                            const next = !prev;
                                                            if (!next) setShowBackupTools(false);
                                                            return next;
                                                        });
                                                    }}
                                                    disabled={isSaving || isPublishing}
                                                    className="w-10 flex items-center justify-center bg-[hsl(var(--primary))] text-white border-l border-white/20 hover:brightness-110 transition-all disabled:opacity-60"
                                                    title="More actions"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {showMultiActionMenu && (
                                                <div className="absolute left-0 top-full mt-2 w-72 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md shadow-2xl z-50 overflow-hidden p-2 space-y-2">
                                                    <button
                                                        onClick={async () => {
                                                            setShowMultiActionMenu(false);
                                                            setShowBackupTools(false);
                                                            await handlePublish();
                                                        }}
                                                        className="w-full text-left px-3 py-2.5 text-sm font-semibold text-[hsl(var(--success))] bg-[hsl(var(--success))]/12 hover:bg-[hsl(var(--success))]/18 rounded-md transition-all duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_1px_6px_rgba(34,197,94,0.10)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(34,197,94,0.20),0_3px_10px_rgba(34,197,94,0.16)] flex items-center space-x-2"
                                                    >
                                                        <Zap className="w-4 h-4 text-[hsl(var(--success))]" />
                                                        <span>Publish</span>
                                                    </button>

                                                    <button
                                                        onClick={() => setShowBackupTools((prev) => !prev)}
                                                        className="w-full text-left px-3 py-2 text-xs font-semibold tracking-wide text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] transition-colors flex items-center justify-between"
                                                    >
                                                        <span>Backup Tools</span>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBackupTools ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {showBackupTools && (
                                                        <div className="px-1 py-1 bg-[hsl(var(--surface-elevated))]/20 rounded-md space-y-1.5">
                                                            {[2, 3].map((slot) => {
                                                                const backup = getSlotVersion(slot as 2 | 3);
                                                                const shortLabel = slot === 2 ? 'A' : 'B';
                                                                const isPreviewing = previewSlot === slot;
                                                                const previewBlueprint = isPreviewing ? backup?.blueprint : null;
                                                                const sectionCount = previewBlueprint?.ui?.length || 0;
                                                                const fieldCount = previewBlueprint?.ui?.reduce((acc: number, s: any) => acc + ((s.children || []).length), 0) || 0;

                                                                return (
                                                                    <div
                                                                        key={slot}
                                                                        className="group rounded-lg px-2 py-1.5 bg-gradient-to-r from-[hsl(var(--surface))] via-[hsl(var(--surface-elevated))]/55 to-[hsl(var(--surface))] shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_8px_rgba(15,23,42,0.08)] transition-all duration-200 hover:brightness-[1.02] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_14px_rgba(15,23,42,0.12)]"
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <p className="text-[10px] font-medium text-[hsl(var(--text-tertiary))] truncate">
                                                                                {backup ? `v${backup.version_number}` : 'Empty'}
                                                                                {isPreviewing && backup ? ` · ${sectionCount}s ${fieldCount}f` : ''}
                                                                            </p>
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[11px] font-semibold text-[hsl(var(--text-primary))] w-3 text-center transition-colors group-hover:text-[hsl(var(--primary))]">{shortLabel}</span>
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        await handleSaveToBackup(slot as 2 | 3);
                                                                                    }}
                                                                                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-[hsl(var(--surface))]/75 hover:bg-[hsl(var(--surface))] transition-all duration-150 hover:scale-105 active:scale-95"
                                                                                    title={`Save current draft to backup ${shortLabel}`}
                                                                                >
                                                                                    <Save className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => setPreviewSlot(isPreviewing ? null : (slot as 2 | 3))}
                                                                                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-[hsl(var(--surface))]/75 hover:bg-[hsl(var(--surface))] transition-all duration-150 hover:scale-105 active:scale-95"
                                                                                    title={`Preview backup ${shortLabel}`}
                                                                                >
                                                                                    <Eye className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        setShowMultiActionMenu(false);
                                                                                        setShowBackupTools(false);
                                                                                        await handleRestoreBackupToDraft(slot as 2 | 3);
                                                                                    }}
                                                                                    disabled={!backup}
                                                                                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-[hsl(var(--surface))]/75 hover:bg-[hsl(var(--surface))] transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-40"
                                                                                    title={`Restore backup ${shortLabel} into draft`}
                                                                                >
                                                                                    <RotateCcw className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={() => {
                                                    if (view === 'section') {
                                                        setShowSimulatorMenu(!showSimulatorMenu);
                                                    } else {
                                                        navigate(`/simulator/${formId}`);
                                                    }
                                                }}
                                                className="w-full flex items-center justify-center space-x-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary-hover))] px-3 py-2.5 rounded-md transition-all shadow-lg shadow-black/10 text-white"
                                            >
                                                <Play className="w-4 h-4" />
                                                <span className="font-semibold text-sm">Simulator</span>
                                            </button>

                                            {showSimulatorMenu && (
                                                <div className="absolute right-0 top-full mt-2 w-56 bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-md shadow-xl z-50 overflow-hidden">
                                                    <button
                                                        onClick={() => {
                                                            setShowSimulatorMenu(false);
                                                            navigate(`/simulator/${formId}`);
                                                        }}
                                                        className="w-full text-left px-4 py-3 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors border-b border-[hsl(var(--border))] flex items-center space-x-2"
                                                    >
                                                        <Play className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                        <span>Run From Beginning</span>
                                                    </button>
                                                    {view === 'section' && (
                                                        <button
                                                            onClick={() => {
                                                                setShowSimulatorMenu(false);
                                                                navigate(`/simulator/${formId}?section=${currentSectionId}`);
                                                            }}
                                                            className="w-full text-left px-4 py-3 text-sm font-medium text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--surface-elevated))] transition-colors flex items-center space-x-2"
                                                        >
                                                            <Layers className="w-4 h-4 text-[hsl(var(--primary))]" />
                                                            <span>Run Current Section</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 text-xs text-[hsl(var(--text-tertiary))] space-y-2">
                                    <p className="font-semibold uppercase tracking-[0.18em]">Summary</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/50 px-3 py-2">
                                            <p className="text-[10px] uppercase tracking-wider">Sections</p>
                                            <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">{sections.length}</p>
                                        </div>
                                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))]/50 px-3 py-2">
                                            <p className="text-[10px] uppercase tracking-wider">Fields</p>
                                            <p className="mt-1 text-sm font-semibold text-[hsl(var(--text-primary))]">{sections.reduce((acc, s) => acc + s.fields.length, 0)}</p>
                                        </div>
                                    </div>
                                </div>

                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Far-Right Vertical Rail */}
                        <div
                            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                            className="w-14 flex flex-col items-center gap-3 py-3 px-2 border-l border-[hsl(var(--border))]/40 bg-[hsl(var(--surface-elevated))]/30 cursor-pointer hover:bg-[hsl(var(--surface-elevated))]/55 transition-all"
                        >
                            {(['section', 'widget', 'console'] as const).map((tab) => {
                                const Icon = tab === 'section' ? Settings : tab === 'widget' ? Type : Terminal;
                                const tooltip = tab === 'section' ? 'Section Settings' : tab === 'widget' ? 'Widget Settings' : 'Form Console';
                                const isActive = isRightSidebarOpen && activeSidebarTab === tab;
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
                                        className={`h-10 w-10 inline-flex items-center justify-center rounded-lg border transition-all ${
                                            isActive
                                                ? 'border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                                                : 'border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))] hover:border-[hsl(var(--primary))]/30 hover:text-[hsl(var(--primary))]'
                                        }`}
                                        title={tooltip}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </button>
                                );
                            })}
                            <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--text-tertiary))] mt-2">
                                Settings & Console
                            </div>
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
            </div>
        </StudioLayout >
    );
};

export default FormBuilder;
