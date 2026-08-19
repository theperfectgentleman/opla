# Problem

Opla has a real backend query engine, but Studio currently stores untyped JSON, computes charts separately in the browser, creates derived tables as LIVE Forms, and has two incompatible Reports implementations. The new shape must make the query executable contract authoritative, keep Analysis under project Data, keep Reports as org-level stakeholder boards with Team grants, and let table, chart, map, KPI, and markdown views share one saved question. Existing `saved_questions` JSON must either parse into this contract or be explicitly rejected.

# Usage

The caller's usage is in [usage.md](./usage.md). It starts with a README-level `analysis.question` example, then shows a Project Data table, one query used by both builder and dashboard, a live GPS map, and a server-backed Report board. The examples deliberately do not expose transport JSON, Form identities for derived tables, or browser-local Report state.

# Shape

The center of the design is `QueryAst`. It names one `DatasetId`, fields, metrics, filters, grouping, calculated expressions, ordering, and pagination. Studio creates it and the backend executes it. The builder displays the returned `QueryResult`; dashboards execute the saved AST again. No chart renderer is allowed to invent a second aggregation.

`DatasetSource` is a discriminated union. A published form dataset and a derived table are different identities. `DerivedTableDefinition` points to a parent dataset and stores the re-runnable query definition. Its persistence path is analytics-only. It cannot mint a Form or appear under Design.

`PersistedView` is a closed union of table, chart, map, KPI, and markdown. `MapView` requires a location field expression and can only pass validation against a `geo_point` or `geo_shape` field. Graphic Walker uses `WalkerScratchpad`, which is intentionally outside the persisted view union. It remains useful for Explore without becoming a dashboard renderer.

Semantic identifiers are branded. Metrics use branded aliases, and query references point to field or metric variants rather than arbitrary strings. Non-empty filter groups and `in` values are tuple types. The boundary parsers turn JSON blobs into these types, while compiler validation checks relationships that require the selected dataset schema. This follows type-system discipline and boundary discipline.

The public surface is intentionally small. Consumers need constructors, parsers, one executor, question persistence, derived-table persistence, Analysis dashboard placement, and Reports placement and grants. Compiler details, transport shape, ORM shape, and renderer adapters remain internal. This gives interface depth by concentrating query invariants in the domain instead of making every Studio surface understand them.

The design uses the existing `SavedQuestion` envelope during migration, but not its current untyped meaning. The server and Studio move together to this contract. A legacy row that cannot be mapped is rejected with a visible repair status. There is no permanent dual write of a legacy query language and the new AST.

# Synthesis decision

parent will fill

# Tradeoffs accepted

- We accept a stricter migration that rejects malformed or obsolete saved questions in exchange for one query language and no silent dashboard drift.
- We accept a new analytics identity for derived tables in exchange for removing the dangerous Form and Design coupling.
- We accept that maps require declared live geo fields in exchange for refusing disconnected demo coordinates.
- We accept that Walker is not a persisted visualization in exchange for keeping Explore useful without contaminating dashboard rendering.
- We accept a small public module with rich internal compiler and adapter code in exchange for shorter and safer Studio call chains.
- We accept server round trips for previews and charts in exchange for identical answers at save time and dashboard view time.

# Alternatives considered

## Keep the existing JSON envelope and add viz branches

This exposes malformed query and visualization combinations to every caller. It also preserves browser chart aggregation, LIVE-form derived datasets, and the `walker` dashboard dead end. It has a shallow interface because the complexity leaks into each UI. It loses.

## Make a generic pipeline of source, prep, lab, dashboard, and report modules

This mirrors the current screens rather than the domain. Callers must understand temporal handoffs, session storage, and which phase owns formulas. It also encourages each phase to serialize its own query shape. The domain-centered question and executor hide more complexity behind fewer concepts.

## Use a second report-specific query and card model

This would make Reports easy to customize locally, but it would duplicate query semantics and make a question mean different things in Analysis and Reports. A Report should place the same saved question, not fork it. The one-question contract has deeper interfaces and preserves re-query correctness.

# Open questions and risks

- Should an unparseable legacy `SavedQuestion` be marked for repair in place, or copied into a separate quarantine table before the migration removes the old fields?
- Should linked derived tables permit only projections and calculated columns at first, or also filters and grouping once server reruns are proven?
- Which existing field type values map to `geo_point` and `geo_shape`, and should GPS latitude and longitude pairs be normalized at source ingestion?
- Should the first server-side query contract include approved-only `review_status` filtering, or should that be a mandatory default in the next unit after the contract harness?
- Does the existing project dashboard API remain named `AnalyticsDashboard`, or should its public Studio name become Analysis dashboard while the storage name stays transitional?

# Next implementation step

Add the typed parser and compiler test harness around `execute_query`, then migrate one chart save and dashboard render path to consume the same `QueryAst` before building the table or map views.
