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
  | 'object_instance'
  | 'object_collection';

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
  lookup_label_column?: number;
  lookup_value_column?: number;
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

export type LogicOperator = 'AND' | 'OR';
export type ConditionOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';

export interface LogicCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface LogicRule {
  id: string;
  type: 'section_jump' | 'field_visibility' | 'section_visibility' | 'section_skip';
  timing: 'pre' | 'post';
  action: 'jump_to' | 'show' | 'hide' | 'skip';
  target_id: string;
  source_id?: string;
  conditions: LogicCondition[];
  logic_operator: LogicOperator;
}

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
  theme: {
    primary_color: string;
    mode: string;
  };
}

export interface FormBlueprint {
  meta: FormBlueprintMeta;
  schema: FormSchemaField[];
  ui: FormSection[];
  logic: LogicRule[];
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

