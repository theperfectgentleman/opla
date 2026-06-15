// ─── Core User ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
  name: string; // display name
  is_platform_admin?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
}

// ─── Auth Session (stored locally) ────────────────────────────────────────
export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp of last successful online auth */
  onlineAuthAt: string;
  /** Hashed PIN (sha256 hex). Null if PIN not yet set. */
  pinHash: string | null;
  /** Which orgs user belongs to (lightweight; not full details) */
  orgIds: string[];
}

// ─── Form Blueprint (canonical definition shared with Studio) ──────────────
export type FieldType =
  | 'input_text'
  | 'input_number'
  | 'email_input'
  | 'phone_input'
  | 'date_picker'
  | 'time_picker'
  | 'time_range'
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
  | 'object_instance'
  | 'object_collection'
  | 'form_link';

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'select'
  | 'reference'
  | 'computed'
  | 'object'
  | 'object_collection';

export type ObjectPropertyEditMode = 'fixed' | 'defaulted' | 'editable' | 'hidden';

export interface CatalogSourceItem {
  id: string;
  sku_code: string;
  label: string;
  default_price?: number | null;
  unit?: string | null;
  brand?: string | null;
  price_editable?: boolean;
  is_active?: boolean;
}

export interface ObjectReferenceDefinition {
  source_type: 'dataset' | 'catalog' | 'user' | 'team' | 'submission' | 'custom';
  source_id?: string;
  label_field?: string;
  value_field?: string;
  filters?: Record<string, any>;
  source_items?: CatalogSourceItem[];
  field_mappings?: Record<string, string>;
}

export interface FormObjectDefinition {
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

export interface ObjectPropertyDefinition {
  key: string;
  type: SchemaFieldType;
  label?: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  default_value?: any;
  edit_mode?: ObjectPropertyEditMode;
  formula?: string;
  reference?: ObjectReferenceDefinition;
  properties?: ObjectPropertyDefinition[];
  item_definition?: FormObjectDefinition;
}

export interface FormSchemaField extends ObjectPropertyDefinition {
  id?: string;
  field_id?: string;
  dataset_field_id?: string;
}

export type Platform = 'mobile' | 'web' | 'ussd';
export type FormArea = 'yard' | 'desk'; // which app area can use this form

export interface FieldOption {
  label: string;
  value: string;
  skip_to?: string;
}

export interface TableColumn { id: string; label: string; }
export interface TableRow    { id: string; label: string; }
export type TableCellType = 'checkbox' | 'radio' | 'text' | 'number' | 'dropdown';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  formula?: string;
  bind?: string;
  placeholder?: string;
  options?: FieldOption[];
  platforms?: Platform[];
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default_value?: string;
  is_sensitive?: boolean;
  exclude_from_export?: boolean;
  mask?: string;
  // matrix
  table_columns?: TableColumn[];
  table_rows?: TableRow[];
  table_cell_type?: TableCellType;
  table_allow_multiple?: boolean;
  // lookup
  lookup_source_type?: 'dataset' | 'preset' | 'custom';
  lookup_preset_id?: string;
  lookup_dataset_id?: string;
  lookup_dataset_label_field?: string;
  lookup_dataset_value_field?: string;
  lookup_sync_interval_minutes?: number;
  lookup_allow_stale_cache?: boolean;
  lookup_custom_data?: string;
  lookup_separator?: string;
  lookup_label_column?: number | string;
  lookup_value_column?: number | string;
  // rating scale
  min_label?: string;
  max_label?: string;
  // object instance / collection
  object_schema_key?: string;
  object_definition?: FormObjectDefinition;
  collection_layout?: 'cards' | 'table';
  allow_add_items?: boolean;
  allow_remove_items?: boolean;
  catalog_source_type?: 'project_catalog';

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

  // Form link support (launcher / menu hub)
  linked_form_id?: string;
  linked_form_slug?: string;
  /** Maps source_field_id → target_field_id for parameter passing */
  linked_form_param_map?: Record<string, string>;

  // Input parameter annotations (for fields that receive data from a parent form)
  is_input_param?: boolean;
  input_param_readonly?: boolean;
}

export type RenderMode = 'single' | 'list';

export interface SectionProperties {
  render_mode: RenderMode;
  description?: string;
  platforms?: Platform[];
  is_repeatable?: boolean;
  max_repeats?: number;
  shuffle_options?: boolean;
}

export interface FormSection {
  id: string;
  type: 'screen';
  title: string;
  template_id?: string;
  layout?: {
    x?: number;
    y?: number;
    width?: number;
    collapsed?: boolean;
    collapse_mode?: 'full' | 'summary' | 'title';
  };
  render_mode: RenderMode;
  description?: string;
  platforms?: Platform[];
  is_repeatable?: boolean;
  max_repeats?: number;
  shuffle_options?: boolean;
  children: FormField[];
}

// ─── Centralized Rules Engine (v2) ──────────────────────────────────────────

/**
 * Comparison operators available in rule conditions.
 * The runtime picks which operators are valid based on the source field type.
 */
export type RuleOperator =
  | '=='       // equals (works on all types)
  | '!='       // not equals
  | '>'        // greater than (number, date)
  | '<'        // less than (number, date)
  | '>='       // greater than or equal
  | '<='       // less than or equal
  | 'contains'     // array/string contains value
  | 'not_contains' // array/string does not contain value
  | 'empty'        // field is null, undefined, or empty string/array
  | 'not_empty'    // field has a meaningful value
  | 'between';     // value is between two bounds (for number/date)

/**
 * A leaf rule node — a single condition comparing a field value to a target.
 */
export interface RuleConditionNode {
  id: string;
  type: 'rule';
  /** The field ID whose value to evaluate */
  field: string;
  /** The comparison operator */
  operator: RuleOperator;
  /** The target value to compare against. For 'between', use "min,max" string. For 'empty'/'not_empty', this is ignored. */
  value: any;
}

/**
 * A group node — combines child nodes (rules or sub-groups) with AND/OR.
 * This is the recursive building block that allows arbitrary nesting.
 */
export interface RuleGroupNode {
  id: string;
  type: 'group';
  /** How to combine children results: AND = all must pass, OR = any must pass */
  combinator: 'AND' | 'OR';
  /** Child nodes — can be leaf rules or nested groups */
  children: RuleNode[];
}

/** A node in the rule tree is either a leaf condition or a group. */
export type RuleNode = RuleConditionNode | RuleGroupNode;

/**
 * The actions that a rule can trigger when its condition tree evaluates to true.
 */
export type RuleActionEffect =
  | 'SHOW'            // Make target field/section visible
  | 'HIDE'            // Hide target field/section
  | 'REQUIRE'         // Make target field required
  | 'UNREQUIRE'       // Make target field optional
  | 'DISABLE_NAV'     // Block the "Next" button with a message
  | 'ENABLE_NAV'      // Unblock the "Next" button
  | 'FILTER_OPTIONS'  // Filter the options of a target dropdown/lookup based on a mapping
  | 'SET_VALUE'       // Set a field to a specific value
  | 'VALIDATE'        // Run custom validation with an error message
  | 'JUMP_TO_SECTION'; // Navigate to a specific section (evaluated on Next press only)

/**
 * The action consequence when a rule's conditions are met.
 */
export interface RuleAction {
  /** What effect to apply */
  effect: RuleActionEffect;
  /** The field ID or section ID this action targets */
  target_id: string;
  /** Whether target is a field or section */
  target_type: 'field' | 'section' | 'navigation';
  /** Extra config depending on effect:
   * - FILTER_OPTIONS: { filter_key: string, filter_map?: Record<string, FieldOption[]> }
   * - DISABLE_NAV: { message: string }
   * - SET_VALUE: { value: any }
   * - VALIDATE: { error_message: string }
   */
  config?: Record<string, any>;
}

/**
 * A complete rule definition — one entry in blueprint.rules[].
 * Pattern: IF [condition_tree evaluates true] THEN [apply actions].
 * When condition_tree evaluates false, the inverse is implicitly applied
 * (e.g., SHOW→HIDE, REQUIRE→UNREQUIRE).
 */
export interface FormRule {
  id: string;
  /** Human-readable name shown in Studio (e.g., "Show reason when qty is 0") */
  name: string;
  /** Optional description for documentation */
  description?: string;
  /** Whether this rule is active — allows toggling without deleting */
  enabled: boolean;
  /** The nested condition tree (root is always a group node) */
  condition: RuleGroupNode;
  /** The actions to execute when condition evaluates to true */
  actions: RuleAction[];
  /** Evaluation priority — lower numbers run first. Default 0. */
  priority?: number;
  /** The anchor/trigger field or section ID */
  trigger_id?: string;
  /** Whether trigger is a field or section */
  trigger_type?: 'field' | 'section';
  /** Whether it evaluates reactively (pre) or on screen exit/validation (post) */
  timing?: 'pre' | 'post';
}

/**
 * Maps field/schema types to the operators that make sense for them.
 * Used by the Studio rules builder to show relevant operators.
 */
export const RULE_OPERATORS_BY_FIELD_TYPE: Record<string, RuleOperator[]> = {
  string:           ['==', '!=', 'contains', 'not_contains', 'empty', 'not_empty'],
  number:           ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  integer:          ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  decimal:          ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  boolean:          ['==', '!='],
  date:             ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  datetime:         ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  time:             ['==', '!=', '>', '<', 'empty', 'not_empty'],
  select:           ['==', '!=', 'empty', 'not_empty'],
  dropdown:         ['==', '!=', 'empty', 'not_empty'],
  radio_group:      ['==', '!=', 'empty', 'not_empty'],
  checkbox_group:   ['contains', 'not_contains', 'empty', 'not_empty'],
  multi_select_dropdown: ['contains', 'not_contains', 'empty', 'not_empty'],
  toggle:           ['==', '!='],
  input_text:       ['==', '!=', 'contains', 'not_contains', 'empty', 'not_empty'],
  input_number:     ['==', '!=', '>', '<', '>=', '<=', 'between', 'empty', 'not_empty'],
  form_link:        [],
};

export interface FormBlueprintMeta {
  app_id: string;
  app_id_slug: string;
  form_id: string;
  version: number;
  title: string;
  slug: string;
  is_public: boolean;
  /** Which area this form is intended for. Defaults to 'yard' when public. */
  area?: FormArea;
  /** Controls whether this form appears in the mobile form list.
   *  'listed' (default) = visible in form list.
   *  'child' = hidden from list, only accessible via a parent form's form_link. */
  visibility?: 'listed' | 'child';
  theme: {
    primary_color: string;
    mode: string;
  };
}

export interface FormBlueprint {
  meta: FormBlueprintMeta;
  schema: FormSchemaField[];
  ui: FormSection[];
  rules: FormRule[];
  /** Form IDs referenced by form_link fields — used for dependency resolution during sync */
  linked_form_ids?: string[];
}

// ─── Submission ────────────────────────────────────────────────────────────
export interface SubmissionMetadata {
  source: string; // e.g. 'mobile_yard' | 'mobile_desk' | 'web_simulator'
  area: FormArea;
  user_agent?: string;
  device_id?: string;
  offline_queued_at?: string;
  sync_version?: number;
}

export interface DraftSubmission {
  id: string; // local uuid
  form_id: string;
  data: Record<string, any>;
  metadata: SubmissionMetadata;
  created_at: string;
  synced: boolean;
}

