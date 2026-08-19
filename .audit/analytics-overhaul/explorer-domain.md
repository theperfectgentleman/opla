# Explorer: domain model, persistence, APIs

Source: how-explorer domain slice. Read-only. 2026-08-19.

## First-class persisted objects

- `SavedQuestion` (`saved_questions`): the hub artifact. JSONB source/query/viz. viz_type `table|chart|walker|kpi|goal|markdown`.
- `AnalyticsDashboard` + `DashboardCard`: cards require a question. Replace-all on PATCH. Card IDs churn.
- `ProjectPinnedAnalytics`: max 4, viz `chart|kpi|goal|table`. Walker/markdown cannot pin.
- `ProjectReport`: JSONB canvas, status, accessors. Real API. `report.view` unused; uses `project.view`/`project.edit`.
- `FormDataset` + `Submission.data` JSONB: the actual warehouse. No OLAP store.

## Not persisted

Prep working grid (`sessionStorage` handoff, `localStorage` widths). Org report boards (`opla_report_buckets_v1_*`). Spatial queries. Dashboard cross-filter / global filters. Query cache (`cache_ttl_seconds` stored, never read).

## Query engine facts

- `AnalyticsService.execute_query`: one dataset, filters combinator/rules, group_by + date_trunc, aggs, calculated_fields AST.
- Values read as JSONB text then cast Float for numeric ops.
- No `review_status` filter. Rejected submissions included.
- Linked derived datasets drop `calculated_fields` (formulas client-side in Prep).
- `POST /compare` exists. No Studio caller.
- Walker compute at `POST /analytics/walker/{dataset_id}/compute`: JWT only, no org-membership check. Ignores transform steps. HTTP 200 even on failure.

## Prep persistence

`POST /derived-datasets` creates a LIVE Form + FormDataset. Snapshot writes Submission rows. Linked stores formulas and queries parent. Pollutes form catalog (`prep-*` slugs).

## Sharing

No share token, public dashboard URL, or analytics collection table. `025_project_collection` is field-ops windows, not Metabase collections. Org report grants are localStorage. Permissions `analysis.view` / `analysis.export` are catalog-only; analytics routes use org membership.

## Broken / dead

- CSV upload constructs Form/Submission columns that do not exist. Hub also passes `projectId={undefined}` so the button is disabled.
- Analysis UI is org-mounted (`Dashboard.tsx` `projectId={undefined}`). Project Data → Analysis is a stub.
- Walker save from org hub omits `project_id`. Project-scoped question lists then drop those org-wide questions; Hub merges both lists.

## Tests

No automated tests for `AnalyticsService` / analytics routes.
