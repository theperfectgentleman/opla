# Opla Data Analysis Platform — Design & Implementation Plan

> **Inspired by:** [Hex](https://hex.tech) (data notebooks → apps), [Metabase](https://www.metabase.com) (self-service BI), and [Tableau](https://www.tableau.com/) (visual analytics & storytelling)
> **Target users:** Marketing, sales, consumer research teams — NOT data scientists
> **Focus:** Powerful but approachable, sleek and modern UI, data storytelling.
> **Updated:** 2026-07-06

---

## 1. What We Already Have

The codebase already has strong foundations for a data analysis platform:

| Layer | What Exists | Location |
|-------|------------|----------|
| **Data Sources** | `FormDataset` — structured datasets auto-generated from forms with versioned schemas & typed fields | `app/models/form_dataset.py` |
| **Query Engine** | `AnalyticsService` — supports SELECT, WHERE, GROUP BY, aggregates, ORDER BY, pagination | `app/services/analytics_service.py` |
| **Saved Questions** | `SavedQuestion` model — persists query config + viz config as reusable named analyses | `app/models/analytics.py` |
| **Dashboards** | `AnalyticsDashboard` + `DashboardCard` — grid layout with question references | `app/models/analytics.py` |
| **API** | Full CRUD routes for sources, queries, questions, dashboards | `app/api/routes/analytics.py` |
| **Frontend Tools** | AnalyticsHub, WalkerAnalysisLab, DataExplorer, ChartBuilder, DashboardCanvas, Pivot, Spreadsheet | `apps/studio/src/components/analytics/` |

**Bottom line: We're not starting from scratch.** The backend query engine is genuinely capable, and we have working prototypes of 6 different analysis tools.

---

## 2. Research: Hex vs. Metabase vs. Tableau vs. What Opla Needs

### Why Metabase is the core structural model
| Aspect | Hex | Metabase | Tableau | **Opla Should…** |
|--------|-----|----------|---------|-------------------|
| **Core Metaphor** | Notebook → App | Question → Dashboard | Workbook → Story/Dashboard | **Question → Dashboard/App** — with rich text for context |
| **Query Interface** | SQL/Python cells | Visual query builder | Drag & drop shelves | **Visual query builder** — drag & drop field mapping |
| **Visualizations** | Notebook charts | KPI cards, standard charts | Infinite grammar of graphics | **KPI cards first**, modern interactive charts with visual encoding |
| **Sharing** | Interactive Apps | Dashboards + drill-through | Published Workbooks | **Dashboards + Tabs + Cross-Filtering** |
| **Target User** | Data scientists | Business users | Analysts | **Business users** |

### What to borrow from Tableau
*   **Visual Encoding (Color/Size):** Don't just pick X and Y. Allow users to drag a dimension to "Color" to split a bar chart into a stacked bar, or a measure to "Size" for scatter plots.
*   **Cross-Filtering:** The most intuitive way to explore. Clicking a bar for "April" in Chart A should seamlessly filter Chart B and Chart C to "April" without needing to open a dropdown.
*   **Simple Calculated Fields:** Users will inevitably need derived metrics (e.g., `[Revenue] / [Clicks]`). We need basic math (`+`, `-`, `*`, `/`) between columns.

### What to borrow from Hex
*   **Data Storytelling (Rich Text Cells):** Dashboards shouldn't just be walls of charts. Hex lets you mix markdown/text cells alongside charts to provide context, explain findings, and guide the reader. We must include "Rich Text/Markdown Cards" in our dashboard canvas.
*   **Reactive UI:** When a user changes a global parameter/filter, the update should feel instantaneous and smooth, with loading states on the individual cards.

### What to borrow from Metabase
*   **KPI Cards with Trend Comparison:** Big numbers with ↑/↓ vs. previous period.
*   **Goal Tracking (Progress Bars):** Horizontal bars showing current vs. target.
*   **Drill-Through (Click to Explore):** Clicking into aggregates to see raw rows.

### What NOT to borrow
*   **Python/SQL notebooks:** Our users don't code.
*   **Complex Data Joining:** For v1, joining across multiple datasets is too complex for non-technical users. We'll rely on CSV uploads and single-source analysis first.
*   **Git-style version control:** Over-engineering. Save/duplicate is enough.

---

## 3. UI/UX Principles for a "Sleek" Experience

To compete visually with modern tools, Opla's analytics cannot look like a standard admin dashboard. It must feel premium.

1.  **Modern Charting Library:** Use a library like Apache ECharts, Visx, or Tremor (with custom wrappers). Charts must have smooth render animations and interactive hover effects.
2.  **Curated Aesthetics:**
    *   **Color Palettes:** No default categorical colors (pure red, blue, green). Use harmonious, tailored HSL color palettes (e.g., sleek monochromatic gradients or soft categorical colors).
    *   **Typography:** Large, readable fonts for KPIs (e.g., Inter, Outfit).
    *   **Glassmorphism & Shadows:** Subtle drop shadows for cards, blurred backgrounds for tooltips and drill-through modals.
3.  **Empty States & Skeleton Loaders:** Shimmering skeleton loaders when a query is running. Beautiful empty states that guide the user to their first action.
4.  **Dark Mode:** Analytics tools look especially premium in dark mode. The charting engine must seamlessly support dynamic theme switching.

---

## 4. Architecture — The "Question → App" Model

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA SOURCES                           │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │ 📋 Form Submissions │   │ 📤 CSV/Excel Uploads       │  │
│  └──────────┬──────────┘   └──────────────┬──────────────┘  │
└─────────────┼──────────────────────────────┼────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ASK A QUESTION (Power Users)                    │
│                                                             │
│  1. Pick Data    → select a FormDataset or CSV              │
│  2. Filter       → visual filter rows                       │
│  3. Calculate    → define basic math fields (A / B)         │
│  4. Summarize    → aggregate function + group-by            │
│  5. Visualize    → map fields to X, Y, Color, Size          │
│                                                             │
│  💾 Save as "Question" (reusable, named analysis)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│             BUILD A DATA APP (Power Users)                   │
│                                                             │
│  📋 Drag saved questions & Text Blocks onto a grid canvas   │
│  📝 Add markdown blocks to explain the data (Storytelling)  │
│  🎛️ Add global filters (date range, dropdowns)              │
│  🎯 Configure KPI cards with goals and trend comparison     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               EXPLORE (Consumers)                            │
│                                                             │
│  🌐 Published App — read-only, interactive, sleek design    │
│  🔗 Cross-Filtering — click a chart to filter others        │
│  🔎 Drill-Through — right-click/popover to see raw data     │
│  📥 Export — PNG, CSV, PDF                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Phases

### Phase 1: The "Sleek" Foundation & KPIs ⭐ Highest Visual Impact

**Backend (`analytics_service.py`):**
*   Add `date_trunc` support (week, month, quarter, year).
*   Add "compare to previous period" option (compute delta percentage).

**Frontend (UI/UX overhaul):**
*   Integrate a premium charting library (e.g., ECharts or Visx) with a custom sleek theme.
*   `KPICard` — Big number, period label, trend arrow (↑/↓), % change, color coding (green/red/neutral).
*   `GoalCard` — Horizontal progress bar.
*   `RichTextCard` — Markdown editor card for dashboard storytelling.
*   Wire into `DashboardCanvas`.

**Estimated effort:** ~4-5 days

### Phase 2: Tableau-style Visual Query Builder

**Changes:**
*   Redesign `WalkerAnalysisLab` into a drag-and-drop shelf interface (like Tableau).
*   Field list on the left, drop zones on the right: **Filters, X-Axis, Y-Axis, Color (Group By), Size**.
*   **Simple Calculated Fields:** UI to add a new column defined by basic math operations on existing fields (e.g., `price * quantity`). Backend compiles this into SQL expressions.
*   Date bucketing (Group by Month/Quarter).
*   Auto-suggest visualization based on dropped fields.

**Estimated effort:** ~6-8 days

### Phase 3: Interactive Data Apps (Dashboards)

**Changes:**
*   Add tabs to `layout_config` in `AnalyticsDashboard` model.
*   Dashboard-level filter widgets (Date range, Dropdowns).
*   **Cross-filtering engine:** When enabled, clicking an element (e.g., a pie slice) dispatches a filter to the dashboard state, instantly re-rendering other connected cards.
*   Responsive masonry or grid layout with smooth transitions.

**Estimated effort:** ~4-5 days

### Phase 4: Drill-Through & CSV Upload

**Frontend & Backend:**
*   Click chart element → popover options: "Zoom in", "View raw data", "Break down by".
*   Modal data table with search, sort, and CSV export.
*   CSV Upload: Auto-detect schema, import to PostgreSQL as a queryable dataset, creating an instant semantic model.

**Estimated effort:** ~4-6 days

---

## 6. What's NOT Worth Building (Yet)

| Feature | Reason |
|---------|--------|
| External DB connections | CSV upload covers 80% of external data needs for this persona. |
| Complex Joins | Blending multiple forms/datasets is UX nightmare for v1. |
| Code Execution | Python/SQL notebooks are the wrong abstraction for business users. |
| AI Generation | Focus on getting the visual builder right first before adding Metabot/Magic features. |

---

## 7. Open Design Questions

1.  **Cross-Filtering vs. Global Filters:** Should cross-filtering be implicit (Tableau style: click a chart, everything filters) or explicit (user must wire Chart A to filter Chart B)? Implicit is more magical but can lead to confusing states.
2.  **Calculated Fields Storage:** Do we save a calculated field to the `FormDataset` (so everyone can use it) or to the specific `SavedQuestion` (scoped only to that chart)?
3.  **CSV Scope:** Should uploaded CSVs be org-scoped or project-scoped?

---

## 8. Success Criteria

*   [ ] A marketing manager can build a campaign report with charts and text explanations in under 10 minutes.
*   [ ] The UI elicits a "wow" response from users accustomed to basic internal admin panels.
*   [ ] Dashboards are highly interactive (cross-filtering, tooltips, drill-through) without requiring setup.
*   [ ] KPI cards clearly indicate business health (trends vs previous periods).

---

## 9. File References

| File | Purpose |
|------|---------|
| `opla-backend/app/models/analytics.py` | SavedQuestion, AnalyticsDashboard, DashboardCard models |
| `opla-backend/app/models/form_dataset.py` | FormDataset, FormDatasetField — the data source layer |
| `opla-backend/app/services/analytics_service.py` | Query engine — WHERE, GROUP BY, aggregates, expressions |
| `opla-frontend/apps/studio/src/components/analytics/` | All frontend analysis components |
