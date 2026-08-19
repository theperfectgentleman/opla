# Module map

One package, `@opla/analytics-domain`. Studio screens import the two session objects. The backend executes the same `Query` after the same parse. Host widgets, Graphic Walker, HyperFormula, Leaflet, and ECharts stay outside.

## Public API

`packages/analytics-domain/src/index.ts` re-exports only:

- `createAnalysis`, `open` methods on `AnalysisApi`
- `parseOrgId`, `parseProjectId`, `parseLegacyQuestion`
- `findField`, `queryableKeys`, `selectAll`, `numericColumn`, `geoColumn`
- the types those signatures need

Screens import `ProjectAnalysis` and `OrgReports`. They do not import `AnalysisOp`, SQL, or wire JSON.

## Files by ownership

```
packages/analytics-domain/src/
  index.ts       public re-exports
  ids.ts         branded ids and parseLimit
  table.ts       Table, Schema, ViewDefinition, CompiledColumn, compileFormulaText
  query.ts       Query, Predicate, Expr, Measure, Result
  question.ts    Viz, Question, bindViz, saveQuestion rules
  board.ts       Board, Tile, TeamGrant, HubPins, pinSet
  parse.ts       unknown JSON to Table, Query, Result, Question, Board, parseLegacyQuestion
  session.ts     createAnalysis, ProjectAnalysis, OrgReports
```

`table.ts` owns dataset identity. A capture table may remember `formId`. A view stores a compiled definition. An upload is rows with a schema. None of these write `Form`.

`query.ts` owns the language `execute_query` runs. Derived columns are `Expr` here, not a second formula dialect.

`question.ts` owns the bind from `Result.columns` to `Viz`. Truncated summaries cannot become chart or kpi.

`board.ts` owns composition and report grants. It does not own queries.

`parse.ts` is the only module that accepts `unknown`. Session methods parse IO results here, then trust types.

`session.ts` is the deep facade. `ProjectAnalysis.run` always sends `rowPolicy: 'query_only'`. `OrgReports.runQuestion` always sends `rowPolicy: 'approved_capture'`. Both call the same execute op.

## Host (not this package)

`opla-frontend/apps/studio/src/lib/analysis.ts` implements `AnalysisIO.request` as HTTP. One file.

`ProjectAnalysis.tsx` is Data → Analysis. Table, chart, map, and Walker Explore are panels in that page.

`AnalysisBoard.tsx` replaces `DashboardViewer`. It renders Opla viz from `run` results.

`ReportBoard.tsx` drops `reportBuckets.ts`. It calls `openOrgReports`.

Leaflet, ECharts, HyperFormula, and Graphic Walker are imported only by those host files.

## Backend

`opla-backend/app/domain/analysis/` holds Pydantic models that match `Query`, `Table`, `Question`, and `Board` JSON. Hand-written, locked by round-trip fixtures against the TypeScript parse tests.

`AnalyticsService.execute_query` takes a parsed `Query`. It stops taking a loose `dict`.

New table `analytics_tables` stores view and upload identity. `form_datasets` remains the capture warehouse. `saved_questions.query_config` stores `Query` JSON. `analytics_boards` stores both board kinds. `dashboard_cards` become board tiles with stable `TileId` values. `project_pinned_analytics` stores a `HubPins` list.

## Delete

- `create_derived_dataset` Form mint, and `prep-*` LIVE forms after a one-shot rewrite into views
- `viz_type` values `walker`, `goal`, `markdown`
- `DashboardCard.viz_override`
- `cache_ttl_seconds`
- `POST /analytics/compare`
- Walker compute as a second engine. Walker calls `run` with a translated `Query` or it does not compute
- `reportBuckets.ts` localStorage
- `SpatialAnalysisLab` demo data
- sessionStorage Prep → Lab handoff
- Lab, Prep, Spatial, and Dashboard as nav product names

Do not add packages named lab, prep, spatial, walker-bridge, or formula-v2. Formula compile lives in `table.ts`. Walker translation lives in the Studio Explore panel.

## Reader path

A Studio question "what number is on this card?" is three files. `AnalysisBoard.tsx` → `session.ts` `run` → `query.ts` plus backend `execute_query`. If a later change needs a fourth file for that question, flatten it.
