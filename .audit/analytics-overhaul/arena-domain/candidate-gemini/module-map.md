# Candidate Gemini Module Map

```
c:\Users\kings\DevProjects\opla\.audit\analytics-overhaul\arena-domain\candidate-gemini\
├── usage.md           # Realistic call sites demonstrating caller experience FIRST
├── types.ts           # Strict TypeScript AST and domain model with illegal states unrepresentable
├── module-map.md      # System boundaries, ownership, and component relationships (this file)
└── rationale.md       # Architect rationale and design decisions
```

---

## Domain Boundaries & Layering

The Candidate Gemini domain structure enforces a strict separation between **Capture/Design** and **Analytics/Reporting**, respecting the locked product vocabulary.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Studio Frontend Shell                             │
├──────────────────────────────┬──────────────────────────────────────────────┤
│  Data -> Analysis (Explore)  │          Org Reports (Stakeholder)           │
│  - Grid View (Prep)          │  - Multi-project composition                │
│  - Chart / Map / KPI Views   │  - Team Grants (Viewer / Explorer)            │
│  - Walker Scratchpad         │  - Server-persisted (OrgReport model)        │
└──────────────┬───────────────┴──────────────────────┬───────────────────────┘
               │                                      │
               └──────────────────┬───────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Analytics Domain Boundary (types.ts)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Datasets Engine                                                         │
│     - Prep Derived Tables (FormDataset metadata, NO LIVE Form created)     │
│     - Server-side AST evaluation for HyperFormula derived columns           │
│                                                                             │
│  2. Unified Query Engine (execute_query)                                   │
│     - Single AST for Table / Chart / Map / KPI / Dashboard re-query        │
│     - Applies review_status filter by default                               │
│     - GPS/Geo field spatial queries for Live Leaflet rendering              │
│                                                                             │
│  3. Persisted Artifacts                                                     │
│     - SavedQuestion (Typed source_config, query_config, viz_config)         │
│     - AnalyticsDashboard (DashboardCard -> SavedQuestion)                   │
│     - OrgReport (Org-level stakeholder board with Team grants)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Target Component Refactoring Map

To implement Candidate Gemini, current repository files will be migrated or retired as follows:

| Current File / Component | Proposed Status | Responsibility in Candidate Gemini |
| :--- | :--- | :--- |
| `opla-backend/app/services/analytics_service.py` | **Refactor Core** | Implement single `execute_query` AST parser/runner; update `create_derived_dataset` to stop creating `Form(status=LIVE)`. |
| `opla-backend/app/models/analytics.py` | **Extend Model** | Add `OrgReport` model & `org_reports` migration table; deprecate `reportBuckets.ts` localStorage. |
| `opla-frontend/apps/studio/src/components/analytics/PrepTable.tsx` | **Refactor View** | Render as "Table View" inside `Data -> Analysis`. Submit prep formulas to server as `StoredDerivedColumn`. |
| `opla-frontend/apps/studio/src/components/analytics/SpatialAnalysisLab.tsx` | **Refactor View** | Render as "Map View" inside `Data -> Analysis`. Replaced demo Accra data with live GPS fields from query AST. |
| `opla-frontend/apps/studio/src/components/analytics/WalkerAnalysisLab.tsx` | **Refactor View** | Keep as "Explore View" (scratchpad). Dashboards render native ECharts/Leaflet, not Walker. |
| `opla-frontend/apps/studio/src/lib/reportBuckets.ts` | **DELETE** | Replaced by server-persisted `OrgReport` API endpoints. |
