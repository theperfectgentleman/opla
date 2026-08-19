# Usage (caller's view)

`@opla/analytics-domain` is a pure TypeScript package. No React, no Leaflet, no Graphic Walker, no HyperFormula. It owns dataset identity, the query AST, derived-column compilation, question parsing, and the invariants that keep builder numbers equal to dashboard numbers. Studio supplies widgets, routing, API fetch, and map/chart renderers.

Analysis is not four products. **Table**, **chart**, **map**, and **KPI** are lenses over the same `QueryPlan`. **Explore** (Graphic Walker) is a scratchpad that never becomes a dashboard card. **Reports** are org boards that reference saved questions. They are not a second query language.

## The whole public surface

```ts
import {
  parseQuestion,
  parseQueryPlan,
  openTableSession,
  openScratchpad,
  commitQuestion,
  executePlan,
  questionView,
} from '@opla/analytics-domain';
import type {
  DataSource,
  QueryPlan,
  SavedQuestion,
  TableSession,
  Scratchpad,
  QueryResult,
  QuestionView,
} from '@opla/analytics-domain';
```

Seven functions. Everything else is a type. Hosts pass an `AnalyticsClient` that wraps `fetch`; the package never imports `axios` or environment URLs.

```ts
export interface AnalyticsClient {
  listSources(scope: ProjectScope | OrgScope): Promise<readonly DataSource[]>;
  runQuery(plan: QueryPlan): Promise<QueryResult>;
  saveTable(spec: TableSaveSpec): Promise<DataSource>;
  saveQuestion(spec: QuestionCommit): Promise<SavedQuestion>;
  loadQuestion(id: QuestionId): Promise<SavedQuestion>;
}
```

Parse at the boundary. Persisted JSON from `saved_questions` enters through `parseQuestion`. Dashboard re-query uses `executePlan(question.plan, client)` and never re-aggregates rows in the browser.

## Call site 1. Project Data → Analysis table, derived column, save

Location: `opla-frontend/apps/studio/src/pages/ProjectAnalysis.tsx` (replaces `PrepTable.tsx` + orphaned hub wiring).

An analyst opens a capture dataset under **Data → Analysis**, sorts and filters on the server, adds a calculated column in HyperFormula, and saves a derived table. The save does **not** mint a LIVE form or appear under Design.

```tsx
export function ProjectAnalysisTable({ client, projectId, datasetId }: Props) {
  const [source, setSource] = useState<DataSource | null>(null);
  const session = useTableSession(client, source);

  useEffect(() => {
    client.listSources({ kind: 'project', projectId }).then((sources) => {
      const hit = sources.find((s) => s.id === datasetId);
      if (hit) setSource(hit);
    });
  }, [client, projectId, datasetId]);

  if (!source || !session) return <Loading />;

  const view = session.view();

  return (
    <AnalysisShell title={source.name} projectId={projectId}>
      <ServerTable
        columns={view.columns}
        rows={view.rows}
        sort={view.sort}
        filters={view.filters}
        onSort={(sort) => session.setSort(sort)}
        onFilters={(filters) => session.setFilters(filters)}
      />
      <FormulaBar
        draft={view.formulaDraft}
        onDraft={(draft) => session.editFormula(draft)}
        onCommit={(name, formula) => session.addDerivedColumn({ name, formula })}
      />
      <Toolbar>
        <Button onClick={() => session.openScratchpad()}>Explore (scratchpad)</Button>
        <Button
          disabled={!view.canSaveTable}
          onClick={async () => {
            const saved = await session.saveTable({
              name: `${source.name} — cleaned`,
              mode: view.rowCount > 50_000 ? 'linked' : 'snapshot',
            });
            onTableSaved(saved);
          }}
        >
          Save table
        </Button>
        <Button onClick={() => navigateToCompose(session)}>Summarize & chart</Button>
      </Toolbar>
    </AnalysisShell>
  );
}

function useTableSession(client: AnalyticsClient, source: DataSource | null) {
  return useMemo(() => (source ? openTableSession(client, source) : null), [client, source]);
}
```

`openTableSession` returns a `TableSession`. Every row the analyst sees came from `client.runQuery` with the session's current `QueryPlan`. HyperFormula runs only for derived-column preview; persisted derived columns compile to the same `CalculatedExpr` AST the backend executes. There is no `sessionStorage` handoff to a separate Lab product.

## Call site 2. Compose a chart, save, pin, dashboard re-query

Location: `opla-frontend/apps/studio/src/components/analytics/QuestionComposer.tsx` (replaces `QuickChart` client aggregation + `WalkerAnalysisLab.handleSaveAnalysis`).

The analyst groups on the server, picks a chart lens, saves a `SavedQuestion`, pins it on Hub, and the dashboard viewer re-runs the identical plan.

```tsx
export async function composeRegionalBarChart(
  client: AnalyticsClient,
  projectId: string,
  source: DataSource
) {
  const session = openTableSession(client, source);

  session.setPlan({
    version: 2,
    datasetId: source.id,
    select: [],
    filters: approvedOnlyFilter(),
    groupBy: [{ field: fieldKey('region') }],
    measures: [{ field: fieldKey('submission_id'), fn: 'count', as: 'submissions' }],
    orderBy: [{ field: 'submissions', direction: 'desc' }],
    limit: 100,
  });

  const preview = await session.preview();

  const question = await commitQuestion(client, {
    title: 'Submissions by region',
    projectId,
    plan: session.plan(),
    lens: {
      kind: 'chart',
      chartType: 'bar',
      categoryField: 'region',
      valueFields: ['submissions'],
    },
  });

  await client.pinToHub({ projectId, questionId: question.id, slot: 0 });

  const dashboardNumber = await executePlan(question.plan, client);
  const builderNumber = preview;

  assert.deepEqual(
    dashboardNumber.rows,
    builderNumber.rows,
    'dashboard must not disagree with composer'
  );

  return question;
}
```

`commitQuestion` rejects a lens whose fields are absent from the plan result schema. A map lens requires geo fields in the plan's `select`. A KPI lens requires exactly one measure and forbids `groupBy`. Illegal pairings are compile errors, not runtime placeholders.

`DashboardViewer` does not import ECharts aggregation helpers for saved cards:

```tsx
const view: QuestionView = questionView(card.question);
const data = await executePlan(view.plan, client);
return <OplaChart spec={view.lens} data={data} />;
```

Walker is not a `lens` variant. `openScratchpad(session)` opens Graphic Walker against the current plan preview. Nothing from the scratchpad calls `commitQuestion` unless the analyst explicitly builds a typed plan and lens in the composer.

## Call site 3. Org Reports board (server persistence, team grants)

Location: `opla-frontend/apps/studio/src/pages/OrgReports.tsx` (replaces `reportBuckets.ts` localStorage).

A senior manager assembles an org **Report** from saved questions. A second org member opens it from the org sidebar. Analysis and Reports stay separate nav items.

```tsx
export async function publishExecutiveBrief(
  client: AnalyticsClient,
  orgId: string,
  questionIds: QuestionId[]
) {
  const report = await client.createReport({
    orgId,
    title: 'Q3 executive brief',
    grants: [
      { teamId: teamId('execs'), role: 'viewer' },
      { teamId: teamId('analysts'), role: 'explorer' },
    ],
    layout: [
      { kind: 'markdown', id: 'intro', body: '## Q3 field performance\nCoverage reached 94%.' },
      ...questionIds.map((questionId, index) => ({
        kind: 'question' as const,
        id: `q-${index}`,
        questionId,
      })),
    ],
  });

  const loaded = await client.loadReport(report.id);
  const blocks = await Promise.all(
    loaded.layout.map(async (block) => {
      if (block.kind === 'markdown') return block;
      const question = await client.loadQuestion(block.questionId);
      const data = await executePlan(question.plan, client);
      return { ...block, view: questionView(question), data };
    })
  );

  return { report: loaded, blocks };
}
```

Reports never embed a second query blob. Blocks reference `questionId` or carry markdown. `explorer` grant may open the question in Analysis; `viewer` sees rendered lenses only. `ProjectReport` canvas JSON is out of scope for this package and is not bridged here.

## Migration boundary

Existing `saved_questions` rows enter through `parseQuestion(rawJson)`:

```ts
const parsed = parseQuestion(row);
if (parsed.outcome === 'rejected') {
  archiveWithReason(row.id, parsed.reason);
  return;
}
const question: SavedQuestion = parsed.value;
```

Legacy `viz_type: 'walker'` questions are rejected for dashboard use with an explicit reason. Legacy `goal` questions map to `kpi` with `target`. Legacy `query_config` without `version` attempts v1→v2 upgrade once; failure rejects the row. There is no dual-write of two query languages.

## What this package refuses

| Refused | Reason |
|---------|--------|
| Minting LIVE `Form` for derived tables | Tables are not published capture instruments |
| `viz_type: 'walker'` on dashboards, Hub pins, Reports | Walker is scratchpad-only |
| Client-side aggregation for saved questions | Builder/dashboard drift |
| `ReportBucket` / `localStorage` reports | One shareable Reports product |
| Top-level Lab / Prep / Spatial / Dashboard nav products | They are views inside Analysis |
| `goal` as a separate lens | Folded into `kpi` with `target` |
| SQL editor, external DBs, notebooks | Out of program scope |
| Public anonymous analytics links | Org membership is the gate |
