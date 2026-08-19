# Module map

The public surface is one `@opla/analytics` entrypoint. Internal modules are organized by ownership, not by UI phase names such as Lab, Prep, Spatial, or Dashboard.

```text
packages/analytics/
  src/
    index.ts
      Public exports. Re-exports constructors, domain types, parsers, and service signatures.
    domain.ts
      DatasetSource, DatasetSchema, QueryAst, expressions, metrics, filters, views, questions, dashboards, Reports.
      No transport, ORM, React, Graphic Walker, or Leaflet imports.
    constructors.ts
      Branded identifiers, field and metric constructors, query and view builders.
      Produces only shapes accepted by domain.ts.
    validation.ts
      Boundary parsers for saved_questions JSON, source metadata, query JSON, and viz JSON.
      Rejects unknown viz types and legacy shapes that cannot be mapped exactly.
    compiler.ts
      Validates a QueryAst against DatasetSchema and emits the backend execute_query request.
      Validates map location types and metric references.
    executor.ts
      Small client-facing adapter for the one POST execute_query path.
      Never performs chart aggregation.
    question-store.ts
      Save, load, update, and archive SavedQuestion records.
      Legacy JSON migration is a one-time parse or explicit rejection.
    derived-tables.ts
      Creates and reruns DerivedTable definitions.
      Persists analytics table metadata, never Form or FormDataset records.
    analysis.ts
      Project Data → Analysis orchestration for previews, saved questions, and Analysis dashboards.
    reports.ts
      Org Report boards, question placements, and Team grants.
      Owns server persistence. No localStorage bucket.
    render-contract.ts
      Converts QueryResult plus PersistedView into render props for Opla table, chart, map, KPI, and markdown components.
    walker-adapter.ts
      Ephemeral Explore scratchpad adapter.
      Supplies a query and computation callback through executor.ts. Walker output is not a PersistedView.
```

## Backend ownership

`app/services/analytics_service.py` remains the only query executor. Its request schema is generated or kept in lockstep with `QueryAst`, and its response is the source for both Studio previews and dashboard renders.

`SavedQuestion` stores parsed `source_config`, `query_config`, and `viz_config` JSON at the persistence boundary. The application handles typed `QuestionDraft` and `SavedQuestion` values after parsing.

The existing `SavedQuestion` row can remain the storage envelope during migration. Existing rows are parsed into the new contract. A row that contains `goal`, `walker`, malformed filters, or an incompatible legacy shape is rejected with a repair status. It is not silently widened with `unknown`.

The derived-table persistence model is a new analytics table identity. It has a parent dataset reference and a re-runnable `DerivedTableDefinition`. It is not a `Form`, is not published, and does not enter the Design form catalog.

Reports get one server-backed org board model with Team grants. Analysis dashboards remain project-scoped composition surfaces. Both reference the same `QuestionId` and never copy query JSON into cards.

## Dependency direction

```text
boundary adapters → validation → domain
Studio views ───────→ render-contract → domain
query transport ────→ compiler/executor → domain
question/report stores → domain
walker adapter ─────→ executor → domain
```

The domain package does not import application frameworks. React, ECharts, Leaflet, Graphic Walker, SQLAlchemy, and Pydantic stay at adapters.
