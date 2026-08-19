# Verify

Screened against the arena rubric and architect design-red-flags after grafting.

## Rubric

1. **Table is not a Form.** Capture has `formId`. View has `parent` plus compiled columns. No snapshot. No upload in this program. Pass.
2. **One executable query.** `Query` is `rows | summary` with `version: 2`. `saveQuestion` consumes `Result`. Truncation is rejected inside that method. Pass.
3. **Viz contract.** table, chart, map, kpi. Markdown is a tile. Walker has no type. Chart `y` is `MetricAlias`. Pass.
4. **Nav split.** Two session objects. Reports carry team grants and `draft | published | archived`. Pass.
5. **Interface depth.** Public imports are `createAnalysis`, two id parsers, and `parseLegacyQuestion`. `saveView` computes keep. `saveQuestion` binds viz. Pass, with residue below.
6. **Migration.** `parseLegacyQuestion` plus internal `upgradeQueryConfigV1`. Reject codes include `legacy_v1` and `walker_not_supported`. No dual-write. Pass.

## Design red flags

- **Shallow module.** Call site 1 is compile then saveView. Call site 2 is run then saveQuestion. Callers do not orchestrate parse, bind, and pin helpers.
- **Information leakage.** `AnalysisOp` is the host adapter type, not a screen import. Wire JSON is not re-exported.
- **Temporal decomposition.** Parse, bind, and row policy live on the session, not as a public load/validate/save pipeline.
- **Pass-through.** `pin` adds HubPins cardinality. `publish` adds status. Neither is a bare forward.

## Usage vs types

usage.md call sites typecheck against types.ts. No `as`. No helper zoo. `version: 2` is on both Query arms.

## Remaining residue (accepted)

- Map `point` is still `FieldKey`. Geo-ness is checked inside `saveQuestion`, not by a branded key on the schema. Chart `y` is the structural analog; maps stay one check behind.
- Scatter axes are `FieldKey | MetricAlias`, so a nonsense pairing still compiles until bind.
- `Row.values` is string-keyed. Schema-shaped rows would couple Result to one table snapshot.
- `AnalysisOp.write_question` still carries `query` plus `viz`. The session extracts those from `Result`. A host that calls the op directly can skip the Result gate. Studio must not.

## Dual query language

None. v1 enters only through `parseLegacyQuestion`. execute_query after the gate reads Query v2.
