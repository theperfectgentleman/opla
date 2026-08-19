/**
 * Sketch of `@opla/analytics-domain`, the shared analytics domain for Studio and backend.
 *
 * Pure TypeScript. No react, leaflet, graphic-walker, or hyperformula imports.
 * The host supplies fetch, widgets, and the Walker scratchpad shell.
 *
 * Read order: branded ids → DataSource → QueryPlan → Lens → SavedQuestion →
 * sessions → parse/execute boundary → AnalyticsClient.
 *
 * Data flows:
 *   API JSON → parseQuestion / parseQueryPlan → domain types → executePlan → QueryResult → renderers
 *   Table exploration → TableSession → saveTable (AnalyticTable, not Form) → new DataSource
 */

// ───────────────────────────────────────────────────────────────────────────
// Branded identifiers. Parse once at the boundary.
// ───────────────────────────────────────────────────────────────────────────

export type OrgId = string & { readonly __brand: 'OrgId' };
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type DatasetId = string & { readonly __brand: 'DatasetId' };
export type QuestionId = string & { readonly __brand: 'QuestionId' };
export type ReportId = string & { readonly __brand: 'ReportId' };
export type TeamId = string & { readonly __brand: 'TeamId' };
export type FieldKey = string & { readonly __brand: 'FieldKey' };

export function fieldKey(raw: string): FieldKey {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Scope. Analysis is project-scoped; Reports are org-scoped.
// ───────────────────────────────────────────────────────────────────────────

export type ProjectScope = { readonly kind: 'project'; readonly projectId: ProjectId };
export type OrgScope = { readonly kind: 'org'; readonly orgId: OrgId };

// ───────────────────────────────────────────────────────────────────────────
// DataSource. Capture datasets and analytic tables share one shape.
// Analytic tables deliberately omit formId.
// ───────────────────────────────────────────────────────────────────────────

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'choice'
  | 'gps'
  | 'geojson';

export interface FieldOption {
  readonly label: string;
  readonly value: string;
}

export interface SourceField {
  readonly key: FieldKey;
  readonly label: string;
  readonly type: FieldType;
  readonly options?: readonly FieldOption[];
}

/** Capture-backed dataset. Always has a published form behind it. */
export interface CaptureDataset {
  readonly kind: 'capture';
  readonly id: DatasetId;
  readonly formId: string;
  readonly name: string;
  readonly slug: string;
  readonly projectId: ProjectId | null;
  readonly fields: readonly SourceField[];
  readonly recordCount: number;
}

/** Prep- or analyst-saved table. Never a LIVE form. */
export interface AnalyticTableSpec {
  readonly mode: 'snapshot' | 'linked';
  readonly parentDatasetId: DatasetId;
  readonly derivedColumns: readonly DerivedColumnSpec[];
}

export interface AnalyticTable {
  readonly kind: 'table';
  readonly id: DatasetId;
  readonly name: string;
  readonly slug: string;
  readonly projectId: ProjectId | null;
  readonly fields: readonly SourceField[];
  readonly recordCount: number;
  readonly spec: AnalyticTableSpec;
}

export type DataSource = CaptureDataset | AnalyticTable;

export function isCaptureDataset(source: DataSource): source is CaptureDataset {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Derived columns. HyperFormula at the UI boundary; CalculatedExpr on the wire.
// ───────────────────────────────────────────────────────────────────────────

/** Authoring-time formula from the spreadsheet bar. Parsed at commit, not stored. */
export interface FormulaDraft {
  readonly text: string;
  readonly references: readonly FieldKey[];
}

/**
 * Persisted derived column. `formula` is the HyperFormula source for re-display;
 * `expr` is the compiled AST the server re-runs. Both are required on save.
 */
export interface DerivedColumnSpec {
  readonly key: FieldKey;
  readonly label: string;
  readonly resultType: 'number' | 'string' | 'boolean';
  readonly formula: string;
  readonly expr: CalculatedExpr;
}

export type CalculatedExpr =
  | { readonly op: 'literal'; readonly value: number | string | boolean }
  | { readonly op: 'field'; readonly key: FieldKey }
  | {
      readonly op: 'binary';
      readonly fn: '+' | '-' | '*' | '/';
      readonly left: CalculatedExpr;
      readonly right: CalculatedExpr;
    }
  | { readonly op: 'unary'; readonly fn: '-' | '+'; readonly arg: CalculatedExpr };

export function compileFormula(
  source: DataSource,
  formula: string
): { readonly ok: true; readonly expr: CalculatedExpr } | { readonly ok: false; readonly reason: string } {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// QueryPlan v2. One AST for Studio and execute_query. Versioned for migration.
// ───────────────────────────────────────────────────────────────────────────

export type AggregateFn = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';

export interface MeasureSpec {
  readonly field: FieldKey | '_row';
  readonly fn: AggregateFn;
  readonly as: string;
}

export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface GroupBySpec {
  readonly field: FieldKey;
  readonly bucket?: DateBucket;
}

export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'in'
  | 'is_null'
  | 'not_null';

export interface FilterRule {
  readonly field: FieldKey;
  readonly op: FilterOp;
  readonly value?: unknown;
}

export interface FilterGroup {
  readonly logic: 'and' | 'or';
  readonly rules: readonly (FilterRule | FilterGroup)[];
}

export interface OrderSpec {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

/**
 * The only query shape executePlan accepts. `version: 2` is required.
 * Raw/detail queries set groupBy and measures empty.
 * Summary queries set groupBy and/or measures.
 */
export interface QueryPlan {
  readonly version: 2;
  readonly datasetId: DatasetId;
  readonly select: readonly FieldKey[];
  readonly filters: FilterGroup | null;
  readonly groupBy: readonly GroupBySpec[];
  readonly measures: readonly MeasureSpec[];
  readonly calculated: readonly DerivedColumnSpec[];
  readonly orderBy: readonly OrderSpec[];
  readonly limit: number;
  readonly offset: number;
  readonly reviewStatus: 'all' | 'approved_only';
}

export interface ResultColumn {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
}

export interface QueryResult {
  readonly columns: readonly ResultColumn[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly totalCount: number;
  readonly truncated: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// Lens. Presentation only. Never carries query semantics the plan lacks.
// Walker is intentionally absent.
// ───────────────────────────────────────────────────────────────────────────

export interface TableLens {
  readonly kind: 'table';
  readonly density?: 'compact' | 'comfortable';
  readonly pageSize?: number;
}

export type ChartType =
  | 'bar'
  | 'grouped_bar'
  | 'stacked_bar'
  | 'horizontal_bar'
  | 'line'
  | 'pie'
  | 'scatter';

export interface ChartLens {
  readonly kind: 'chart';
  readonly chartType: ChartType;
  readonly categoryField: string;
  readonly valueFields: readonly string[];
  readonly stacked?: boolean;
}

export interface MapLens {
  readonly kind: 'map';
  readonly latField: FieldKey;
  readonly lngField: FieldKey;
  readonly labelField?: FieldKey;
  readonly colorField?: FieldKey;
  readonly cluster?: boolean;
  readonly defaultZoom?: number;
}

export interface KpiLens {
  readonly kind: 'kpi';
  readonly valueField: string;
  readonly format?: 'number' | 'currency' | 'percent';
  readonly compare?: {
    readonly period: 'previous_day' | 'previous_week' | 'previous_month' | 'previous_year';
  };
  readonly target?: number;
}

export interface MarkdownLens {
  readonly kind: 'markdown';
  readonly body: string;
}

export type Lens = TableLens | ChartLens | MapLens | KpiLens | MarkdownLens;

/**
 * A validated pair. `validateLens(plan, lens)` returns errors if:
 * - chart/kpi/map fields are missing from the plan result schema
 * - kpi has !== 1 measure when groupBy is empty, or wrong shape when grouped
 * - map lat/lng are not gps fields on the source
 * - markdown is paired with a non-empty plan (markdown uses empty plan)
 */
export interface QuestionDraft {
  readonly title: string;
  readonly description?: string;
  readonly projectId?: ProjectId;
  readonly plan: QueryPlan;
  readonly lens: Lens;
}

export interface LensValidationError {
  readonly code: string;
  readonly message: string;
}

export function validateLens(
  source: DataSource,
  plan: QueryPlan,
  lens: Lens
): readonly LensValidationError[] {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// SavedQuestion. Persisted artifact. Parsed from DB JSON at the boundary.
// ───────────────────────────────────────────────────────────────────────────

export interface SavedQuestion {
  readonly id: QuestionId;
  readonly orgId: OrgId;
  readonly projectId: ProjectId | null;
  readonly createdBy: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly datasetId: DatasetId;
  readonly plan: QueryPlan;
  readonly lens: Lens;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** What renderers need. No JSON blobs. */
export interface QuestionView {
  readonly id: QuestionId;
  readonly title: string;
  readonly plan: QueryPlan;
  readonly lens: Lens;
}

export function questionView(question: SavedQuestion): QuestionView {
  throw new Error('not implemented');
}

export type ParseOutcome<T> =
  | { readonly outcome: 'ok'; readonly value: T }
  | { readonly outcome: 'rejected'; readonly reason: string; readonly code: LegacyRejectCode };

export type LegacyRejectCode =
  | 'unknown_query_version'
  | 'walker_not_portable'
  | 'invalid_viz_config'
  | 'missing_dataset'
  | 'malformed_filters';

/**
 * Migration entry point. Attempts v1 query_config → QueryPlan v2 and legacy viz → Lens.
 * Returns rejected for walker questions, unparseable blobs, or goal rows that cannot map.
 * Never silently dual-writes.
 */
export function parseQuestion(raw: unknown): ParseOutcome<SavedQuestion> {
  throw new Error('not implemented');
}

export function parseQueryPlan(raw: unknown): ParseOutcome<QueryPlan> {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// TableSession. Server-backed spreadsheet view inside Analysis.
// ───────────────────────────────────────────────────────────────────────────

export interface TableView {
  readonly revision: number;
  readonly source: DataSource;
  readonly plan: QueryPlan;
  readonly columns: readonly ResultColumn[];
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly totalCount: number;
  readonly truncated: boolean;
  readonly sort: OrderSpec | null;
  readonly filters: FilterGroup | null;
  readonly derivedColumns: readonly DerivedColumnSpec[];
  readonly formulaDraft: FormulaDraft | null;
  readonly canSaveTable: boolean;
  readonly rowCount: number;
}

export interface TableSaveSpec {
  readonly name: string;
  readonly mode: 'snapshot' | 'linked';
}

export interface TableSession {
  view(): TableView;
  setSort(order: OrderSpec | null): void;
  setFilters(filters: FilterGroup | null): void;
  setPlan(plan: QueryPlan): void;
  plan(): QueryPlan;
  editFormula(draft: FormulaDraft | null): void;
  addDerivedColumn(spec: { readonly name: string; readonly formula: string }): Promise<void>;
  preview(): Promise<QueryResult>;
  saveTable(spec: TableSaveSpec): Promise<AnalyticTable>;
  openScratchpad(): Scratchpad;
  subscribe(listener: () => void): () => void;
}

export function openTableSession(client: AnalyticsClient, source: DataSource): TableSession {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Scratchpad. Graphic Walker lives here only. Ephemeral. Not a Lens.
// ───────────────────────────────────────────────────────────────────────────

export interface Scratchpad {
  readonly datasetId: DatasetId;
  readonly previewPlan: QueryPlan;
  /** Host mounts Graphic Walker with this payload. Walker format stays in the host adapter. */
  readonly walkerSeed: Readonly<Record<string, unknown>>;
  dispose(): void;
}

export function openScratchpad(session: TableSession): Scratchpad {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Question commit and execute. The parity contract.
// ───────────────────────────────────────────────────────────────────────────

export interface QuestionCommit {
  readonly title: string;
  readonly description?: string;
  readonly projectId?: ProjectId;
  readonly plan: QueryPlan;
  readonly lens: Lens;
}

export function commitQuestion(client: AnalyticsClient, draft: QuestionCommit): Promise<SavedQuestion> {
  throw new Error('not implemented');
}

/** The only execution path for saved artifacts. Always hits client.runQuery. */
export function executePlan(plan: QueryPlan, client: AnalyticsClient): Promise<QueryResult> {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Analysis dashboard (project-scoped composition). Not Reports.
// ───────────────────────────────────────────────────────────────────────────

export interface GridPosition {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DashboardCard {
  readonly id: string;
  readonly questionId: QuestionId;
  readonly position: GridPosition;
  readonly lensOverride?: Lens;
}

export interface AnalysisDashboard {
  readonly id: string;
  readonly orgId: OrgId;
  readonly projectId: ProjectId | null;
  readonly title: string;
  readonly description: string | null;
  readonly cards: readonly DashboardCard[];
}

// ───────────────────────────────────────────────────────────────────────────
// Org Report. Stakeholder board. Server-persisted. Team grants.
// ───────────────────────────────────────────────────────────────────────────

export type ReportRole = 'viewer' | 'commenter' | 'explorer' | 'owner';

export interface TeamGrant {
  readonly teamId: TeamId;
  readonly role: ReportRole;
}

export interface ReportMarkdownBlock {
  readonly kind: 'markdown';
  readonly id: string;
  readonly body: string;
}

export interface ReportQuestionBlock {
  readonly kind: 'question';
  readonly id: string;
  readonly questionId: QuestionId;
}

export type ReportBlock = ReportMarkdownBlock | ReportQuestionBlock;

export interface OrgReport {
  readonly id: ReportId;
  readonly orgId: OrgId;
  readonly title: string;
  readonly description: string | null;
  readonly grants: readonly TeamGrant[];
  readonly layout: readonly ReportBlock[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OrgReportCreate {
  readonly orgId: OrgId;
  readonly title: string;
  readonly description?: string;
  readonly grants: readonly TeamGrant[];
  readonly layout: readonly ReportBlock[];
}

// ───────────────────────────────────────────────────────────────────────────
// Hub pin. Max four. Walker and markdown excluded by type system.
// ───────────────────────────────────────────────────────────────────────────

export type PinnableLens = Exclude<Lens, MarkdownLens>;

export type HubPinSlot = 0 | 1 | 2 | 3;

export interface ProjectHubPin {
  readonly id: string;
  readonly projectId: ProjectId;
  readonly questionId: QuestionId;
  readonly slot: HubPinSlot;
}

export function assertPinnable(lens: Lens): asserts lens is PinnableLens {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// AnalyticsClient. Host implements. Package stays pure.
// ───────────────────────────────────────────────────────────────────────────

export interface AnalyticsClient {
  listSources(scope: ProjectScope | OrgScope): Promise<readonly DataSource[]>;
  runQuery(plan: QueryPlan): Promise<QueryResult>;
  saveTable(spec: TableSaveSpec & { readonly source: DataSource; readonly plan: QueryPlan }): Promise<AnalyticTable>;
  saveQuestion(commit: QuestionCommit): Promise<SavedQuestion>;
  loadQuestion(id: QuestionId): Promise<SavedQuestion>;
  pinToHub(spec: { readonly projectId: ProjectId; readonly questionId: QuestionId; readonly slot: HubPinSlot }): Promise<ProjectHubPin>;
  createReport(spec: OrgReportCreate): Promise<OrgReport>;
  loadReport(id: ReportId): Promise<OrgReport>;
}

// ───────────────────────────────────────────────────────────────────────────
// Legacy migration helpers (internal, re-exported for backend parity tests).
// ───────────────────────────────────────────────────────────────────────────

/** Maps legacy saved_questions.query_config (v1) to QueryPlan v2 or rejects. */
export function upgradeQueryConfigV1(raw: unknown): ParseOutcome<QueryPlan> {
  throw new Error('not implemented');
}

/** Maps legacy viz_type + viz_config to Lens or rejects walker/goal. */
export function upgradeVizConfig(
  vizType: string,
  vizConfig: unknown,
  plan: QueryPlan
): ParseOutcome<Lens> {
  throw new Error('not implemented');
}

// ───────────────────────────────────────────────────────────────────────────
// Explicitly not exported. Refused surfaces.
// ───────────────────────────────────────────────────────────────────────────

/** @internal Refused: Walker is not a persisted viz type. */
type WalkerPersistedQuestion = never;

/** @internal Refused: Derived tables are not LIVE forms. */
type PrepLiveForm = never;

/** @internal Refused: localStorage report buckets. */
type ReportBucket = never;

/** @internal Refused: client-side chart aggregation for saved questions. */
type ClientAggregateChart = never;
