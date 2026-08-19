# Critic: composer (composer-2.5-fast)

## Overall

execute_query + SavedQuestion are reasonable seeds. Blockers: three report systems, form-shaped prep, four computation paths, maps off the save graph.

## Findings

### 1. [structural] Three incompatible report products
Dashboards/questions vs ProjectReport vs localStorage ReportBucket.

### 2. [structural] SavedQuestion is an untyped JSON blob
create_question passthrough. dict[str, Any]. Stub composer.

### 3. [structural] Prep tables modeled as LIVE forms

### 4. [structural] Query execution split across four paths
execute_query, Walker compute, QuickChart client agg, HyperFormula.

### 5. [structural] Map Analysis is a disconnected demo

### 6. [concern] Shell fragmented; projectId undefined on hub

### 7. [concern] Saved artifacts outpace render pipeline
Walker placeholder; pins exclude walker; markdown needs dummy questions.

### 8. [concern] Dashboard interactivity mostly presentational
globalFilters unused; replace-all cards.

### 9. [concern] CSV ingest bypasses AnalyticsService; schema mismatch

### 10. [concern] Walker compute weaker security boundary

### 11. [observation] Query engine omits review_status

### 12. [observation] cache_ttl unused; no analytics tests
