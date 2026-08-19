# Explorer: dashboards, queries, reports vs analytics

Source: how-explorer dashboards slice. Read-only. 2026-08-19.

## Working path

Lab Charts (QuickChart) → Save `viz_type=chart` → pin on Hub and/or add to analytics dashboard → Viewer re-queries, click drill, cross-filter.

## Metabase gap (short)

- Query builder filters: engine yes, Studio Data Explorer / react-querybuilder absent. Lab load sends no filters.
- Joins: absent. One `dataset_id`.
- Custom expressions: server `+ - * /` AST; `analyticsAPI.runQuery` omits `calculated_fields`. Prep formulas are client-side.
- Multi-level aggregation: `group_by` list exists; viewer uses only `group_by[0]`.
- Preview: Lab ≤2000 rows (25 if large). No QB pane.
- Question history: absent.
- Interactive dashboards: partial. Cross-filter real. `position` unused. Walker cards placeholder. Tabs unread (`layout_config: []`).
- Drill-through: chart click only. Filter dashboard or raw rows + CSV.
- Dashboard filters: region select is dummy. Cross-filter works.
- Documents: project report canvas (API) vs org boards (localStorage). Not the same as dashboards. AI stub. No PDF.
- Scheduled share / email: absent.
- Collections: absent.

## Structural problems

- Dashboard New Question is a stub (first 6 fields, no filters/aggs). Real questions come from Lab.
- KPI/goal/markdown types exist; composers do not. Goal target defaults to 1000. KPI never gets `previousValue`. `comparePeriod` unused.
- `DashboardCard.question_id` NOT NULL so markdown is a fake question.
- Analysis orphaned in nav: project submenu unwired; org Data not in org sidebar. Datasets Analyze URL likely drops `section=analysis`.
- Two Reports: `project_reports` live; org Reports localStorage mock.
- CSV upload hardcoded to `http://localhost:8000`.
- Docs still list DataExplorer / ChartBuilder / Pivot / Spreadsheet. Files gone.

## Key files

- `opla-frontend/apps/studio/src/components/analytics/{AnalyticsHub,WalkerAnalysisLab,QuickChart,DashboardCanvas,DashboardViewer}.tsx`
- `opla-backend/app/{models,services,api/routes}/analytics*`
- `opla-frontend/apps/studio/src/lib/reportBuckets.ts`
- `opla-frontend/apps/studio/src/pages/{Dashboard,ProjectWorkspace,ReportBoard,ReportDetail}.tsx`
