# `@opla/analytics-domain`

Studio Analysis and org Reports talk to one typed module. You open a project or you open Reports. Those two calls are the public API. Everything else is a method on the object you got back.

Wire `createAnalysis` once in `opla-frontend/apps/studio/src/lib/analysis.ts`. Screens do not call `fetch`, do not send `Record<string, unknown>`, and do not build a second query for ECharts.

A chart is saved only after `run` returns. The saved question stores that `Result.query`. The board calls `run` again with the same query. There is no client aggregate and no `viz_override`.

## What you import

```ts
import { createAnalysis, parseOrgId, parseProjectId, parseLegacyQuestion } from '@opla/analytics-domain';
import type { ProjectAnalysis, OrgReports, Query, Viz } from '@opla/analytics-domain';
```

Bootstrap maps HTTP to `AnalysisOp`. It does not parse JSON into domain types. The domain parses `unknown` into `Table`, `Query`, `Result`, `Question`, and `Board`.

```ts
const api = createAnalysis({
	request: (op) => studioPost('/analytics', op),
});

const orgId = parseOrgId(currentOrg.id);
const projectId = parseProjectId(route.projectId);
if (!orgId.ok || !projectId.ok) throw new Error('bad route id');

const analysis = await api.openProjectAnalysis({ orgId: orgId.value, projectId: projectId.value });
const reports = await api.openOrgReports({ orgId: orgId.value });
```

`openProjectAnalysis` is Data → Analysis. `openOrgReports` is the org Reports nav item. You cannot list report boards on `ProjectAnalysis`. You cannot create a question on `OrgReports`.

## Views inside Analysis, not products

Table, chart, map, and KPI are `Viz` values on a question. Graphic Walker stays a Studio panel. It may call `analysis.run` after the host translates the scratch exploration into a `Query`. It has no type in this package and no `viz` variant.

Prep, Lab, Spatial, and Dashboard are not imports, routes, or saved kinds.

## What this package refuses

- Minting a LIVE `Form` for a derived table or a CSV upload.
- Snapshot datasets. A prepared table is a live view over its parent. A frozen extract is a file export.
- Saving Graphic Walker specs, markdown, or goal as a question.
- `viz_override` on a board tile.
- A second query language, a dual-write period, or `cache_ttl_seconds`.
- `POST /compare` as a second engine.
- Accra demo rows, Kepler, Syncfusion, DirectoryGrid, SQL, and Python notebooks.
- Merging Analysis and Reports into one nav item.

Existing `saved_questions` JSON is parsed or rejected. Rejected rows stay visible as rebuild-only. New writes are `Query` JSON only.

---

## Call site 1. Table, calculated column, saved view

File: `opla-frontend/apps/studio/src/pages/ProjectAnalysis.tsx`

The analyst opens a capture table under the project, adds a column the server can re-run, and saves a view. Design never gains a form.

```ts
import {
	findField,
	parseTableId,
	queryableKeys,
	selectAll,
	type ProjectAnalysis,
} from '@opla/analytics-domain';

export async function savePreparedView(
	analysis: ProjectAnalysis,
	datasetId: string,
	formula: string,
) {
	const tableId = parseTableId(datasetId);
	if (!tableId.ok) return tableId;

	const table = analysis.tables.find((item) => item.id === tableId.value);
	if (!table) throw new Error('dataset is not in this project');

	const value = findField(table, 'total_value');
	if (!value.ok) return value;

	const compiled = analysis.compileFormula({
		table: table.id,
		label: 'value per visit',
		formula,
	});
	if (!compiled.ok) return compiled;

	const keep = queryableKeys(table);
	if (!keep.ok) return keep;

	const view = await analysis.saveView({
		name: `${table.name} with value per visit`,
		parent: table.id,
		keep: keep.value,
		derived: [compiled.value],
	});
	if (!view.ok) return view;

	const query = selectAll(view.value, analysis.defaultRowLimit);
	if (!query.ok) return query;

	const preview = await analysis.run(query.value);
	return { ok: true as const, value: { view: view.value, preview } };
}
```

HyperFormula may paint the working grid in this page. `compileFormula` is the only path from that text into a saved column. `IF` and `VLOOKUP` fail compile in this program. Arithmetic over number fields is what the server will run later.

`table.kind === 'capture'` still points at the published form through `formId`. That field is provenance. It is not a Design identity.

---

## Call site 2. Chart from a server result, then the board re-queries it

File: `opla-frontend/apps/studio/src/components/analytics/AnalysisBoard.tsx`

The builder and the board share `analysis.run`. The number on the card is the number the builder saved.

```ts
import {
	numericColumn,
	parseBoardId,
	parseFieldKey,
	type ProjectAnalysis,
	type Query,
	type Table,
} from '@opla/analytics-domain';

export async function saveVisitsByDistrict(analysis: ProjectAnalysis, table: Table) {
	const district = parseFieldKey('district');
	const visits = parseFieldKey('visits');
	if (!district.ok || !visits.ok) return district.ok ? visits : district;

	const query: Query = {
		kind: 'summary',
		table: table.id,
		dimensions: [{ kind: 'field', field: district.value }],
		measures: [{ kind: 'measure', fn: 'count_rows', alias: visits.value }],
		orderBy: [{ field: visits.value, direction: 'desc' }],
		limit: analysis.defaultRowLimit,
	};

	const result = await analysis.run(query);
	if (result.kind === 'truncated') {
		return { ok: false as const, error: 'chart would hide rows', code: 'truncated_summary' as const };
	}

	const y = numericColumn(result, visits.value);
	if (!y.ok) return y;

	const saved = await analysis.saveQuestion({
		title: 'Visits by district',
		result,
		viz: { kind: 'chart', mark: 'bar', x: district.value, y: y.value.key },
	});
	if (!saved.ok) return saved;

	return analysis.pin(saved.value.id);
}

export async function renderAnalysisBoard(analysis: ProjectAnalysis, rawBoardId: string) {
	const boardId = parseBoardId(rawBoardId);
	if (!boardId.ok) return boardId;

	const board = await analysis.loadBoard(boardId.value);
	if (!board.ok) return board;

	const cards = await Promise.all(
		board.value.tiles.map(async (tile) => {
			if (tile.kind === 'markdown') return tile;
			const question = await analysis.loadQuestion(tile.questionId);
			if (!question.ok) return question;
			const result = await analysis.run(question.value.query);
			return { tile, question: question.value, result };
		}),
	);
	return { ok: true as const, value: cards };
}
```

Walker Explore is a sibling panel in this page. Save in that panel means the host built a `Query`, called `run`, then `saveQuestion` with an Opla `Viz`. If the host cannot translate the scratch exploration, there is no save.

---

## Call site 3. Map of live GPS, then the same question on a Report

File: `opla-frontend/apps/studio/src/pages/ReportBoard.tsx`

Maps read a `geo` column from the table schema. GPS capture fields are that column. Two numeric lat and lng fields are not a map.

```ts
import {
	geoColumn,
	parseBoardId,
	parseFieldKey,
	parseQuestionId,
	parseTeamId,
	type OrgReports,
	type ProjectAnalysis,
	type Query,
} from '@opla/analytics-domain';

export async function saveCoverageMap(
	analysis: ProjectAnalysis,
	query: Query,
	title: string,
	gpsFieldName: string,
) {
	const gps = parseFieldKey(gpsFieldName);
	if (!gps.ok) return gps;

	const result = await analysis.run(query);
	const point = geoColumn(result, gps.value);
	if (!point.ok) return point;

	return analysis.saveQuestion({
		title,
		result,
		viz: { kind: 'map', point: point.value.key },
	});
}

export async function shareOnReport(
	analysis: ProjectAnalysis,
	reports: OrgReports,
	rawQuestionId: string,
	rawTeamId: string,
	reportTitle: string,
) {
	const questionId = parseQuestionId(rawQuestionId);
	const teamId = parseTeamId(rawTeamId);
	if (!questionId.ok || !teamId.ok) return questionId.ok ? teamId : questionId;

	const question = await analysis.loadQuestion(questionId.value);
	if (!question.ok) return question;

	const saved = await reports.saveBoard({
		title: reportTitle,
		sources: [question.value.projectId],
		tiles: [
			{
				kind: 'question',
				questionId: question.value.id,
				layout: { x: 0, y: 0, w: 6, h: 4 },
			},
		],
		grants: [],
	});
	if (!saved.ok) return saved;

	const granted = await reports.grant({
		boardId: saved.value.id,
		grant: { teamId: teamId.value, role: 'viewer' },
	});
	if (!granted.ok) return granted;

	return reports.publish(saved.value.id);
}

export async function openReportAsTeammate(reports: OrgReports, rawBoardId: string) {
	const boardId = parseBoardId(rawBoardId);
	if (!boardId.ok) return boardId;

	const board = await reports.loadBoard(boardId.value);
	if (!board.ok) return board;

	const cards = await Promise.all(
		board.value.tiles.map(async (tile) => {
			if (tile.kind === 'markdown') return tile;
			return reports.runQuestion(tile.questionId);
		}),
	);
	return { ok: true as const, value: { board: board.value, cards } };
}
```

`reports.runQuestion` uses the question's stored `Query` and forces `approved_only` on capture tables. Analysis `run` does not inject that filter. The two numbers may differ when rejected rows exist. That is a policy difference, not a second language.

Team grants are `viewer`, `commenter`, `explorer`, or `owner`. They live on the report, not in `localStorage`.

## Legacy rows

On first load of an old `saved_questions` row, call `parseLegacyQuestion(blob)`. `ok: true` means you may `run` it. `ok: false` with `walker_not_supported` or `unparseable_query` means the UI shows the title and a rebuild action. Do not write the old blob back. Do not translate Walker into a hidden sidecar.
