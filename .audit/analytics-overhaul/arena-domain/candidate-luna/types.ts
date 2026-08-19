export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type DatasetId = Brand<string, 'DatasetId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type DashboardId = Brand<string, 'DashboardId'>;
export type ReportId = Brand<string, 'ReportId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type FieldKey = Brand<string, 'FieldKey'>;
export type MetricAlias = Brand<string, 'MetricAlias'>;

export type ScalarType = 'text' | 'number' | 'boolean' | 'date' | 'datetime' | 'geo_point' | 'geo_shape';

export type DatasetSource =
	| {
			kind: 'published_form_dataset';
			id: DatasetId;
			projectId: Brand<string, 'ProjectId'>;
			formId: Brand<string, 'FormId'>;
	  }
	| {
			kind: 'derived_table';
			id: DatasetId;
			projectId: Brand<string, 'ProjectId'> | null;
			parent: DatasetId;
			definition: DerivedTableDefinition;
	  };

export interface DatasetField {
	key: FieldKey;
	label: string;
	type: ScalarType;
	nullable: boolean;
}

export interface DatasetSchema {
	dataset: DatasetSource;
	fields: readonly DatasetField[];
}

export type FieldExpression = {
	kind: 'field';
	field: FieldKey;
};

export type LiteralExpression =
	| { kind: 'text'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean }
	| { kind: 'null' };

export type ArithmeticExpression =
	| { kind: 'add'; left: NumericExpression; right: NumericExpression }
	| { kind: 'subtract'; left: NumericExpression; right: NumericExpression }
	| { kind: 'multiply'; left: NumericExpression; right: NumericExpression }
	| { kind: 'divide'; left: NumericExpression; right: NumericExpression };

export type NumericExpression =
	| FieldExpression
	| MetricReference
	| LiteralExpression & { kind: 'number' }
	| ArithmeticExpression;

export type ScalarExpression = FieldExpression | LiteralExpression | NumericExpression;

export interface MetricReference {
	kind: 'metric_ref';
	alias: MetricAlias;
}

export type AggregateFunction = 'count_rows' | 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';

export interface Metric {
	kind: 'metric';
	fn: AggregateFunction;
	field: FieldKey | null;
	alias: MetricAlias;
}

export type FilterExpression =
	| { kind: 'and'; clauses: readonly [FilterExpression, ...FilterExpression[]] }
	| { kind: 'or'; clauses: readonly [FilterExpression, ...FilterExpression[]] }
	| { kind: 'not'; clause: FilterExpression }
	| { kind: 'is_null'; expression: FieldExpression }
	| { kind: 'comparison'; operator: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'; left: ScalarExpression; right: ScalarExpression }
	| { kind: 'in'; expression: FieldExpression; values: readonly [LiteralExpression, ...LiteralExpression[]] };

export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface GroupKey {
	kind: 'group_key';
	expression: FieldExpression;
	bucket?: DateBucket;
}

export interface SortSpec {
	expression: FieldExpression | MetricReference;
	direction: 'asc' | 'desc';
}

export interface QueryAst {
	kind: 'query';
	source: DatasetId;
	select: readonly FieldExpression[];
	metrics: readonly Metric[];
	calculated: readonly DerivedColumn[];
	where?: FilterExpression;
	groupBy: readonly GroupKey[];
	orderBy: readonly SortSpec[];
	limit: number;
	offset: number;
}

export interface DerivedColumn {
	kind: 'derived_column';
	key: FieldKey;
	expression: NumericExpression;
}

export interface DerivedTableDefinition {
	kind: 'derived_table_definition';
	parent: DatasetId;
	columns: readonly FieldKey[];
	query: QueryAst;
	materialization: 'snapshot' | 'linked';
}

export type ChartView =
	| {
			kind: 'chart';
			chart: 'bar' | 'line' | 'pie' | 'scatter';
			category: FieldExpression | GroupKey;
			value: MetricReference;
			stackBy?: FieldExpression;
	  }
	| {
			kind: 'chart';
			chart: 'kpi_trend';
			value: MetricReference;
			time: GroupKey;
	  };

export interface TableView {
	kind: 'table';
	columns: readonly (FieldExpression | MetricReference)[];
}

export interface MapView {
	kind: 'map';
	location: FieldExpression;
	colorBy?: FieldExpression;
	sizeBy?: MetricReference;
	tooltip: readonly (FieldExpression | MetricReference)[];
}

export interface KpiView {
	kind: 'kpi';
	value: MetricReference;
	label: string;
	comparison?: {
		kind: 'previous_period';
		period: DateBucket;
	};
}

export interface MarkdownView {
	kind: 'markdown';
	markdown: string;
}

export type PersistedView = TableView | ChartView | MapView | KpiView | MarkdownView;

export interface QuestionDraft {
	title: string;
	description?: string;
	source: DatasetSource;
	query: QueryAst;
	view: PersistedView;
}

export interface SavedQuestion extends QuestionDraft {
	id: QuestionId;
}

export interface QueryResult {
	columns: readonly {
		key: string;
		label: string;
		type: ScalarType | 'metric';
	}[];
	rows: readonly Record<string, unknown>[];
	totalCount: number;
	truncated: boolean;
}

export interface DashboardCard {
	questionId: QuestionId;
	view: PersistedView;
	layout: { x: number; y: number; width: number; height: number };
}

export interface AnalysisDashboard {
	id: DashboardId;
	projectId: Brand<string, 'ProjectId'>;
	title: string;
	cards: readonly DashboardCard[];
}

export type ReportRole = 'viewer' | 'commenter' | 'explorer' | 'owner';

export interface ReportGrant {
	teamId: TeamId;
	role: ReportRole;
}

export interface ReportBoard {
	id: ReportId;
	orgId: Brand<string, 'OrgId'>;
	title: string;
	questions: readonly {
		questionId: QuestionId;
		layout: DashboardCard['layout'];
	}[];
	grants: readonly ReportGrant[];
}

export interface WalkerScratchpad {
	kind: 'walker_scratchpad';
	source: DatasetId;
	query: QueryAst;
	sessionId: Brand<string, 'ExploreSessionId'>;
}

export interface RawAnalyticsPayload {
	source_config: unknown;
	query_config: unknown;
	viz_type: unknown;
	viz_config: unknown;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export declare function parseSavedQuestionPayload(payload: RawAnalyticsPayload): ParseResult<QuestionDraft>;
export declare function parseDatasetSchema(payload: unknown): ParseResult<DatasetSchema>;
export declare function parseQueryAst(payload: unknown): ParseResult<QueryAst>;
export declare function validateQuestion(question: QuestionDraft, schema: DatasetSchema): ParseResult<SavedQuestion>;

export declare function executeQuery(query: QueryAst): Promise<QueryResult>;
export declare function saveQuestion(question: QuestionDraft): Promise<SavedQuestion>;
export declare function createDerivedTable(definition: DerivedTableDefinition): Promise<DatasetSource>;

export declare function addDashboardCard(
	dashboardId: DashboardId,
	card: DashboardCard,
): Promise<AnalysisDashboard>;
export declare function addReportQuestion(
	reportId: ReportId,
	question: Pick<DashboardCard, 'questionId' | 'layout'>,
): Promise<ReportBoard>;
export declare function grantReport(reportId: ReportId, grant: ReportGrant): Promise<ReportBoard>;

export declare namespace analysis {
	export function dataset(id: DatasetId | string): DatasetSource;
	export function query(input: Omit<QueryAst, 'kind' | 'source'> & { source: DatasetId | string }): QueryAst;
	export function question(input: QuestionDraft): QuestionDraft;
	export function derivedColumn(input: Omit<DerivedColumn, 'kind'>): DerivedColumn;
	export function map(input: Omit<MapView, 'kind'>): MapView;
	export function execute(query: QueryAst): Promise<QueryResult>;
	export function save(question: QuestionDraft): Promise<SavedQuestion>;
}

export declare function field(key: FieldKey | string): FieldExpression;
export declare function metricRef(alias: MetricAlias | string): MetricReference;
export declare namespace metric {
	export function ref(alias: MetricAlias | string): MetricReference;
	export function count(input: { as: MetricAlias | string; field?: FieldKey | string }): Metric;
	export function countRows(): MetricReference;
}

export declare function table(input: Omit<TableView, 'kind'>): TableView;
export declare namespace chart {
	export function bar(input: Omit<Extract<ChartView, { chart: 'bar' }>, 'kind' | 'chart'>): ChartView;
	export function line(input: Omit<Extract<ChartView, { chart: 'line' }>, 'kind' | 'chart'>): ChartView;
}

export declare const arithmetic: {
	divide(left: NumericExpression, right: NumericExpression): NumericExpression;
	add(left: NumericExpression, right: NumericExpression): NumericExpression;
	subtract(left: NumericExpression, right: NumericExpression): NumericExpression;
	multiply(left: NumericExpression, right: NumericExpression): NumericExpression;
};
