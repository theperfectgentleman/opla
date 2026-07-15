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
export type ProjectOpsSection = 'overview' | 'attendance' | 'review';
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
    overview: 'Overview',
    attendance: 'Attendance',
    review: 'Review',
};

export const DESIGN_SECTION_LABELS: Record<ProjectDesignSection, string> = {
    forms: 'Forms',
    automations: 'Automations',
};

/** Org sidebar — thin shell; Inbox is the personal landing hub */
export const ORG_SHELL_NAV = [
    'inbox',
    'projects',
    'reports',
    'members',
    'audience',
    'settings',
] as const;

export type OrgShellNavKey = (typeof ORG_SHELL_NAV)[number];

/** Project sidebar — programme-scoped tools (Reports live at org) */
export const PROJECT_SHELL_NAV = [
    'hub',
    'tasks',
    'ops',
    'design',
    'data',
    'messages',
] as const;

export type ProjectShellNavKey = (typeof PROJECT_SHELL_NAV)[number];

export type StudioShellNavKey = OrgShellNavKey | ProjectShellNavKey;

export const ORG_SHELL_NAV_LABELS: Record<OrgShellNavKey, string> = {
    inbox: 'Inbox',
    projects: 'Projects',
    reports: 'Reports',
    members: 'Teams',
    audience: 'Audience',
    settings: 'Settings',
};

export const PROJECT_SHELL_NAV_LABELS: Record<ProjectShellNavKey, string> = {
    hub: 'Hub',
    tasks: 'Tasks',
    ops: 'Ops',
    design: 'Design',
    data: 'Data',
    messages: 'Messages',
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
    if (raw === 'design' && section === 'directory') return { tab: 'data', section: 'directory' };
    if (raw === 'data' && !section) return { tab: 'data', section: 'datasets' };
    if (raw === 'design' && !section) return { tab: 'design', section: 'forms' };
    if (raw === 'review') return { tab: 'ops', section: 'review' };
    if (raw === 'tasks' || (raw === 'ops' && view === 'tasks')) return { tab: 'tasks' };
    if (raw === 'ops' && (view === 'review' || section === 'review')) return { tab: 'ops', section: 'review' };
    if (raw === 'ops' && section === 'attendance') return { tab: 'ops', section: 'attendance' };
    // Project workspace: Hub is the programme overview; Ops defaults to Attendance.
    if (raw === 'ops' && !section) return { tab: 'ops', section: 'attendance' };

    if (PROJECT_WORKSPACE_TABS.includes(raw as ProjectWorkspaceTab)) {
        return { tab: raw as ProjectWorkspaceTab, section: section || undefined, view: view || undefined };
    }

    return { tab: 'design', section: 'forms' };
}

export type DashboardNavKey =
    | 'inbox'
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
    inbox: 'Inbox',
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

/** Legacy dashboard ?tab= → canonical key. Default landing is Inbox. */
export function resolveLegacyDashboardTab(tab: string | null): DashboardNavKey {
    if (!tab) return 'inbox';
    if (tab === 'ops') return 'inbox'; // org Ops Overview → Inbox
    if (tab === 'forms') return 'design';
    if (tab === 'threads') return 'messages';
    if (tab === 'assets') return 'data';
    if (tab === 'datasets' || tab === 'analysis') return 'data';
    if (tab === 'tasks') return 'tasks';
    const valid: DashboardNavKey[] = [
        'inbox', 'projects', 'tasks', 'ops', 'design', 'messages', 'data',
        'members', 'audience', 'reports', 'settings',
    ];
    return valid.includes(tab as DashboardNavKey) ? (tab as DashboardNavKey) : 'inbox';
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

export function buildDashboardSearchParams(
    key: DashboardNavKey,
    options?: {
        section?: string;
        view?: string;
        tool?: string;
    },
): URLSearchParams {
    const next = new URLSearchParams();

    if (key === 'inbox') {
        next.set('tab', 'inbox');
        return next;
    }

    if (key === 'tasks') {
        next.set('tab', 'tasks');
        return next;
    }

    // Legacy org Ops URLs still resolve via resolveLegacyDashboardTab → inbox
    if (key === 'ops') {
        next.set('tab', 'inbox');
        return next;
    }

    if (key === 'members') {
        next.set('tab', 'members');
        next.set('section', options?.section || 'teams');
        return next;
    }

    if (key === 'data') {
        next.set('tab', 'data');
        const section = options?.section || 'datasets';
        next.set('section', section);
        if (section === 'analysis') {
            next.set('tool', options?.tool || 'lab');
        }
        return next;
    }

    if (key === 'design') {
        next.set('tab', 'design');
        next.set('section', options?.section || 'forms');
        return next;
    }

    next.set('tab', key);
    return next;
}

export function dashboardNavHref(
    key: DashboardNavKey,
    options?: {
        section?: string;
        view?: string;
        tool?: string;
    },
): string {
    const params = buildDashboardSearchParams(key, options);
    const query = params.toString();
    return query ? `/dashboard?${query}` : '/dashboard';
}

/** Map sidebar keys (including legacy aliases) to canonical dashboard URLs. */
export function resolveDashboardShellNav(rawKey: string): {
    key: DashboardNavKey;
    options?: {
        section?: string;
        view?: string;
        tool?: string;
    };
} {
    if (rawKey === 'datasets') {
        return { key: 'data', options: { section: 'datasets' } };
    }
    if (rawKey === 'analysis') {
        return { key: 'data', options: { section: 'analysis', tool: 'lab' } };
    }
    if (rawKey === 'assets') {
        return { key: 'data', options: { section: 'media' } };
    }

    const key = resolveLegacyDashboardTab(rawKey);
    if (rawKey === 'inbox' || key === 'inbox' || key === 'ops') {
        return { key: 'inbox' };
    }
    if (key === 'members') {
        return { key: 'members', options: { section: 'teams' } };
    }
    if (key === 'data') {
        return { key: 'data', options: { section: 'datasets' } };
    }
    if (key === 'design') {
        return { key: 'design', options: { section: 'forms' } };
    }
    return { key };
}

export function buildProjectSearchParams(
    key: Exclude<ProjectShellNavKey, 'hub'>,
    options?: {
        section?: string;
        view?: string;
        tool?: string;
    },
): URLSearchParams {
    const next = new URLSearchParams();
    next.set('tab', key);

    if (key === 'ops') {
        next.set('section', options?.section || 'attendance');
        return next;
    }
    if (key === 'design') {
        next.set('section', options?.section || 'forms');
        return next;
    }
    if (key === 'data') {
        const section = options?.section || 'datasets';
        next.set('section', section);
        if (section === 'analysis' && options?.tool) {
            next.set('tool', options.tool);
        }
        return next;
    }

    if (options?.section) next.set('section', options.section);
    if (options?.view) next.set('view', options.view);
    if (options?.tool) next.set('tool', options.tool);
    return next;
}

/** Project-scoped sidebar destinations (Hub is a dedicated route). */
export function projectNavHref(
    projectId: string,
    key: ProjectShellNavKey,
    options?: {
        section?: string;
        view?: string;
        tool?: string;
        channel?: string;
    },
): string {
    if (key === 'hub') {
        const params = new URLSearchParams();
        if (options?.channel) params.set('channel', options.channel);
        const query = params.toString();
        return query ? `/projects/${projectId}/hub?${query}` : `/projects/${projectId}/hub`;
    }

    const params = buildProjectSearchParams(key, options);
    const query = params.toString();
    return `/projects/${projectId}?${query}`;
}

/** Resolve any sidebar key click while inside a project. */
export function projectShellNavHref(projectId: string, key: string): string {
    if (key === 'hub') return projectNavHref(projectId, 'hub');
    if (key === 'ops') return projectNavHref(projectId, 'ops', { section: 'attendance' });
    if (key === 'design') return projectNavHref(projectId, 'design', { section: 'forms' });
    if (key === 'data') return projectNavHref(projectId, 'data', { section: 'datasets' });
    if (key === 'tasks' || key === 'messages') {
        return projectNavHref(projectId, key);
    }
    if (key === 'reports') return dashboardNavHref('reports');
    if (key === 'members') return dashboardNavHref('members', { section: 'teams' });
    if (key === 'audience') return dashboardNavHref('audience');
    if (key === 'settings') return dashboardNavHref('settings');
    if (key === 'inbox') return dashboardNavHref('inbox');
    return dashboardNavHref('projects');
}

export function resolveDesignSection(section: string | null): ProjectDesignSection {
    if (section === 'automations' || section === 'forms') {
        return section;
    }
    return 'forms';
}

export function resolveOpsSection(section: string | null, view?: string | null): ProjectOpsSection {
    if (section === 'overview' || section === 'attendance' || section === 'review') {
        return section;
    }
    if (view === 'review') return 'review';
    if (view === 'attendance') return 'attendance';
    return 'overview';
}
