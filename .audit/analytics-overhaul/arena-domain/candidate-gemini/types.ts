/**
 * Candidate Gemini Domain Types
 * Analytics Overhaul - Arena Candidate
 */

export type UUID = string;

// ============================================================================
// 1. Data Sources & Prep Derived Tables (Prep-derived tables ARE NOT LIVE Forms)
// ============================================================================

export interface AnalyticsSourceFieldOption {
	label: string;
	value: string;
}

export interface AnalyticsSourceField {
	field_identifier: string;
	field_key: string;
	label?: string;
	field_type: 'string' | 'number' | 'boolean' | 'date' | 'gps' | 'select';
	options?: AnalyticsSourceFieldOption[];
}

export interface StoredDerivedColumn {
	key: string;
	label: string;
	field_type: 'string' | 'number' | 'boolean' | 'date';
	formula: string; // HyperFormula formula re-runnable on server AST
}

export type DerivedTableMode = 'snapshot' | 'linked';

export interface AnalyticsSourceDerived {
	kind: 'derived';
	mode: DerivedTableMode;
	parent_dataset_id?: UUID; // Required if mode === 'linked'
	columns: StoredDerivedColumn[];
}

export interface AnalyticsSource {
	dataset_id: UUID;
	form_id?: UUID; // Optional: prep-derived tables do NOT have form_id
	dataset_name: string;
	dataset_slug: string;
	project_id?: UUID;
	project_name?: string;
	fields: AnalyticsSourceField[];
	record_count: number;
	derived?: AnalyticsSourceDerived;
}

export interface DerivedTableCreate {
	name: string;
	mode: DerivedTableMode;
	parent_dataset_id: UUID;
	project_id?: UUID;
	columns: StoredDerivedColumn[];
	rows?: Record<string, unknown>[]; // Required if mode === 'snapshot'
}

// ============================================================================
// 2. Query Engine AST (Shared by Studio & Backend execute_query)
// ============================================================================

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

export interface AggregateSpec {
	field: string;
	fn: AggregateFn;
	alias?: string;
}

export interface GroupBySpec {
	field: string;
	bucket?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export interface OrderSpec {
	field: string;
	direction: 'asc' | 'desc';
}

export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'is_null' | 'not_null';

export interface FilterRule {
	field: string;
	op: FilterOp;
	value?: unknown;
}

export interface FilterGroup {
	logic: 'and' | 'or';
	rules: (FilterRule | FilterGroup)[];
}

export interface AnalyticsQueryRequest {
	dataset_id: UUID;
	select_fields?: string[];
	filters?: FilterGroup;
	group_by?: GroupBySpec[];
	aggregates?: AggregateSpec[];
	order_by?: OrderSpec[];
	limit?: number;
	offset?: number;
}

export interface QueryColumnHeader {
	key: string;
	label: string;
	type: string;
}

export interface AnalyticsQueryResponse {
	columns: QueryColumnHeader[];
	rows: Record<string, unknown>[];
	total_count: number;
	truncated: boolean;
}

// ============================================================================
// 3. Visualization Configuration (Discriminated Union: Unrepresentable Illegal States)
// ============================================================================

export interface TableVizConfig {
	type: 'table';
	density?: 'compact' | 'comfortable';
	page_size?: number;
}

export interface ChartVizConfig {
	type: 'chart';
	chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'grouped_bar' | 'stacked_bar';
	x_axis: string;
	y_axis: string[];
	stacked?: boolean;
}

export interface MapVizConfig {
	type: 'map';
	lat_field: string;
	lng_field: string;
	label_field?: string;
	color_field?: string;
	cluster?: boolean;
	default_zoom?: number;
}

export interface KPIVizConfig {
	type: 'kpi';
	value_field: string;
	comparison_period?: 'previous_day' | 'previous_month' | 'previous_year';
	format?: 'number' | 'currency' | 'percent';
}

export interface GoalVizConfig {
	type: 'goal';
	value_field: string;
	target_value: number;
}

export interface MarkdownVizConfig {
	type: 'markdown';
	content: string;
}

export type VizConfig =
	| TableVizConfig
	| ChartVizConfig
	| MapVizConfig
	| KPIVizConfig
	| GoalVizConfig
	| MarkdownVizConfig;

export type VizType = VizConfig['type'] | 'walker'; // Walker allowed in scratchpad/SavedQuestion

// ============================================================================
// 4. Core Artifacts: SavedQuestion, Dashboard & Org Report
// ============================================================================

export interface SavedQuestionSourceConfig {
	dataset_id: UUID;
	dataset_name: string;
}

export interface SavedQuestion {
	id: UUID;
	org_id: UUID;
	project_id?: UUID;
	created_by?: UUID;
	title: string;
	description?: string;
	source_config: SavedQuestionSourceConfig;
	query_config: AnalyticsQueryRequest;
	viz_type: VizType;
	viz_config: VizConfig;
	created_at: string;
	updated_at: string;
}

export interface SavedQuestionCreate {
	title: string;
	description?: string;
	project_id?: UUID;
	source_config: SavedQuestionSourceConfig;
	query_config: AnalyticsQueryRequest;
	viz_type: VizType;
	viz_config: VizConfig;
}

export interface DashboardCard {
	id: UUID;
	question_id: UUID;
	question: SavedQuestion; // Populated by backend
	position: { x: number; y: number; w: number; h: number };
	viz_override?: VizConfig;
}

export interface AnalyticsDashboard {
	id: UUID;
	org_id: UUID;
	project_id?: UUID;
	created_by?: UUID;
	title: string;
	description?: string;
	cards: DashboardCard[];
	created_at: string;
	updated_at: string;
}

export type ReportRole = 'viewer' | 'commenter' | 'explorer' | 'owner';

export interface TeamGrant {
	team_id: UUID;
	role: ReportRole;
}

export interface ReportBlockMarkdown {
	id: UUID;
	type: 'markdown';
	title?: string;
	content: string;
}

export interface ReportBlockQuestion {
	id: UUID;
	type: 'question';
	question_id: UUID;
	question?: SavedQuestion;
}

export type ReportBlock = ReportBlockMarkdown | ReportBlockQuestion;

export interface OrgReport {
	id: UUID;
	org_id: UUID;
	title: string;
	description?: string;
	grants: TeamGrant[];
	blocks: ReportBlock[];
	created_at: string;
	updated_at: string;
}

export interface OrgReportCreate {
	org_id: UUID;
	title: string;
	description?: string;
	grants: TeamGrant[];
	blocks: Array<{ id: string; type: 'markdown' | 'question'; content?: string; question_id?: string }>;
}

export interface ProjectHubPin {
	id: UUID;
	project_id: UUID;
	question_id: UUID;
	position: number; // 0-3 (max 4 pins)
}

// ============================================================================
// 5. Domain Interface (Boundary Contract)
// ============================================================================

export interface AnalyticsDomain {
	listSources(params: { projectId?: UUID }): Promise<AnalyticsSource[]>;
	createDerivedTable(payload: DerivedTableCreate): Promise<AnalyticsSource>;
	executeQuery(query: AnalyticsQueryRequest): Promise<AnalyticsQueryResponse>;
	createQuestion(payload: SavedQuestionCreate): Promise<SavedQuestion>;
	getQuestion(id: UUID): Promise<SavedQuestion>;
	getDashboard(id: UUID): Promise<AnalyticsDashboard>;
	pinToHub(projectId: UUID, questionId: UUID): Promise<ProjectHubPin>;
	createReport(payload: OrgReportCreate): Promise<OrgReport>;
	getReport(id: UUID): Promise<OrgReport>;
}
