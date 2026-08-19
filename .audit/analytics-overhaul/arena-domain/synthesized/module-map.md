# Module map

Package `@opla/analytics-domain`. Studio screens import two session objects. Backend executes the same `Query` after the same parse.

## Public (`src/index.ts`)

- `createAnalysis`
- `parseOrgId`, `parseProjectId`, `parseLegacyQuestion`
- types those signatures need

Field-key parsers, viz bind, and pin-set helpers stay internal. `saveView` computes keep. `saveQuestion` binds viz and rejects truncated summaries. Callers do not orchestrate those steps.

## Files

```
packages/analytics-domain/src/
  index.ts
  ids.ts
  table.ts       capture | view. No upload in this program. No Form writes.
  query.ts       Query version 2, rows | summary, Expr, Predicate, Measure
  question.ts    Viz, Question. saveQuestion binds viz and rejects truncated summaries.
  board.ts       Board, Tile, TeamGrant, HubPins
  parse.ts       unknown → domain. upgradeQueryConfigV1, upgradeVizConfig internal.
  session.ts     ProjectAnalysis, OrgReports. RowPolicy applied here, not stored on Query.
```

## Retired products

| Today | Becomes |
|---|---|
| PrepTable | Analysis table panel on ProjectAnalysis |
| WalkerAnalysisLab Charts | saveQuestion from run Result |
| WalkerAnalysisLab Explore | Studio-only scratchpad. Host translates to Query or there is no save |
| SpatialAnalysisLab | map Viz |
| DashboardCanvas stub question | deleted |
| reportBuckets.ts | OrgReports |
| QuickChart client agg | deleted |
| create_derived_dataset minting Form | saveView → analytic view row |

## Tests (the lever)

`test/fixtures/legacy-saved-questions/` plus `test/parity.test.ts`. Backend pytest runs the same fixtures. A summary `run` result is what `saveQuestion` stores. Dashboard re-query equals that payload.
