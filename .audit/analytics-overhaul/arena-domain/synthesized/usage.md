# `@opla/analytics-domain`

Studio opens Analysis or Reports. Those two calls are the public API. Screens do not parse field keys, do not check truncation, and do not build a second query for ECharts.

```ts
import { createAnalysis, parseOrgId, parseProjectId } from '@opla/analytics-domain';

const api = createAnalysis({ request: (op) => studioPost('/analytics', op) });
const orgId = parseOrgId(currentOrg.id);
const projectId = parseProjectId(route.projectId);
if (!orgId.ok || !projectId.ok) return orgId.ok ? projectId : orgId;

const analysis = await api.openProjectAnalysis({ orgId: orgId.value, projectId: projectId.value });
const reports = await api.openOrgReports({ orgId: orgId.value });
```

`saveQuestion` takes a server `Result`. Truncated summaries cannot become a chart or KPI. Walker has no type in this package. Migration jobs call `parseLegacyQuestion`.

## Call site 1. Table, calculated column, saved view

```ts
export async function savePreparedView(
	analysis: ProjectAnalysis,
	table: Extract<Table, { kind: 'capture' }>,
	formula: string,
) {
	const compiled = analysis.compileFormula({
		table: table.id,
		label: 'value per visit',
		formula,
	});
	if (!compiled.ok) return compiled;

	return analysis.saveView({
		name: `${table.name} with value per visit`,
		parent: table.id,
		derived: [compiled.value],
	});
}
```

`saveView` keeps every queryable parent column. `drop` is the only way to omit one. The saved view has no `formId`. Design is untouched.

## Call site 2. Chart from a server result

`district` is a `FieldKey` from the table schema. `visits` is a `MetricAlias` declared on the summary.

```ts
export async function saveVisitsByDistrict(
	analysis: ProjectAnalysis,
	table: Table,
	district: FieldKey,
	visits: MetricAlias,
) {
	const query: Query = {
		version: 2,
		kind: 'summary',
		table: table.id,
		dimensions: [{ kind: 'field', field: district }],
		measures: [{ kind: 'measure', fn: 'count_rows', alias: visits }],
		orderBy: [{ field: visits, direction: 'desc' }],
		limit: analysis.defaultRowLimit,
	};

	const result = await analysis.run(query);
	return analysis.saveQuestion({
		title: 'Visits by district',
		result,
		viz: { kind: 'chart', mark: 'bar', x: district, y: visits },
	});
}
```

The board calls `analysis.run(question.query)` again. Same AST.

## Call site 3. Map, then the same question on a Report

```ts
const result = await analysis.run(rowQuery);
const saved = await analysis.saveQuestion({
	title: 'Store visits',
	result,
	viz: { kind: 'map', point: gpsField },
});
if (!saved.ok) return saved;

await reports.place({
	boardId,
	questionId: saved.value.id,
	layout: { x: 0, y: 0, w: 6, h: 4 },
});
await reports.grant({ boardId, grant: { teamId, role: 'viewer' } });
await reports.publish(boardId);
```

`gpsField` is a schema key whose type is `geo_point`. `saveQuestion` rejects any other field with `not_geo_point`. `OrgReports.runQuestion` uses `approved_capture` on capture tables. `ProjectAnalysis.run` uses `query_only`. Same engine. Named policy.
