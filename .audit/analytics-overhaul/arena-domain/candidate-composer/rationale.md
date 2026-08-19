# Rationale

## Problem

Opla’s analytics product is a set of partially connected surfaces over the same JSONB warehouse. Prep mints LIVE forms. Lab aggregates charts in the browser while dashboards re-query on the server. Maps are a Leaflet demo. Reports exist twice (backend project canvas and org `localStorage` buckets). `SavedQuestion` stores three untyped JSON blobs. Walker has its own compute path with weaker auth. The locked vocabulary already says Analysis explores project Data and Reports shares org boards with team grants. Those nouns must not merge. The implementation must stop treating a derived table as a published form, stop letting charts save a souvenir that disagrees with dashboard re-query, and stop pretending four sidebar products (Lab, Prep, Spatial, Dashboard) are the product.

## Usage (caller's view)

Written first in [`usage.md`](usage.md). Three call sites: project Analysis table with derived-column save, question composer with dashboard parity assertion, org Report board with server persistence. The summary contract:

```ts
const session = openTableSession(client, source);
const question = await commitQuestion(client, { plan: session.plan(), lens, title, projectId });
const dashboardRows = await executePlan(question.plan, client);
```

Parse JSON at the boundary. Execute saved artifacts only through `executePlan`. Walker opens from `session.openScratchpad()` and never becomes a `Lens`.

## Shape

One pure package, `@opla/analytics-domain`, modeled after `@opla/form-runtime`: a small imperative session API hiding query compilation, lens validation, formula compilation, and migration. per **model-the-domain**, the fix is structure, not another adapter layer.

**The load-bearing types.**

`DataSource` is `CaptureDataset | AnalyticTable`. `AnalyticTable` has no `formId`. This makes "derived table is not a LIVE form" unrepresentable. per **type-system-discipline**, callers cannot pass a prep save through a form publish path because there is no form id on the type.

`QueryPlan` is versioned (`version: 2`) and is the only shape `executePlan` accepts. Filters, groupBy, measures, calculated columns, and `reviewStatus` live here. Studio preview and backend `execute_query` share this AST. Charts do not carry a parallel aggregation config.

`Lens` is presentation only: `table | chart | map | kpi | markdown`. Walker is absent. `goal` is absent, folded into `kpi.target`. `validateLens(source, plan, lens)` rejects illegal pairings before commit. A map without gps fields in the source fails at compose time, not at dashboard render with a placeholder.

`SavedQuestion` is `{ datasetId, plan, lens, metadata }`. No separate `source_config` / `query_config` / `viz_config` triple at the domain boundary. `parseQuestion(unknown)` upgrades legacy v1 blobs once or returns `rejected` with a code. No forever dual write. per **boundary-discipline**, JSONB dies at `parseQuestion`; internal code sees typed `SavedQuestion`.

**Session over service facade.**

`openTableSession` owns the Analysis table view: server sort/filter, HyperFormula preview, derived-column commit, table save, scratchpad handoff. This replaces Prep, the sessionStorage Lab bridge, and the stub question creator with one object. per **minimize-reader-load**, the analyst flow is one session, not four components negotiating state.

`executePlan` is the only execution path for saved artifacts. `DashboardViewer` and `OrgReports` call it. Client-side ECharts aggregation for saved cards is deleted. per **encode-lessons-in-structure**, builder/dashboard drift becomes a failing parity test, not a bug class.

**Scratchpad isolation.**

`Scratchpad` exposes a Walker seed derived from the current preview plan. It is not a `Lens`, not pinnable, not a `ReportBlock`. Explore stays available without contaminating the question contract. per **subtract-before-you-add**, we refuse to make Walker renderable on dashboards rather than building a second renderer path.

**Reports without a fourth noun.**

`OrgReport` is server-persisted layout of markdown blocks and `questionId` references. Team grants are on the model. `ProjectReport` JSON canvas and `ReportBucket` localStorage are out of scope and not bridged. Analysis dashboards (`AnalysisDashboard`) remain project-scoped composition; Reports reference the same `SavedQuestion` ids. Vocab stays split.

**What the public surface hides.**

Formula compilation, v1→v2 query upgrade, lens/plan consistency checks, review-status defaults, linked-vs-snapshot table save rules, and pin slot limits. What stays exposed: `AnalyticsClient` (host implements fetch), `Lens` variants (renderers need them), and `QueryPlan` (advanced composer UI may edit it directly).

**What we refuse to build.**

LIVE form minting for derived tables. Walker on dashboards, Hub, or Reports. Client aggregation for saved questions. SQL editor, external DBs, notebooks, public anonymous links, Kepler/Mapbox, Syncfusion/AG Grid as the write model, merging Analysis and Reports nav items, and a second query language alongside `QueryPlan` v2.

## Synthesis decision

Parent will fill.

## Tradeoffs accepted

- We accept a session object with `subscribe` instead of a flat `AnalyticsDomain` service interface, in exchange for one place that owns table exploration state and eliminates the Prep→Lab sessionStorage bridge.
- We accept rejecting legacy `viz_type: 'walker'` saved questions for dashboard/report use, in exchange for a lens union that cannot compile to a placeholder card. Walker remains in the scratchpad only.
- We accept folding `goal` into `kpi` with `target`, in exchange for one fewer composer and one fewer renderer path.
- We accept a new `analytic_tables` backend model (migration work), in exchange for derived tables that never appear under Design and never carry `Form.status=LIVE`.
- We accept HyperFormula staying in Studio for interactive column editing while persisted columns store a compiled `CalculatedExpr`, in exchange for server-rerunnable derived columns without running a spreadsheet engine on the backend.
- We accept deleting `QuickChart`'s client aggregation entirely, in exchange for a parity test that falsifies builder/dashboard disagreement.
- We accept `reviewStatus: 'approved_only'` as a plan field with a conservative default later, in exchange for typing the filter now rather than bolting stakeholder semantics on untyped JSON.

## Alternatives considered

**Fat `AnalyticsDomain` interface with ten methods (gemini-style facade).** Smaller diff for Studio wiring because every operation is one call. Loses on interface depth. Callers must orchestrate validation, preview, and parity themselves. Table exploration state stays in React component trees and the Prep→Lab handoff survives as a host concern. The facade looks complete and hides nothing.

**Keep derived datasets as LIVE forms with `kind=derived` metadata.** Smallest backend change. Loses because it preserves the wrong identity. Every critic flagged it. Forms mean capture instruments under Design. An Excel save is not a form. The type system cannot prevent a derived table from appearing in the form catalog without out-of-band conventions.

**Make Graphic Walker a first-class `viz_type` and build a dashboard Walker renderer.** Honors existing saved walker questions. Loses because Walker is a scratchpad format, not an Opla viz contract. Dashboard cards would either ship a placeholder forever or embed a second exploration engine inside a read-only board. We refuse both.

**Unify Analysis dashboards and org Reports into one canvas model.** One composition surface, fewer nouns in code. Loses against locked vocabulary. Reports are org-scoped stakeholder boards with team grants. Analysis is project Data exploration. Merging them in implementation recreates the confusion the vocab rename fixed.

## Open questions and risks

- How many production `saved_questions` rows are `viz_type=walker`, and is explicit rejection acceptable or do we need a one-time "rebuild in composer" migration UI?
- For linked analytic tables, does the backend re-run parent `calculated` columns on every query, or snapshot derived values at save time for linked mode too?
- Should `parseQuestion` auto-map legacy `goal` to `kpi` with `target: 1000` default, or reject rows with missing targets so analysts re-save intentionally?
- GPS fields today may be a single `gps_capture` JSON object vs split lat/lng columns. Does `MapLens` require normalizing to `latField`/`lngField` at query time in `execute_query`, or at dataset field metadata time?
- `ProjectReport` backend canvas still exists for some projects. Archive-only, or a one-way import of embedded questions into `SavedQuestion` refs?
- HyperFormula compile parity: which functions beyond arithmetic must v1 support so real Prep formulas do not fail at save?

## Next implementation step

Add `packages/analytics-domain` with `query/plan.ts`, `lens/kinds.ts`, and `test/fixtures/legacy-saved-questions/` plus a pytest mirror, then make `parseQuestion` pass or reject every fixture before touching Studio UI.
