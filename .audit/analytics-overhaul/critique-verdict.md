# Lead critique verdict

Judged 2026-08-19 after four independent critics. Not an average.

## Act on

1. **Derived tables must stop being LIVE forms.** Every critic called this structural. An Excel grid cannot write into Design. `create_derived_dataset` is the wrong identity.
2. **One shareable Reports product.** Vocab already locked org Reports as the stakeholder board. Kill the localStorage `ReportBucket` by giving that noun a server model. Keep `AnalyticsDashboard` as the Analysis composition surface, or fold its cards into Reports. Do not ship a fourth noun.
3. **One query execution path.** Backend `execute_query` is the engine. Studio Charts must not aggregate a different answer than the dashboard re-query. Prep HyperFormula stays for spreadsheet columns until those compile into the same AST or a stored derived column. Walker compute must go through org membership and the same engine.
4. **Analysis belongs in project Data.** Wire the submenu. Pass `projectId`. Fix Datasets Analyze. This is mechanical and unblocks every later unit.
5. **Maps join the question contract.** `viz_type` includes map. Live GPS or geo fields. No Accra demo in the product path.
6. **Type the question blob.** Pydantic plus TypeScript for `source_config` / `query_config` / `viz_config`. Illegal states unrepresentable. Stub "New Question" deleted.

Walker compute org-role gap is small and ships in the first coding unit.

## Consider

- Dashboard `position` / tabs / global filters. Real after the query contract exists. Not a layout-library install.
- Whether Graphic Walker remains the Explore scratchpad. Keep it until a click-query builder matches it. Do not build react-querybuilder beside it.
- DirectoryGrid stays Ops/directory. Do not reuse it as the analysis table.

## Noted

- `cache_ttl_seconds` unused.
- `/compare` unused.
- `review_status` omitted from analytics queries. Stakeholder reports will need approved-only default later.
- Three overlapping docs. Replace with one plan. Do not add a fourth living guide.
- No `AnalyticsService` tests. First coding unit adds a harness.

## Dismissed

- Syncfusion spreadsheet / AG Grid / Handsontable as the opening move. The write model is wrong. A grid library on LIVE forms makes it worse.
- Hex notebooks, Python, external DBs, question history, scheduled email. Out of this program.
- Merging Analysis and Reports into one Looker "Report" nav item. Vocab already split explore vs share. Honor that. Fix implementation.
