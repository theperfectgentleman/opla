# Critic: gemini (gemini-3.6-flash-low)

## Findings

### 1. [Structural] Dual incompatible report architectures
ProjectReport (Postgres) vs ReportBucket (localStorage). Neither links to dashboards/questions.

### 2. [Structural] Prep derived datasets pollute Form/Submission
LIVE Form slug prep-*, fake submissions.

### 3. [Structural] Disconnected formula engines
HyperFormula vs Python AST vs linked calculated_fields=None.

### 4. [Concern] Walker compute auth bypass and HTTP 200 on errors
No get_user_org_role. Swallows exceptions. Ignores Prep transforms.

### 5. [Concern] Orphaned nav and disconnected maps
ProjectWorkspace omits onSelectAnalyticsTool. Spatial is DEMO_AREAS/STORES.

### 6. [Concern] Destructive card replace-all; global filters unwired; markdown needs dummy questions
update_dashboard deletes all cards. question_id NOT NULL.

### 7. [Observation] Hardcoded localhost CSV upload
AnalyticsHub.tsx line 112.
