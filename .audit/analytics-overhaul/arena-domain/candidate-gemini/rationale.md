# Candidate Gemini Rationale

## Problem
Opla's existing analytics architecture suffers from structural disconnects:
1. **Prep-derived tables write into Design:** Saving a transformed grid creates a `Form` with `status=LIVE`, polluting the form catalog with `prep-*` forms.
2. **Dual report models:** Org reports live in browser `localStorage` (`reportBuckets.ts`), while project reports live in the backend database.
3. **Disjointed query execution:** Studio charts aggregate rows locally while dashboards re-query the backend, causing visualization drift.
4. **Isolated spatial demo:** Map analysis uses static demo JSON rather than live dataset GPS fields.
5. **Orphaned navigation:** Analysis submenus are unhooked, and `projectId` context is omitted.

## Usage
The caller experience centers around **Data -> Analysis** (for exploration within projects) and **Reports** (for stakeholder sharing across the organization).
All querying, visualization, dashboarding, and report rendering funnel through a single typed `AnalyticsQueryRequest` AST consumed by `domain.executeQuery()`. Callers construct queries or save questions without needing to know storage specifics or risk client-server data mismatch.

## Shape
Candidate Gemini enforces strict domain boundaries:
- **`AnalyticsSource` & `DerivedTable`**: Prep tables generate `FormDataset` records with `kind="derived"`, explicitly decoupled from `Form` creation.
- **`AnalyticsQueryRequest`**: A unified JSON AST specifying select fields, filter groups, date-bucketed `group_by`, aggregates, and ordering.
- **`VizConfig` Discriminated Union**: Type-safe discriminated union (`table | chart | map | kpi | goal | markdown`) ensuring invalid visualization properties are unrepresentable at compile time.
- **`OrgReport`**: Server-persisted stakeholder board with `TeamGrant` access control (`viewer`, `commenter`, `explorer`, `owner`), replacing client `localStorage`.

## Tradeoffs
- **Refusing embedded Walker in Dashboards**: Graphic Walker remains an interactive scratchpad in Lab/Explore, but dashboards render Opla native ECharts and Leaflet views. This avoids embedding heavy Walker state inside dashboard card payloads.
- **Requiring Server Compilation for Derived Columns**: HyperFormula is retained in the browser UI for instant feedback during spreadsheet editing, but derived columns are stored as formula AST specs that the server executes during `execute_query`.

## Alternatives Considered
- **Keeping `prep-*` Forms as Datasets**: Rejected because users saw temporary analysis grids appearing as active collection forms under Design.
- **Merging Analysis and Reports into a Single "Looker" View**: Rejected because Opla's locked product vocabulary explicitly separates Analysis (project-scoped exploration) from Reports (org-scoped stakeholder sharing).

## Open Questions
- Should `review_status` filtering be explicitly toggleable on a per-question basis, or globally forced to `APPROVED` for all org reports? (Recommendation: Default to `APPROVED` on server `execute_query` with an optional override flag in `query_config`).

## Next Implementation Step
1. Update `AnalyticsService.create_derived_dataset` in `opla-backend/app/services/analytics_service.py` to bypass `Form` creation and mint `FormDataset` entries directly.
2. Create database migration `032_org_reports.py` to add the `org_reports` table.

## Synthesis Decision
parent will fill
