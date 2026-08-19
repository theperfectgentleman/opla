import {
	AnalyticsDomain,
	AnalyticsSource,
	AnalyticsQueryRequest,
	AnalyticsQueryResponse,
	SavedQuestion,
	AnalyticsDashboard,
	OrgReport,
	ProjectHubPin
} from './types';

// ============================================================================
// Call Site 1: Studio Data -> Analysis Tab (Exploring, Querying, Saving)
// Location: opla-frontend/apps/studio/src/pages/ProjectAnalysis.tsx
// ============================================================================

export async function handleProjectAnalysisWorkflow(
	domain: AnalyticsDomain,
	projectId: string,
	datasetId: string
) {
	// 1. Fetch available sources under project Data -> Analysis
	const sources: AnalyticsSource[] = await domain.listSources({ projectId });
	const targetSource = sources.find((s) => s.dataset_id === datasetId);

	if (!targetSource) throw new Error('Dataset not found in project');

	// 2. Execute unified Query AST (Chart / Table / Map)
	const query: AnalyticsQueryRequest = {
		dataset_id: targetSource.dataset_id,
		select_fields: ['region', 'district', 'gps_coords'],
		filters: {
			logic: 'and',
			rules: [{ field: 'status', op: 'eq', value: 'APPROVED' }]
		},
		group_by: [{ field: 'region' }],
		aggregates: [{ field: 'submission_id', fn: 'count', alias: 'total_submissions' }],
		order_by: [{ field: 'total_submissions', direction: 'desc' }],
		limit: 100,
		offset: 0
	};

	const results: AnalyticsQueryResponse = await domain.executeQuery(query);

	// 3. Save as a Map Question
	const savedMapQuestion: SavedQuestion = await domain.createQuestion({
		title: 'Regional Submission Coverage Map',
		project_id: projectId,
		source_config: {
			dataset_id: targetSource.dataset_id,
			dataset_name: targetSource.dataset_name
		},
		query_config: query,
		viz_type: 'map',
		viz_config: {
			lat_field: 'latitude',
			lng_field: 'longitude',
			label_field: 'district',
			cluster: true,
			default_zoom: 10
		}
	});

	// 4. Pin Map to Project Hub (Max 4 pins per project)
	const pin: ProjectHubPin = await domain.pinToHub(projectId, savedMapQuestion.id);

	return { results, savedMapQuestion, pin };
}

// ============================================================================
// Call Site 2: Studio Analysis -> Dashboard Canvas Re-querying
// Location: opla-frontend/apps/studio/src/components/analytics/DashboardViewer.tsx
// ============================================================================

export async function renderDashboardCards(
	domain: AnalyticsDomain,
	dashboardId: string
) {
	const dashboard: AnalyticsDashboard = await domain.getDashboard(dashboardId);

	// Re-run card queries on the server. Zero client drift.
	const cardResults = await Promise.all(
		dashboard.cards.map(async (card) => {
			if (card.question.viz_type === 'markdown') {
				return { cardId: card.id, vizType: 'markdown', markdown: card.question.viz_config.content };
			}

			// Execute the question's query_config against executeQuery
			const data = await domain.executeQuery(card.question.query_config);
			return {
				cardId: card.id,
				title: card.question.title,
				vizType: card.question.viz_type,
				vizConfig: card.viz_override || card.question.viz_config,
				data
			};
		})
	);

	return { title: dashboard.title, cardResults };
}

// ============================================================================
// Call Site 3: Org Reports -> Stakeholder Board (Team Grants)
// Location: opla-frontend/apps/studio/src/pages/OrgReports.tsx
// ============================================================================

export async function handleOrgReportSharing(
	domain: AnalyticsDomain,
	orgId: string,
	questionIds: string[]
) {
	// 1. Create org-level report board (persisted in DB, NOT localStorage)
	const report: OrgReport = await domain.createReport({
		org_id: orgId,
		title: 'Q3 Executive Stakeholder Brief',
		description: 'Cross-project operational pulse and geographic coverage',
		grants: [
			{ team_id: 'team-execs-uuid', role: 'viewer' },
			{ team_id: 'team-analysts-uuid', role: 'explorer' }
		],
		blocks: [
			{
				id: 'block-1',
				type: 'markdown',
				title: 'Executive Summary',
				content: '## Q3 Field Performance\nCoverage reached 94% across target districts.'
			},
			...questionIds.map((qId, idx) => ({
				id: `block-q-${idx}`,
				type: 'question' as const,
				question_id: qId
			}))
		]
	});

	// 2. Fetch Report as a stakeholder viewer
	const loadedReport = await domain.getReport(report.id);
	return loadedReport;
}
