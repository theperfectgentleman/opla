# Explorer: Excel-like grid (Prep)

Source: how-explorer grid slice. Read-only. 2026-08-19.

## Verdict

Not AG Grid, Handsontable, or Syncfusion. Custom HTML `<table>` plus HyperFormula for **column-level** formulas. Cells are display-only. The actually editable spreadsheet in Studio is `DirectoryGrid` (ops/directory), not analysis.

## What works

- Open via URL `?tab=data&section=analysis&tool=prep`. Sidebar item is unwired.
- Load up to 5000 rows (`POST /analytics/query`, no filters/sort). Paint first 500.
- Show/hide/resize columns. Labels vs values for choices.
- Add calculated columns with Excel-ish `[Column]` formulas (66 catalogued functions). Linked datasets re-apply on load. Snapshots bake values into submissions.
- Save as a **new LIVE Form + FormDataset** (snapshot or linked). Create-only. Pollutes form catalog (`prep-*`).
- One-shot `sessionStorage` handoff of all loaded rows to Lab. `from=prep` query param unused.

## Missing vs Excel

Cell edit, fill-down, undo, sort, row filter, joins, named ranges, copy/paste, CSV/XLSX export from Prep, pagination/virtualization, update existing derived table, tests. Calc columns always typed `number`.

## Disconnected formula engines

Prep = HyperFormula in the browser. Backend `calculated_fields` = `+ - * /` AST. Studio `runQuery` does not send them. Linked query sets `calculated_fields=None`.

## Caps

Prep fetch 5000, paint 500, Lab own load 2000 (or 25 + server compute). Prep handoff bypasses Lab cap.
