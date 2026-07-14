export type AggregateFn = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct';

export interface AnalyticsSourceField {
	field_identifier: string;
	field_key: string;
	label?: string | null;
	field_type?: string | null;
	options?: Array<{ label: string; value: string }> | null;
}

export interface AnalyticsSourceDerived {
	kind: 'derived' | string;
	mode: 'snapshot' | 'linked' | string;
	parent_dataset_id?: string | null;
	columns?: Array<{
		key: string;
		label: string;
		field_type?: string | null;
		calculated?: boolean;
		formula?: string | null;
	}>;
}

export interface AnalyticsSource {
	dataset_id: string;
	form_id: string;
	dataset_name: string;
	dataset_slug: string;
	form_title: string;
	project_id?: string | null;
	project_name?: string | null;
	fields: AnalyticsSourceField[];
	record_count: number;
	derived?: AnalyticsSourceDerived | null;
}

export interface QueryColumn {
	key: string;
	label: string;
	type: string;
}

export interface QueryResult {
	columns: QueryColumn[];
	rows: Array<Record<string, unknown>>;
	total_count: number;
	truncated: boolean;
}

export interface SavedQuestion {
	id: string;
	org_id: string;
	project_id?: string | null;
	created_by?: string | null;
	title: string;
	description?: string | null;
	source_config: Record<string, unknown>;
	query_config: Record<string, unknown>;
	viz_type: 'table' | 'chart' | 'walker' | 'kpi' | 'goal' | 'markdown';
	viz_config?: Record<string, unknown> | null;
	cache_ttl_seconds?: number | null;
	is_archived: boolean;
	created_at: string;
	updated_at: string;
}

export interface DashboardCard {
	id: string;
	question_id: string;
	position: Record<string, unknown>;
	viz_override?: Record<string, unknown> | null;
	question?: SavedQuestion | null;
}

export interface AnalyticsDashboard {
	id: string;
	org_id: string;
	project_id?: string | null;
	created_by?: string | null;
	title: string;
	description?: string | null;
	layout_config: Array<Record<string, unknown>>;
	cards: DashboardCard[];
	is_archived: boolean;
	created_at: string;
	updated_at: string;
}

export interface AggregateSpec {
	field: string;
	fn: AggregateFn;
	alias?: string;
}

export interface OrderSpec {
	field: string;
	direction?: 'asc' | 'desc';
}

export interface AnalyticsToolProps {
	orgId: string;
	projectId?: string;
	sources: AnalyticsSource[];
	initialSource?: AnalyticsSource | null;
	initialAnalysis?: SavedQuestion | null;
	onSourcesChanged?: () => Promise<void> | void;
}
