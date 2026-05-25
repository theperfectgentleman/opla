# Graphic Walker Embed Plan For Opla

## Purpose

This document captures the recommended rollout plan for embedding Graphic Walker into Opla as the first real data exploration experience.

The immediate goal is not to build the final analytics platform. The immediate goal is to get a working analysis lab into Studio quickly, learn how users actually explore survey data, and then decide what Opla should extend, harden, or redesign.

## Core Recommendation

Use Graphic Walker as-is first.

Do not start with a deep fork, dashboard productization, or major backend redesign. Start with an Opla-owned shell around Walker that lets a user:

1. Pick one or more published survey form datasets
2. Load their data into a Walker session
3. Explore visually with drag-and-drop interactions
4. Validate whether the experience is good enough to become the foundation for deeper analytics work

This reduces risk and gives the team real feedback before committing to larger architectural changes.

## Technology Landscape

Opla should be aware of three closely related tools from the Kanaries ecosystem that can work together:

### Graphic Walker (Frontend)

The React component already embedded in Studio. It provides the drag-and-drop visualization canvas. Supports two computation modes:

1. **Client-side (local)**: data is loaded into the browser and all aggregation, filtering, and rendering happens in a Web Worker. Good for small-to-medium datasets.
2. **Server-side (computation prop)**: instead of passing `data`, you pass a `computation` function of type `IComputationFunction`. The frontend sends `IDataQueryPayload` workflow steps (filter, transform, aggregate, sort) and the backend returns processed rows. Good for large datasets and data-stays-on-server scenarios.

### PyGWalker (Python Backend Bridge)

A Python library (`pip install pygwalker`) that wraps Graphic Walker and provides server-side computation out of the box. Key capabilities relevant to Opla:

1. **DuckDB kernel computation**: `kernel_computation=True` routes all Walker queries through an in-process DuckDB engine. Can handle datasets up to ~100GB without loading everything into browser memory.
2. **HTML export**: `pyg.walk(df).to_html()` renders the full Walker UI as a self-contained HTML string, embeddable in any web page or iframe.
3. **Framework integrations**: built-in support for Streamlit, Gradio, Flask, Django. No official FastAPI adapter yet, but the core `to_html()` and computation APIs are framework-agnostic.
4. **External database connectors**: can push computation to Snowflake, ClickHouse, and other OLAP engines when local DuckDB is not enough.
5. **Spec persistence**: `spec="./chart_meta.json"` saves and restores Walker chart configurations.

### RunCell (AI Agent for Notebooks)

A JupyterLab extension (`pip install runcell`) that acts as an autonomous AI agent inside notebooks. Key capabilities:

1. **Context-aware code generation**: reads live notebook state including DataFrames, imports, and cell history to generate code.
2. **Autonomous execution**: can plan tasks, write code, run cells, debug errors, install packages, and retry until a goal is completed.
3. **Interactive learning mode**: explains algorithms with runnable examples.
4. **Visualization generation**: can generate PyGWalker visualizations and other charts from natural language descriptions.

## How These Tools Fit Into Opla

### Current Architecture

```
Frontend (React/Vite)          Backend (FastAPI/SQLAlchemy)
─────────────────────          ──────────────────────────
WalkerAnalysisLab.tsx  ──→     POST /analytics/query
  └─ GraphicWalker             AnalyticsService.execute_query()
     (client-side mode)           └─ SQLAlchemy → Postgres
     data={rows}
     fields={fields}
```

The current implementation loads all rows into the browser (`data` prop) and lets Walker compute everything client-side. This works but has a hard ceiling around 1000-5000 rows before the browser slows down.

### Target Architecture With PyGWalker

```
Frontend (React/Vite)          Backend (FastAPI + PyGWalker)
─────────────────────          ──────────────────────────────
WalkerAnalysisLab.tsx  ──→     POST /analytics/walker-compute
  └─ GraphicWalker             WalkerComputeService
     (server-side mode)           ├─ Translate IDataQueryPayload
     computation={fn}             ├─ PyGWalker DuckDB engine
                                  │  (kernel_computation=True)
                                  └─ Or: SQLAlchemy → Postgres
```

Instead of sending all rows to the browser, the frontend passes a `computation` function that calls a new backend endpoint. The backend translates Walker's `IDataQueryPayload` workflow steps (filter → transform → aggregate/raw → sort) into queries, executes them server-side (via DuckDB or Postgres), and returns only the result rows.

### Where RunCell Fits

RunCell is not a production component. It is a power-user and development tool that adds value in two specific scenarios:

1. **Internal data science workflow**: data scientists on the team can use RunCell inside Jupyter to explore Opla datasets with PyGWalker, experiment with chart configurations, and export working specs that get loaded into Studio.
2. **Future advanced analytics mode**: if Opla ever adds a notebook-style analytics interface for power users, RunCell provides the AI-assisted exploration layer on top of PyGWalker.

RunCell does not need to be embedded in Studio. It lives in the Jupyter environment alongside PyGWalker.

## What We Are Trying To Learn First

The first implementation should answer these questions:

1. Does Walker feel natural inside Opla Studio?
2. Do users get value from single-form exploration immediately?
3. How often do users actually need multi-form analysis?
4. Is multi-form union enough for early use cases, or do users quickly ask for true joins?
5. Is local browser-side data loading sufficient for early usage?
6. Which limitations belong in Opla to solve, and which belong in the Walker fork?
7. Does server-side computation via PyGWalker meaningfully improve the experience for medium-to-large datasets?

## Current Constraints In Opla

The current analytics backend is dataset-centric.

Relevant backend and frontend touchpoints:

1. `opla-backend/app/api/routes/analytics.py`
2. `opla-backend/app/api/schemas/analytics.py`
3. `opla-backend/app/services/analytics_service.py`
4. `opla-backend/app/models/form_dataset.py`
5. `opla-frontend/apps/studio/src/lib/api.ts`
6. `opla-frontend/apps/studio/src/components/analytics/AnalyticsHub.tsx`
7. `opla-frontend/apps/studio/src/components/analytics/types.ts`
8. `opla-frontend/apps/studio/src/components/analytics/DashboardCanvas.tsx`

Important constraint:

The current analytics query request accepts one `dataset_id` at a time. That means Opla does not yet have native multi-form analysis at the query engine level.

For the first release, multi-form exploration should be handled by:

1. Querying each selected dataset separately
2. Pulling rows into the frontend
3. Unioning the rows into a single Walker dataset in memory
4. Adding source columns so users can distinguish where each row came from

This is good enough for a first implementation and avoids premature backend complexity.

## Recommended Rollout

### Phase 0: Walker Feasibility Spike (COMPLETE)

Goal: confirm that Walker can be embedded in Studio cleanly and is viable as an exploration surface.

Status: **Done.** Walker is rendering, fields load correctly, drag-and-drop works. The MobX deduplication issue has been resolved via Vite config changes.

Exit criteria met:

1. One real published form can open in Walker ✓
2. Drag-and-drop exploration works ✓
3. Styling and layout do not create major blockers ✓
4. The team can see a credible path to a real Opla experience ✓

### Phase 1: Single-Form Analysis Lab

Goal: ship the smallest real user-facing analysis experience.

Scope:

1. Add an `Analysis Lab` entry to the analytics hub
2. Let a user select one published survey form dataset
3. Fetch a capped number of rows through the current analytics API
4. Pass the rows and mapped field metadata into Walker local mode
5. Add Opla-native loading, empty, and error states around the embedded Walker surface

User flow:

1. Open Analytics
2. Select one form
3. Click Analyze
4. Explore in Walker

Exit criteria:

1. An internal user can analyze one form end-to-end
2. The experience is understandable without extensive training
3. Performance is acceptable on small-to-medium datasets

Why this should come before multi-form work:

If one-form analysis is not valuable, multi-form support will not save the approach.

### Phase 2: Server-Side Computation Bridge (PyGWalker Integration)

Goal: remove the browser memory ceiling by moving computation to the backend.

This is where PyGWalker becomes critical. Instead of loading all rows into the frontend, the frontend switches to Walker's `computation` prop and sends query workflows to the backend.

Scope:

1. Install `pygwalker` in `opla-backend` dependencies
2. Add a new endpoint `POST /analytics/walker-compute/{dataset_id}` that accepts Walker's `IDataQueryPayload`
3. Translate `IDataQueryPayload` workflow steps into either:
   - DuckDB queries via PyGWalker's kernel computation (simplest first pass)
   - Or SQLAlchemy queries against Postgres (more integrated but more work)
4. Return computed rows to the frontend
5. Update `WalkerAnalysisLab.tsx` to use the `computation` prop instead of `data` when the dataset exceeds a size threshold (e.g., more than 500 rows)
6. Keep the `data` prop path as a fallback for small datasets (faster initial render)

Backend implementation approach:

```python
# New endpoint in analytics.py
@router.post("/walker-compute/{dataset_id}")
def walker_compute(
    org_id: uuid.UUID,
    dataset_id: uuid.UUID,
    payload: WalkerComputePayload,  # Maps to IDataQueryPayload
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1. Validate dataset access (reuse existing auth)
    # 2. Load dataset rows into a pandas DataFrame
    # 3. Use pygwalker's computation engine to process the workflow
    # 4. Return result rows
    ...
```

Frontend integration:

```typescript
// In WalkerAnalysisLab.tsx, switch based on dataset size
const computation = useCallback(async (payload: IDataQueryPayload) => {
    const response = await analyticsAPI.walkerCompute(
        orgId, datasetId, payload
    );
    return response.rows;
}, [orgId, datasetId]);

// Use computation prop for large datasets, data prop for small ones
<GraphicWalker
    computation={useServerCompute ? computation : undefined}
    data={useServerCompute ? undefined : walkerRows}
    fields={walkerFields}
/>
```

Exit criteria:

1. Datasets with 5000+ rows are usable without browser slowdown
2. The server-side query path returns correct aggregations
3. Response times are acceptable (under 2 seconds for typical queries)
4. Small datasets still use client-side mode for instant interaction

Why this phase exists:

PyGWalker's DuckDB engine handles the hard part of translating Walker's workflow payloads into efficient queries. Building this from scratch would take much longer. PyGWalker gives us server-side computation for free.

### Phase 3: Multi-Form Union Beta

Goal: support the first useful version of cross-form analysis without rewriting the backend.

Scope:

1. Allow selecting multiple published forms
2. Query each dataset separately using the existing `dataset_id`-based analytics endpoint
3. Union results in the frontend
4. Add source metadata columns such as:
   - `_source_dataset_id`
   - `_source_form_id`
   - `_source_form_title`
   - `_source_project_id`
5. Handle missing fields by setting them to `null`
6. Warn users when schemas differ significantly or when row volume is too large

Exit criteria:

1. A user can compare several survey forms in one Walker session
2. Users can filter by source form or project
3. The browser can handle the row volume safely under the chosen cap

Why this phase matters:

It validates whether a simple union model is enough for real usage before investing in joins or remote compute.

### Phase 4: Save And Reopen Analyses

Goal: preserve useful exploratory work.

Scope:

1. Save Walker specs into Opla's existing analytics asset model (SavedQuestion with `viz_type: "walker"`)
2. Support reopening and continuing an analysis
3. Store enough metadata to understand which datasets were used and how they were merged
4. Keep this separate from dashboards for now
5. Leverage PyGWalker's `spec` persistence format for compatibility

Exit criteria:

1. Users can save an analysis and reopen it later
2. Saved states survive normal usage reliably
3. The team understands what Opla must own as persistence metadata

Why this phase comes before dashboards:

Dashboards built on unstable or unsaved analysis states create unnecessary product fragility.

### Phase 5: Scale Hardening And Remote Compute

Goal: make the analysis lab reliable for larger datasets.

Scope:

1. Decide when local loading is enough, when DuckDB kernel computation is enough, and when remote computation (Postgres-native or external OLAP) is necessary
2. Optimize the PyGWalker computation bridge for common query patterns
3. Add row limits, sampling strategy, and performance protections
4. Consider connecting PyGWalker to external OLAP (Snowflake, ClickHouse) if dataset sizes grow beyond DuckDB's comfort zone

Exit criteria:

1. Larger datasets no longer depend entirely on full browser-side loading
2. Query behavior is predictable
3. The team can judge whether Walker can be the long-term exploration core

Why not earlier:

This is only worth doing after early usage proves the analysis lab has value.

### Phase 6: Dashboard Handoff

Goal: turn saved analyses into presentable assets.

Scope:

1. Add `Send to dashboard` from saved analyses
2. Keep Opla in charge of dashboard layout and composition
3. Use Walker read-only rendering where appropriate for chart cards
4. Keep dashboard UX separate from exploratory editing UX

Exit criteria:

1. Saved analyses can become dashboard cards cleanly
2. Dashboards remain Opla-native
3. Presentation does not depend on the full Walker editing shell

### Phase 7: Internal Notebook Workflow (RunCell + PyGWalker)

Goal: give the data science team a power-user exploration environment.

This is not a Studio feature. This is an internal tool for the team to use Jupyter notebooks with PyGWalker and RunCell to explore Opla data, prototype analyses, and export configurations.

Scope:

1. Set up a Jupyter environment with PyGWalker and RunCell installed
2. Create utility scripts that connect to the Opla database and load datasets as pandas DataFrames
3. Use RunCell's AI agent to help with data preparation, cleaning, and visualization
4. Export working PyGWalker chart specs that can be imported into Studio's Analysis Lab
5. Document the workflow for the team

User flow:

1. Data scientist opens Jupyter + RunCell
2. Loads an Opla dataset via utility script
3. Uses RunCell to ask questions like "show me a breakdown of responses by region"
4. RunCell generates PyGWalker code and renders the chart
5. Exports the spec and loads it into Studio's saved analyses

Exit criteria:

1. At least one team member can explore Opla data in Jupyter with PyGWalker
2. RunCell is configured and useful for code generation
3. Chart specs can round-trip between Jupyter and Studio

Why this phase exists:

RunCell + PyGWalker is the fastest way for data scientists to explore survey data with AI assistance. The exported specs feed directly into Studio's production Analysis Lab.

### Phase 8: Governance And Collaboration

Goal: make the feature safe and shareable.

Scope:

1. Add ownership and sharing scopes
2. Add audit metadata around saved analyses
3. Add comments or collaboration only after permissions are solid
4. Delay public or external sharing until internal governance is proven

Exit criteria:

1. Internal sharing is permission-safe
2. Auditability is acceptable
3. Data visibility risks are controlled

## First Implementation Scope

This is the recommended scope for the first real build.

### In Scope

1. Graphic Walker embedded in Studio (DONE)
2. One-form analysis
3. Multi-form union in browser memory
4. Published dataset selection
5. Source metadata columns
6. Row caps and warnings
7. Opla-native shell around Walker

### Coming Soon (Phase 2)

1. PyGWalker backend computation bridge
2. Server-side DuckDB query engine
3. Automatic local/server mode switching based on dataset size

### Out Of Scope (For Now)

1. Native backend joins across forms
2. Dashboard productization
3. Deep Walker fork customization
4. Collaboration features
5. Full governance layer
6. Large-scale optimization beyond basic safety limits
7. RunCell integration in Studio (stays in Jupyter)

## Recommended UX For The First Version

Create a new analytics tool card named `Analysis Lab`.

The lab should include:

1. A source picker for published survey forms
2. Support for selecting one or multiple forms
3. A clear `Analyze` action
4. A summary of selected forms and estimated row count
5. An embedded Walker canvas
6. A clear notice that this phase may use sampled or capped local data

The shell should feel Opla-native even if the Walker internals remain mostly stock.

## Data Strategy

### Phase 1: Local Data Mode

Why:

1. It is the simplest integration path
2. It avoids solving remote computation too early
3. It allows multi-form union without backend redesign

Behavior:

1. Load up to a capped number of rows per dataset (default 250, max 1000)
2. Normalize field names into a unioned schema
3. Fill absent fields with `null`
4. Add source metadata columns
5. Feed the merged result into Walker

### Phase 2: Server-Side Computation Mode (PyGWalker)

Why:

1. Removes the browser memory ceiling
2. Keeps sensitive data on the server
3. PyGWalker's DuckDB engine handles query translation automatically

Behavior:

1. Frontend sends `IDataQueryPayload` to backend via `computation` prop
2. Backend loads dataset into DuckDB (or queries Postgres directly)
3. PyGWalker processes the workflow steps (filter → transform → aggregate → sort)
4. Only result rows are sent to the browser
5. No row cap needed since computation happens server-side

Transition logic:

```
if dataset.record_count <= 500:
    use client-side mode (data prop) for instant interaction
else:
    use server-side mode (computation prop) via PyGWalker
```

## Guardrails

The first version should be honest about limits.

Recommended guardrails:

1. Soft cap total rows loaded into the browser (Phase 1)
2. Warn when multiple forms exceed the cap
3. Block very large selections instead of silently degrading
4. Surface a message that this is an exploration lab or beta
5. Keep initial usage focused on small-to-medium datasets
6. Phase 2 removes most guardrails by moving computation server-side

## File Touchpoints For The First Build

### Frontend files to add or modify:

1. `opla-frontend/apps/studio/package.json`
2. `opla-frontend/apps/studio/vite.config.ts`
3. `opla-frontend/apps/studio/src/components/analytics/AnalyticsHub.tsx`
4. `opla-frontend/apps/studio/src/lib/api.ts`
5. `opla-frontend/apps/studio/src/components/analytics/types.ts`
6. `opla-frontend/apps/studio/src/components/analytics/WalkerAnalysisLab.tsx`
7. `opla-frontend/apps/studio/src/components/analytics/WalkerSourcePicker.tsx`
8. `opla-frontend/apps/studio/src/components/analytics/walkerAdapters.ts`

### Backend files reused initially without major change:

1. `opla-backend/app/api/routes/analytics.py`
2. `opla-backend/app/api/schemas/analytics.py`
3. `opla-backend/app/services/analytics_service.py`
4. `opla-backend/app/models/form_dataset.py`

### Backend files to add for Phase 2 (PyGWalker computation bridge):

1. `opla-backend/app/api/routes/walker_compute.py` (new endpoint)
2. `opla-backend/app/api/schemas/walker_compute.py` (IDataQueryPayload models)
3. `opla-backend/app/services/walker_compute_service.py` (PyGWalker DuckDB bridge)
4. `opla-backend/requirements.txt` (add `pygwalker`, `duckdb`)

### Jupyter environment for Phase 7 (RunCell + PyGWalker):

1. `opla-notebooks/requirements.txt` (pygwalker, runcell, pandas, jupyter)
2. `opla-notebooks/utils/opla_dataset_loader.py` (utility to load Opla datasets)
3. `opla-notebooks/examples/exploration_demo.ipynb` (example notebook)

## PyGWalker IDataQueryPayload Reference

This is the workflow payload that Walker sends to the backend when using server-side computation. The backend must translate these into actual queries.

```typescript
interface IDataQueryPayload {
    workflow: IDataQueryWorkflowStep[];
    tag?: string;
    limit?: number;
    offset?: number;
}

// Steps are applied in order:
type IDataQueryWorkflowStep =
    | IFilterWorkflowStep    // WHERE clauses
    | ITransformWorkflowStep // Computed fields
    | IViewWorkflowStep      // SELECT / GROUP BY / aggregate
    | ISortWorkflowStep;     // ORDER BY

// View step contains the core query logic:
type IViewQuery =
    | IAggQuery    // GROUP BY + aggregates (sum, count, mean, etc.)
    | IFoldQuery   // Unpivot / melt
    | IBinQuery    // Binning numeric columns
    | IRawQuery;   // Plain SELECT
```

Mapping to Opla's existing `AnalyticsService.execute_query`:

| Walker concept | Opla equivalent |
|---|---|
| `IFilterWorkflowStep.filters` | `AnalyticsQueryRequest.filters` |
| `IAggQuery.groupBy` | `AnalyticsQueryRequest.group_by` |
| `IAggQuery.measures` | `AnalyticsQueryRequest.aggregates` |
| `IRawQuery.fields` | `AnalyticsQueryRequest.select_fields` |
| `ISortWorkflowStep.sort + by` | `AnalyticsQueryRequest.order_by` |

The existing `AnalyticsService` already covers most of what Walker needs. PyGWalker's DuckDB engine handles the rest (binning, folding, computed fields) automatically.

## Open Questions To Answer During Implementation

1. Is Walker's stock UI acceptable enough for the first release?
2. Do users mostly analyze one form or multiple forms?
3. Does union satisfy early cross-form needs?
4. How large are typical datasets in practice?
5. Which field types need better inference before the experience feels trustworthy?
6. What should Opla own versus what should stay inside Walker?
7. Is PyGWalker's DuckDB engine fast enough for Opla's typical query patterns?
8. Should the PyGWalker computation bridge use DuckDB or translate directly to Postgres SQL?
9. Is RunCell useful enough for the team to justify setting up a Jupyter environment?

## Go / No-Go Gates

After Phase 1:

Proceed only if single-form analysis is clearly useful.

After Phase 2:

Proceed only if server-side computation meaningfully improves the experience and PyGWalker integration is stable.

After Phase 3:

Proceed only if users demonstrate real value from multi-form exploration and the union model is workable.

After Phase 5:

Proceed to larger productization only if performance and usability remain acceptable at scale.

## Immediate Next Steps

When implementation continues, the recommended order is:

1. ~~Install Graphic Walker into the Studio app~~ ✓
2. ~~Add a hidden feasibility route or internal lab entry~~ ✓
3. ~~Load one published dataset into Walker local mode~~ ✓
4. Add the visible `Analysis Lab` card in the analytics hub (Phase 1 polish)
5. Install PyGWalker in the backend and build the computation bridge (Phase 2)
6. Extend the lab to multi-form union (Phase 3)
7. Set up Jupyter + RunCell environment for the data team (Phase 7, can happen in parallel)
8. Gather usage feedback before designing deeper extensions

## Bottom Line

The best first move is not to build the final analytics system.

The best first move is to ship a clear, limited, usable `Analysis Lab` powered by Graphic Walker, learn from real exploration behavior, and then use those findings to decide what Opla should extend.

PyGWalker unlocks the next level by providing server-side computation via DuckDB without Opla having to build a query translation layer from scratch. The existing `AnalyticsService` query model already maps closely to Walker's `IDataQueryPayload`, making the integration natural.

RunCell adds value as a power-user tool for the data team, not as a production feature. It helps data scientists explore Opla data with AI assistance in Jupyter and export working configurations into Studio.