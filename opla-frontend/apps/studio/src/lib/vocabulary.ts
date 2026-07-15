/** Canonical product vocabulary — see docs/PRODUCT_VOCABULARY.md */

export const PROJECT_WORKSPACE_TABS = [
    'tasks',
    'ops',
    'design',
    'messages',
    'data',
    'reports',
] as const;

export type ProjectWorkspaceTab = (typeof PROJECT_WORKSPACE_TABS)[number];

export type ProjectDataSection = 'directory' | 'datasets' | 'analysis' | 'media';
export type ProjectOpsSection = 'attendance' | 'review';
export type ProjectDesignSection = 'forms' | 'automations';

export const PROJECT_TAB_LABELS: Record<ProjectWorkspaceTab, string> = {
    tasks: 'Tasks',
    ops: 'Ops',
    design: 'Design',
    messages: 'Messages',
    data: 'Data',
    reports: 'Reports',
};

export const DATA_SECTION_LABELS: Record<ProjectDataSection, string> = {
    directory: 'Directory',
    datasets: 'Datasets',
    analysis: 'Analysis',
    media: 'Media',
};

export const OPS_SECTION_LABELS: Record<ProjectOpsSection, string> = {
    attendance: 'Attendance',
    review: 'Review',
};

export const DESIGN_SECTION_LABELS: Record<ProjectDesignSection, string> = {
    forms: 'Forms',
    automations: 'Automations',
};

/** Legacy ?tab= values → canonical workspace tab + optional section */
export function resolveLegacyProjectTab(
    tab: string | null,
    view: string | null,
    section: string | null,
): { tab: ProjectWorkspaceTab; section?: string; view?: string } {
    const raw = tab || 'design';

    if (raw === 'forms') return { tab: 'design', section: section || 'forms' };
    if (raw === 'threads') return { tab: 'messages' };
    if (raw === 'catalog') return { tab: 'data', section: 'directory' };
    if (raw === 'assets') return { tab: 'data', section: 'media' };
    if (raw === 'data' && !section) return { tab: 'data', section: 'datasets' };
    if (raw === 'review') return { tab: 'ops', section: 'review' };
    if (raw === 'tasks' || (raw === 'ops' && view === 'tasks')) return { tab: 'tasks' };
    if (raw === 'ops' && view === 'review') return { tab: 'ops', section: 'review' };

    if (PROJECT_WORKSPACE_TABS.includes(raw as ProjectWorkspaceTab)) {
        return { tab: raw as ProjectWorkspaceTab, section: section || undefined, view: view || undefined };
    }

    return { tab: 'design', section: 'forms' };
}

export type DashboardNavKey =
    | 'projects'
    | 'tasks'
    | 'ops'
    | 'design'
    | 'messages'
    | 'data'
    | 'members'
    | 'audience'
    | 'reports'
    | 'settings';

export const DASHBOARD_TAB_LABELS: Record<DashboardNavKey, string> = {
    projects: 'Projects',
    tasks: 'Tasks',
    ops: 'Ops',
    design: 'Design',
    messages: 'Messages',
    data: 'Data',
    members: 'Members & Roles',
    audience: 'Audience',
    reports: 'Reports',
    settings: 'Settings',
};

/** Legacy dashboard ?tab= → canonical key */
export function resolveLegacyDashboardTab(tab: string | null): DashboardNavKey {
    if (!tab) return 'projects';
    if (tab === 'forms') return 'design';
    if (tab === 'threads') return 'messages';
    if (tab === 'assets') return 'data';
    if (tab === 'datasets' || tab === 'analysis') return 'data';
    if (tab === 'tasks') return 'tasks';
    const valid: DashboardNavKey[] = [
        'projects', 'tasks', 'ops', 'design', 'messages', 'data',
        'members', 'audience', 'reports', 'settings',
    ];
    return valid.includes(tab as DashboardNavKey) ? (tab as DashboardNavKey) : 'projects';
}

export const TASK_KIND_LABELS: Record<string, string> = {
    general: 'Task',
    field_visit: 'Field visit',
};

export const FORM_KIND_LABELS: Record<string, string> = {
    standard: 'Standard form',
    directory: 'Directory form',
};

export const FORM_AREA_LABELS: Record<string, string> = {
    pulse: 'Pulse',
    agent: 'Agent',
};

/** Resolve Data area subsection from URL (org or project scope). */
export function resolveDataSection(tab: string | null, section: string | null): ProjectDataSection {
    if (tab === 'assets') return 'media';
    if (
        section === 'directory'
        || section === 'datasets'
        || section === 'analysis'
        || section === 'media'
    ) {
        return section;
    }
    if (tab === 'analysis') return 'analysis';
    if (tab === 'datasets') return 'datasets';
    return 'datasets';
}
