/**
 * Domain types for Analysis and Reports.
 *
 * Invariants this file is willing to compile:
 * A table is capture, view, or upload. Never a Form.
 * A query is rows or summary. Never both.
 * A question is a run Result plus table, chart, map, or kpi. Never walker, markdown, or goal.
 * A board is a project analysis board or an org report. Same tiles, different scope.
 * Markdown is a tile. Hub pins are at most four question ids.
 */
export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type OrgId = Brand<string, 'OrgId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type FormId = Brand<string, 'FormId'>;
export type TableId = Brand<string, 'TableId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type BoardId = Brand<string, 'BoardId'>;
export type TileId = Brand<string, 'TileId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type FieldKey = Brand<string, 'FieldKey'>;
export type Limit = Brand<number, 'Limit'>;

export type NonEmpty<T> = [T, ...T[]];

export type ParseResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string; code: RejectCode };

export type RejectCode =
	| 'unparseable'
	| 'unparseable_query'
	| 'walker_not_supported'
	| 'markdown_not_a_question'
	| 'missing_project'
	| 'viz_query_mismatch'
	| 'truncated_summary'
	| 'unknown_field'
	| 'not_geo'
	| 'not_number'
	| 'not_queryable'
	| 'empty'
	| 'pin_limit'
	| 'wrong_project'
	| 'wrong_scope'
	| 'formula_not_server'
	| 'not_implemented';

export function parseOrgId(raw: string): ParseResult<OrgId> {
	throw new Error('not implemented');
}
export function parseProjectId(raw: string): ParseResult<ProjectId> {
	throw new Error('not implemented');
}
export function parseFormId(raw: string): ParseResult<FormId> {
	throw new Error('not implemented');
}
export function parseTableId(raw: string): ParseResult<TableId> {
	throw new Error('not implemented');
}
export function parseQuestionId(raw: string): ParseResult<QuestionId> {
	throw new Error('not implemented');
}
export function parseBoardId(raw: string): ParseResult<BoardId> {
	throw new Error('not implemented');
}
export function parseTeamId(raw: string): ParseResult<TeamId> {
	throw new Error('not implemented');
}
export function parseFieldKey(raw: string): ParseResult<FieldKey> {
	throw new Error('not implemented');
}
export function parseLimit(raw: number): ParseResult<Limit> {
	throw new Error('not implemented');
}

export type FieldType =
	| 'text'
	| 'number'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'choice'
	| 'geo'
	| 'attachment';

export type QueryableType = Exclude<FieldType, 'attachment'>;

export type SchemaField = {
	key: FieldKey;
	label: string;
	type: FieldType;
};

export type Schema = {
	fields: NonEmpty<SchemaField>;
};

export type Table =
	| {
			kind: 'capture';
			id: TableId;
			projectId: ProjectId;
			formId: FormId;
			name: string;
			schema: Schema;
	  }
	| {
			kind: 'view';
			id: TableId;
			projectId: ProjectId;
			parent: TableId;
			name: string;
			schema: Schema;
			definition: ViewDefinition;
	  }
	| {
			kind: 'upload';
			id: TableId;
			projectId: ProjectId;
			name: string;
			schema: Schema;
	  };

export type ViewDefinition = {
	parent: TableId;
	keep: NonEmpty<FieldKey>;
	derived: readonly CompiledColumn[];
	where?: Predicate;
};

export type CompiledColumn = {
	key: FieldKey;
	label: string;
	formula: string;
	expr: Expr;
};

export type SaveViewInput = {
	name: string;
	parent: TableId;
	keep: NonEmpty<FieldKey>;
	derived: readonly CompiledColumn[];
	where?: Predicate;
};

export type SaveUploadInput = {
	name: string;
	columns: NonEmpty<SchemaField>;
	rows: NonEmpty<Row>;
};

export type Literal =
	| { kind: 'text'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean };

export type Expr =
	| { kind: 'field'; field: FieldKey }
	| { kind: 'number'; value: number }
	| { kind: 'add'; left: Expr; right: Expr }
	| { kind: 'sub'; left: Expr; right: Expr }
	| { kind: 'mul'; left: Expr; right: Expr }
	| { kind: 'div'; left: Expr; right: Expr };

export type Predicate =
	| { kind: 'and'; clauses: NonEmpty<Predicate> }
	| { kind: 'or'; clauses: NonEmpty<Predicate> }
	| { kind: 'not'; clause: Predicate }
	| { kind: 'eq'; field: FieldKey; value: Literal }
	| { kind: 'neq'; field: FieldKey; value: Literal }
	| { kind: 'lt'; field: FieldKey; value: Literal }
	| { kind: 'lte'; field: FieldKey; value: Literal }
	| { kind: 'gt'; field: FieldKey; value: Literal }
	| { kind: 'gte'; field: FieldKey; value: Literal }
	| { kind: 'contains'; field: FieldKey; value: string }
	| { kind: 'in'; field: FieldKey; values: NonEmpty<Literal> }
	| { kind: 'is_null'; field: FieldKey }
	| { kind: 'is_not_null'; field: FieldKey };

export type DateBucket = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type Dimension =
	| { kind: 'field'; field: FieldKey }
	| { kind: 'time'; field: FieldKey; bucket: DateBucket };

export type Measure =
	| { kind: 'measure'; fn: 'count_rows'; alias: FieldKey }
	| {
			kind: 'measure';
			fn: 'count' | 'count_distinct' | 'sum' | 'avg' | 'min' | 'max';
			field: FieldKey;
			alias: FieldKey;
	  };

export type Select =
	| { kind: 'field'; field: FieldKey }
	| { kind: 'expr'; expr: Expr; alias: FieldKey };

export type Order = {
	field: FieldKey;
	direction: 'asc' | 'desc';
};

export type Query =
	| {
			kind: 'rows';
			table: TableId;
			select: NonEmpty<Select>;
			where?: Predicate;
			orderBy: readonly Order[];
			limit: Limit;
			offset: number;
	  }
	| {
			kind: 'summary';
			table: TableId;
			dimensions: readonly Dimension[];
			measures: NonEmpty<Measure>;
			where?: Predicate;
			orderBy: readonly Order[];
			limit: Limit;
	  };

export type GeoPoint = {
	lat: number;
	lng: number;
};

export type Cell =
	| { kind: 'text'; value: string }
	| { kind: 'number'; value: number }
	| { kind: 'boolean'; value: boolean }
	| { kind: 'date'; value: string }
	| { kind: 'geo'; value: GeoPoint }
	| { kind: 'null' };

export type Row = {
	readonly values: { readonly [key: string]: Cell };
};

export type ResultColumn = {
	key: FieldKey;
	label: string;
	type: QueryableType;
};

export type NumericResultColumn = ResultColumn & { type: 'number' };
export type GeoResultColumn = ResultColumn & { type: 'geo' };

export type Result =
	| {
			kind: 'complete';
			query: Query;
			columns: NonEmpty<ResultColumn>;
			rows: readonly Row[];
			totalCount: number;
	  }
	| {
			kind: 'truncated';
			query: Query;
			columns: NonEmpty<ResultColumn>;
			rows: readonly Row[];
			totalCount: number;
	  };

export type Viz =
	| { kind: 'table'; columns: NonEmpty<FieldKey> }
	| {
			kind: 'chart';
			mark: 'bar' | 'line' | 'pie';
			x: FieldKey;
			y: FieldKey;
			series?: FieldKey;
	  }
	| { kind: 'chart'; mark: 'scatter'; x: FieldKey; y: FieldKey }
	| { kind: 'map'; point: FieldKey; label?: FieldKey; color?: FieldKey }
	| { kind: 'kpi'; value: FieldKey; target?: number };

export type Question = {
	id: QuestionId;
	projectId: ProjectId;
	title: string;
	query: Query;
	viz: Viz;
};

export type Layout = {
	x: number;
	y: number;
	w: number;
	h: number;
};

export type TileDraft =
	| { kind: 'question'; questionId: QuestionId; layout: Layout }
	| { kind: 'markdown'; body: string; layout: Layout };

export type Tile =
	| { kind: 'question'; id: TileId; questionId: QuestionId; layout: Layout }
	| { kind: 'markdown'; id: TileId; body: string; layout: Layout };

export type ReportRole = 'viewer' | 'commenter' | 'explorer' | 'owner';

export type TeamGrant = {
	teamId: TeamId;
	role: ReportRole;
};

export type Board =
	| {
			kind: 'analysis';
			id: BoardId;
			projectId: ProjectId;
			title: string;
			tiles: readonly Tile[];
	  }
	| {
			kind: 'report';
			id: BoardId;
			orgId: OrgId;
			title: string;
			status: 'draft' | 'published' | 'archived';
			sources: NonEmpty<ProjectId>;
			tiles: readonly Tile[];
			grants: readonly TeamGrant[];
	  };

export type AnalysisBoardDraft = {
	title: string;
	tiles: readonly TileDraft[];
};

export type ReportDraft = {
	title: string;
	sources: NonEmpty<ProjectId>;
	tiles: readonly TileDraft[];
	grants: readonly TeamGrant[];
};

export type HubPins =
	| readonly []
	| readonly [QuestionId]
	| readonly [QuestionId, QuestionId]
	| readonly [QuestionId, QuestionId, QuestionId]
	| readonly [QuestionId, QuestionId, QuestionId, QuestionId];

export type RowPolicy = 'query_only' | 'approved_capture';

export type AnalysisOp =
	| { op: 'list_tables'; projectId: ProjectId }
	| { op: 'run'; query: Query; rowPolicy: RowPolicy }
	| { op: 'write_view'; projectId: ProjectId; input: SaveViewInput }
	| { op: 'write_upload'; projectId: ProjectId; input: SaveUploadInput }
	| { op: 'write_question'; projectId: ProjectId; title: string; query: Query; viz: Viz }
	| { op: 'load_question'; id: QuestionId }
	| { op: 'list_questions'; projectId: ProjectId }
	| { op: 'write_analysis_board'; projectId: ProjectId; draft: AnalysisBoardDraft }
	| { op: 'write_report_board'; orgId: OrgId; draft: ReportDraft }
	| { op: 'load_board'; id: BoardId }
	| { op: 'list_analysis_boards'; projectId: ProjectId }
	| { op: 'list_report_boards'; orgId: OrgId }
	| { op: 'publish_report'; id: BoardId }
	| { op: 'write_grant'; boardId: BoardId; grant: TeamGrant }
	| { op: 'load_pins'; projectId: ProjectId }
	| { op: 'write_pins'; projectId: ProjectId; pins: HubPins };

export type AnalysisIO = {
	request: (op: AnalysisOp) => Promise<unknown>;
};

export type AnalysisApi = {
	openProjectAnalysis(input: { orgId: OrgId; projectId: ProjectId }): Promise<ProjectAnalysis>;
	openOrgReports(input: { orgId: OrgId }): Promise<OrgReports>;
};

export type ProjectAnalysis = {
	readonly orgId: OrgId;
	readonly projectId: ProjectId;
	readonly tables: readonly Table[];
	readonly defaultRowLimit: Limit;
	run(query: Query): Promise<Result>;
	compileFormula(input: { table: TableId; label: string; formula: string }): ParseResult<CompiledColumn>;
	saveView(input: SaveViewInput): Promise<ParseResult<Extract<Table, { kind: 'view' }>>>;
	saveUpload(input: SaveUploadInput): Promise<ParseResult<Extract<Table, { kind: 'upload' }>>>;
	saveQuestion(input: { title: string; result: Result; viz: Viz }): Promise<ParseResult<Question>>;
	loadQuestion(id: QuestionId): Promise<ParseResult<Question>>;
	listQuestions(): Promise<readonly Question[]>;
	saveBoard(draft: AnalysisBoardDraft): Promise<ParseResult<Extract<Board, { kind: 'analysis' }>>>;
	loadBoard(id: BoardId): Promise<ParseResult<Extract<Board, { kind: 'analysis' }>>>;
	listBoards(): Promise<readonly Extract<Board, { kind: 'analysis' }>[]>;
	pins(): Promise<HubPins>;
	pin(questionId: QuestionId): Promise<ParseResult<HubPins>>;
	unpin(questionId: QuestionId): Promise<HubPins>;
};

export type OrgReports = {
	readonly orgId: OrgId;
	listBoards(): Promise<readonly Extract<Board, { kind: 'report' }>[]>;
	saveBoard(draft: ReportDraft): Promise<ParseResult<Extract<Board, { kind: 'report' }>>>;
	loadBoard(id: BoardId): Promise<ParseResult<Extract<Board, { kind: 'report' }>>>;
	place(input: { boardId: BoardId; questionId: QuestionId; layout: Layout }): Promise<ParseResult<Extract<Board, { kind: 'report' }>>>;
	grant(input: { boardId: BoardId; grant: TeamGrant }): Promise<ParseResult<Extract<Board, { kind: 'report' }>>>;
	publish(boardId: BoardId): Promise<ParseResult<Extract<Board, { kind: 'report' }>>>;
	runQuestion(id: QuestionId): Promise<ParseResult<Result>>;
};

export declare function createAnalysis(io: AnalysisIO): AnalysisApi;

export function findField(table: Table, raw: string): ParseResult<SchemaField> {
	throw new Error('not implemented');
}
export function queryableKeys(table: Table): ParseResult<NonEmpty<FieldKey>> {
	throw new Error('not implemented');
}
export function selectAll(table: Table, limit: Limit): ParseResult<Extract<Query, { kind: 'rows' }>> {
	throw new Error('not implemented');
}
export function numericColumn(result: Result, key: FieldKey): ParseResult<NumericResultColumn> {
	throw new Error('not implemented');
}
export function geoColumn(result: Result, key: FieldKey): ParseResult<GeoResultColumn> {
	throw new Error('not implemented');
}
export function bindViz(result: Result, viz: Viz): ParseResult<Viz> {
	throw new Error('not implemented');
}
export function parseQuery(payload: unknown): ParseResult<Query> {
	throw new Error('not implemented');
}
export function parseTable(payload: unknown): ParseResult<Table> {
	throw new Error('not implemented');
}
export function parseResult(payload: unknown): ParseResult<Result> {
	throw new Error('not implemented');
}
export function parseQuestion(payload: unknown): ParseResult<Question> {
	throw new Error('not implemented');
}
export function parseBoard(payload: unknown): ParseResult<Board> {
	throw new Error('not implemented');
}
export function parseLegacyQuestion(payload: unknown): ParseResult<Question> {
	throw new Error('not implemented');
}
export function compileFormulaText(input: {
	schema: Schema;
	label: string;
	formula: string;
}): ParseResult<CompiledColumn> {
	throw new Error('not implemented');
}
export function pinSet(ids: readonly QuestionId[]): ParseResult<HubPins> {
	throw new Error('not implemented');
}
