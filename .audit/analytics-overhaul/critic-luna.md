# Critic: luna (gpt-5.6-luna-medium)

## Findings

### 1. [Structural] Analytics artifacts have weak ownership boundaries
SavedQuestion JSON configs and dashboard cards lack relational validation of dataset/org/project compatibility.

### 2. [Structural] Prep models analytics tables as live forms
create_derived_dataset mints LIVE Form + FormDataset. Linked is a runtime redirect.

### 3. [Structural] Query execution has competing semantics
Prep HyperFormula, backend AST, Walker compute, dashboard re-query are separate paths. Frontend runQuery omits calculated_fields.

### 4. [Structural] Reports and dashboards are incompatible artifact systems
ProjectReport vs localStorage ReportBucket. Neither is the dashboard model.

### 5. [Structural] Analytics navigation does not match product ownership
Org Data hub vs project Analysis stub vs vocab saying Analysis lives under project Data.

### 6. [Structural] Maps are not part of the analytics model
SpatialAnalysisLab is demo data. No viz_type, no save.

### 7. [Concern] Dashboard layout and filtering are mostly presentation-only
position unused, region filter dummy, Walker placeholder.

### 8. [Concern] CSV ingestion is an adapter with no durable data-source boundary
CSV becomes mock Form+Submission. Hardcoded localhost URL.
