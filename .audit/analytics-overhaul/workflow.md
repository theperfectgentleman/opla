# Workflow

Designed after the synthesized domain. Each unit is independently landable. Verify on Studio (control-ui) or pytest, not compile-only.

## Units (riskiest unknown first after scaffold)

1. **Scaffold `@opla/analytics-domain`.** Types from synthesized/types.ts. Parse fixtures. No Studio wiring. Verify: vitest parse rejects walker and mixed rows+summary.
2. **`execute_query` speaks Query v2.** Pytest fixtures shared with the TS package. Verify: a summary run stores the same JSON the dashboard would send.
3. **Nav.** Project Data → Analysis. Pass projectId. Fix Datasets Analyze URL. Hide Accra Spatial as the product. Labels: Table, Chart, Map. Verify: click Data → Analysis in a project without a typed URL.
4. **Walker compute org membership.** Same `get_user_org_role` as the rest of analytics. HTTP errors, not 200+success false. Verify: other-org dataset_id is 403.
5. **saveView, not LIVE forms.** New analytic view row. Stop create_derived_dataset Form mint. Verify: Design form list has no new prep-* slug after save.
6. **saveQuestion from Result.** Delete QuickChart client aggregation and the stub New Question composer. Verify: builder number equals dashboard number on one chart.
7. **Org Reports persistence.** Replace reportBuckets localStorage. Team grants on the server. Verify: second browser session sees the board.
8. **Map Viz** on live geo_point. Delete SpatialAnalysisLab demo path. Verify: a GPS capture field plots, Accra demo is gone.
9. **Hub pins** as HubPins (max 4). Walker and markdown cannot pin.
10. **Approved-only** on OrgReports.runQuestion. Default off for Analysis.

Competing docs (`ANALYTICS_MODULE_DEV_GUIDE.md`, `DATA_ANALYSIS_PLATFORM_PLAN.md`, `GRAPHIC_WALKER_EMBED_PLAN.md`) are superseded by this folder. Do not add a fourth living guide. Point them at synthesized/rationale.md in a later unit.

## Shared mutable state

Studio analytics UI, backend analytics_service, and the new package. One writer per unit. Nav (3) and Walker auth (4) can run after 1 lands, in parallel with 2. 5 depends on 1. 6 depends on 2. 7 depends on 6. 8 depends on 6.

## First coding branch

Do not mix with the in-progress form-runtime working tree. Branch from main (or a clean commit) as `analysis-domain`.
