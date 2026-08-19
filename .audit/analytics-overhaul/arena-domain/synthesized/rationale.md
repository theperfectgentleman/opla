# Problem

Analysis today stores untyped JSON, computes charts in the browser, saves derived tables as LIVE forms, and splits share across three report products. The locked vocabulary already separates project Analysis from org Reports. The domain has to make that split real, make a table not a form, and make builder and board the same query.

# Usage

See [usage.md](./usage.md). Two openers. `saveQuestion` consumes a server `Result`. Walker is not an import.

# Shape

Four types. `Table` is capture or view. `Query` is rows or summary, `version: 2`. `Question` is that query plus table, chart, map, or kpi. `Board` is an analysis board or a report. Markdown is a tile.

Capture may remember `formId`. A view stores compiled `Expr` columns. Neither writes `Form`. Snapshot datasets are refused. A freeze is a file export.

`saveQuestion({ title, result, viz })` makes a souvenir aggregation unrepresentable. Truncation is rejected inside that method. Chart `y` is a `MetricAlias` declared on the summary. Map `point` is `geo_point`.

The public API is two session objects. Compile, bind, pin cardinality, and JSON parse sit behind them. `ProjectAnalysis.run` uses `query_only`. `OrgReports.runQuestion` uses `approved_capture`. Same engine.

# Synthesis decision

Base is grok. Cross-judge [Opus](d3beca8b-50c3-4b2d-9f36-a266fed5b07e) scored grok 28, composer 22, luna 20, gemini 10. Parent agreed. Grok is the only candidate where the one-way doors are types, not comments.

Grafted from composer: `version: 2` on Query, `upgradeQueryConfigV1` / `upgradeVizConfig` as internal v1 entry points, legacy-fixture plus pytest parity harness, retired-product table.

Grafted from luna: `MetricAlias` so a chart value points at a declared measure, `geo_point` / `geo_shape` instead of one `geo`.

Grafted from gemini: choice `options` and `recordCount` on the table. File-level retire map. Nothing structural.

Rejected from grok itself: dual `formula` plus `expr` as two sources of truth (`formula` is now display-only), exported helper zoo, caller-side truncation check, `upload` table variant this program, `viz_override`, storing `reviewStatus` on the query. `saveView` now computes keep internally so call site 1 is not eight guard clauses. `AnalysisIO.request` is mapped per op so a response mismatch is a type error.

Rejected from composer: `lensOverride`, snapshot/linked heuristic, `'_row'` sentinel, markdown as a lens, Walker seed JSON in the domain, reviewStatus inside the plan.

Rejected from luna: markdown as a question view, fluent `chart.bar()` kit, `DashboardCard.view` duplicate, metric refs inside ungrouped calculated columns.

Rejected from gemini: walker on SavedQuestion, optional form_id, independent viz_type/viz_config, fat AnalyticsDomain facade.

# Tradeoffs accepted

- We accept Analysis and Report numbers can differ on capture tables, in exchange for one Query plus an explicit RowPolicy.
- We accept a smaller saved-formula language than HyperFormula can preview, in exchange for every persisted column running on the server.
- We accept rebuild-only rows for Walker and junk blobs, in exchange for no dual-write window.
- We accept no snapshot dataset, in exchange for one live view identity.
- We accept CSV upload deferred, in exchange for proving the query contract first.

# Alternatives considered

Saving a caller-assembled query without `run` lost. Callers would own the souvenir bug again.

Keeping snapshot and linked modes lost. Two identities for one grid, and snapshot rows rot.

Persisting Graphic Walker lost. Boards cannot re-query it.

Unifying Analysis boards and org Reports into one nav item lost against locked vocabulary.

# Open questions and risks

- How many production saved_questions parse, and is rebuild-only acceptable on day one?
- Where do leftover ProjectReport canvases go? Archive, or one-way import of embedded question ids?
- Which GPS payloads already in Submission.data parse as geo_point?

# Next implementation step

Add `packages/analytics-domain` with Query parse fixtures and point `AnalyticsService.execute_query` at the parsed AST, with tests that a summary `run` result is the payload `saveQuestion` would store.
