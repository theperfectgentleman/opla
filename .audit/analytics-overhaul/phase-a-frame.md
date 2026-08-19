# Phase A frame

## Done predicate

A teammate who is not the author can, on a real project with GPS capture:

1. Open **Data → Analysis** from the project shell (no hand-typed URL).
2. Open a dataset as a **table**, sort, filter, add a calculated column, and save. The save does not appear under Design as a form.
3. Summarize that table (filter, group, metric) on the server, visualize, save, pin on Hub, and place on an Analysis dashboard. The dashboard number matches the builder number.
4. Place a **map** of live GPS or geo fields on that dashboard.
5. Put the same charts on an org **Report**. A second org member opens it from Reports. It is not in the author's localStorage.

Falsify any line and the program is not done.

## Out of scope

Scheduled email, question revision history, SQL editor, external databases, Python, Syncfusion/pivot, 3D/Kepler/Mapbox platform, public anonymous analytics links.

## Scope (quantified)

Roughly 10 to 14 independently landable units. High rigor on dataset identity, query types, and Report persistence (one-way doors). Low rigor on nav wiring and the Walker org gate (mechanical). Architect sketch before the one-way-door units. Nav and Walker auth can ship first against the current model.

Working tree currently has unrelated form-runtime work. Analytics code lands on a branch that does not mix that diff.

## Rigor

High. Blast radius is the analyst product. Competing docs already overstated the system. Scaffold is typed query plus tests for `execute_query` before grid and map features.

## Product calls already made (reversible except vocab)

- Keep locked vocabulary: Analysis explores, Reports shares.
- Table / chart / map are views inside Analysis, not four sidebar products named Lab, Prep, Spatial, Dashboards.
- `execute_query` stays the engine. Graphic Walker may stay as Explore, not as the dashboard renderer.
- Leaflet stays the map renderer. No Kepler.
- HyperFormula stays for spreadsheet columns until they compile server-side. No Syncfusion.
