# Rationale

## Problem

Analysis today is a thin layer over form submissions with several product names and two query answers. Prep saves a LIVE form. Charts aggregate in the browser while dashboards call `execute_query`. Maps paint Accra demo rows. Org Reports live in `localStorage`. Questions store untyped `query_config` blobs, including Walker specs dashboards cannot render. Locked vocab already splits explore (project Data → Analysis) from share (org Reports with team grants). The redesign has to honor that split, stop treating a table as a published form, and make builder and board the same `Query`.

## Usage (caller's view)

A Studio screen calls `openProjectAnalysis` or `openOrgReports`. It never builds a second query for a chart library. Saving a chart means `run`, then `saveQuestion({ title, result, viz })`. Saving a prepared table means `compileFormula` then `saveView`. That view is not a form. Sharing means `reports.place` or `saveBoard` plus `grant` plus `publish`. Walker Explore is a host panel with no domain type. See `usage.md` for the three call sites this sketch is derived from.

## Shape

Four types do the work, per `foundational-thinking` and `model-the-domain`. `Table` is capture, view, or upload. `Query` is `rows` or `summary`. `Question` is a stored `Query` plus table, chart, map, or kpi. `Board` is an analysis board or a report.

Capture tables may carry `formId` as provenance. Views store `ViewDefinition` with compiled `Expr` columns. Uploads store schema and rows. None of those variants include a Form identity to publish, per `redesign-from-first-principles`. The current `create_derived_dataset` path is inverted. A table is not a form with `kind: derived`.

`Query` is split so grouped measures cannot appear on a row scan, and a row scan cannot pretend to be a KPI. `count_rows` has no field. Other measures require one. Attachment fields are not queryable. Map viz must pass `geoColumn`. Those rules are constructive types, per `type-system-discipline`, not a comment on `viz_config`.

`saveQuestion` takes a `Result`, not a hand-built query, per `encode-lessons-in-structure`. The souvenir bug is unrepresentable at the call site. Truncated summaries cannot save as chart or kpi. Board tiles hold a `QuestionId` and never a `viz_override`. Markdown is a tile. Walker, goal, and markdown are absent from `Viz`.

The public API is two session objects, per `laziness-protocol` and `minimize-reader-load`. Compile, bind, row policy, pin cardinality, and JSON parse sit behind them. Callers do not coordinate a parser, a formula compiler, and an execute client. `AnalysisOp` is the host adapter. Wire JSON is not re-exported.

`ProjectAnalysis.run` uses `query_only`. `OrgReports.runQuestion` uses `approved_capture` on capture tables. Same engine, named policy at the report boundary, per `boundary-discipline`.

HyperFormula may preview in the grid. Persistence is `Expr`. `IF` and `VLOOKUP` fail compile. A column the server cannot re-run cannot be saved. Snapshot datasets are refused. Export a file if you need a freeze.

Walker stays a Studio scratchpad. The host must translate an exploration into `Query` before `run`. Failure means no save. Analysis boards and reports render Opla viz only.

Legacy `saved_questions` JSON goes through `parseLegacyQuestion`. Walker and unparseable blobs become rebuild-only rows. Writers emit `Query` only. No dual language, per `outcome-oriented-execution` and `migrate-callers-then-delete-legacy-apis`.

Pins are a set of at most four `QuestionId`s. Pinning an existing id is a no-op. Publishing a published report is a no-op, per `make-operations-idempotent`. Questions belong to a project. Boards store ids. Hub pins replace the whole set through one method. Two screens do not append into a shared JSON blob, per `separate-before-serializing-shared-state`.

Lab, Prep, Spatial, and Dashboard are deleted as product names, per `subtract-before-you-add` and `experience-first`. They become panels and board tiles.

The two sessions are deep. They hide formula compile, legacy parse, pin limits, report row policy, and viz bind. `Query`, `Viz`, `Table` origin, and report grants stay visible because those are the analyst's nouns. A fluent `chart.bar()` factory layer would make callers learn the factories and still learn `Query`.

## Synthesis decision

parent will fill

## Tradeoffs accepted

- We accept that Analysis and Report numbers can differ on capture tables, in exchange for one `Query` plus an explicit `RowPolicy` instead of a silent filter or a second engine.
- We accept a smaller saved-formula language than HyperFormula can preview, in exchange for every persisted column running on the server.
- We accept rebuild-only rows for Walker and junk blobs, in exchange for no dual-write window.
- We accept no snapshot dataset, in exchange for one live view identity and no stale copy that looks like a warehouse table.
- We accept that Explore save can fail when Walker cannot translate, in exchange for boards that never store a spec they cannot re-query.
- We accept one `Board` type with a discriminant, in exchange for not shipping a fourth noun beside Analysis, Reports, and the old project report canvas.

## Alternatives considered

- **Save a `QuestionDraft` the caller assembled without `run`.** Smaller write path. Callers then own the souvenir problem again. Lost. Depth belongs in `saveQuestion`.
- **Keep snapshot and linked derived modes.** Matches today's Prep. It keeps two identities for one grid, and snapshot rows rot. Lost. Export is the freeze.
- **Persist Graphic Walker as `viz_type: walker`.** Keeps Explore saves working tomorrow. Boards still cannot render it without a second engine. Lost.
- **Markdown and goal as question viz types.** Matches the current `SavedQuestion` enum. A question without a `Query` is a lie, and goal is a KPI with a target. Lost.
- **Two unrelated dashboard and report record types with different card JSON.** Matches the current tables. Callers relearn tiles and still need grants on one side. Lost. One `Board`, two kinds.
- **A fluent `analysis.question`, `chart.bar`, and `field()` kit.** Pretty call sites. It is a shallow layer over the same AST, and it grows a second import style beside `Query`. Lost.

## Open questions and risks

- Should a view over a capture table inherit `approved_capture` when placed on a report, or only the capture table itself?
- How many existing `saved_questions` rows parse cleanly, and is rebuild-only acceptable for the rest in the first Studio release?
- Where do leftover `ProjectReport` canvases go once org Reports are the share product? Archive, rewrite into `Board`, or leave frozen?
- Which GPS payload shapes already in `Submission.data` parse as `geo` without a Prep flatten step?
- Who owns Walker-to-`Query` translation in the Explore panel, and what happens to explorations that have no Opla viz equivalent?

## Next implementation step

Add `Query` parse fixtures and point `AnalyticsService.execute_query` at the parsed AST, with tests that a summary `run` result is the payload `saveQuestion` would store.
