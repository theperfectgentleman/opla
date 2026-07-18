import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    AlertCircle,
    ChevronRight,
    FileBarChart2,
    FileText,
    Paperclip,
    Play,
    Plus,
    SquareCheckBig,
    Users,
    Database,
    Sparkles,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import ConfirmPopover from '../components/ConfirmPopover';
import DirectoryGrid from '../components/directory/DirectoryGrid';
import FormsDesignPanel from '../components/forms/FormsDesignPanel';
import ProjectThreadsPanel from '../components/hub/ProjectThreadsPanel';
import OpsAttendanceMock from '../components/ops/OpsAttendanceMock';
import OpsReviewMock from '../components/ops/OpsReviewMock';
import { useOrg } from '../contexts/OrgContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
    countUnpublishedDirectoryFields,
    getDirectoryBlueprintFields,
    normalizeDirectoryEntry,
} from '../utils/directoryUtils';
import {
    resolveLegacyProjectTab,
    resolveDesignSection,
    resolveOpsSection,
    projectNavHref,
    projectShellNavHref,
    type ProjectWorkspaceTab,
    type ProjectDataSection,
    type ProjectOpsSection,
    type ProjectDesignSection,
    type ProjectShellNavKey,
} from '../lib/vocabulary';
import { analyticsAPI, formAPI, projectAPI, reportAPI, submissionAPI, teamAPI } from '../lib/api';

type ProjectAccessRule = {
    id: string;
    project_id: string;
    accessor_id: string;
    accessor_type: 'user' | 'team';
    role?: 'collector' | 'analyst' | 'editor';
    role_template_id?: string;
    role_name?: string;
    role_slug?: string;
    permissions?: string[];
};

type ProjectRoleTemplate = {
    id: string;
    name: string;
    slug: string;
    description?: string;
    permissions: string[];
    priority: number;
    is_system: boolean;
    assignment_count?: number;
};

type Team = {
    id: string;
    name: string;
    description?: string;
};

type ResponsibilityFields = {
    lead_accessor_id?: string | null;
    lead_accessor_type?: 'user' | 'team' | null;
    assigned_accessor_id?: string | null;
    assigned_accessor_type?: 'user' | 'team' | null;
    guest_accessor_id?: string | null;
    guest_accessor_type?: 'user' | 'team' | null;
};

type WorkspaceForm = ResponsibilityFields & {
    id: string;
    title: string;
    status: string;
    version: number;
    updated_at: string;
    kind?: 'standard' | 'directory';
    directory_key_field_id?: string | null;
    directory_label_field_id?: string | null;
};

type ReviewQueueItem = {
    id: string;
    form_id: string;
    form_title: string;
    user_id?: string | null;
    data: Record<string, any>;
    review_status: 'submitted' | 'approved' | 'rejected';
    review_comment?: string | null;
    created_at: string;
};


type WorkspaceDataset = {
    id: string;
    name: string;
    records_count: number;
    updated_at: string;
    status: 'active' | 'archived';
};

type WorkspaceThread = {
    id: string;
    title: string;
    summary: string;
    reply_count: number;
    updated_at: string;
};

type WorkspaceAsset = {
    id: string;
    title: string;
    kind: 'document' | 'image' | 'audio' | 'link';
    summary: string;
    updated_at: string;
};

type ProjectTask = {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    kind: 'general' | 'field_visit';
    status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
    starts_at?: string;
    due_at?: string;
    scheduled_date?: string;
    source_submission_id?: string;
    context_json?: Record<string, unknown> | null;
    automation_rule_id?: string | null;
    assigned_accessor_id?: string;
    assigned_accessor_type?: 'user' | 'team';
    created_by?: string;
    completed_at?: string;
    created_at: string;
    updated_at: string;
};

type ProjectAttendanceRecord = {
    id: string;
    project_id: string;
    user_id: string;
    attendance_date: string;
    status: 'checked_in' | 'checked_out';
    check_in_at: string;
    check_in_location_json: { latitude: number; longitude: number; accuracy_meters?: number; label?: string };
    check_in_note?: string | null;
    check_in_image_uri?: string | null;
    check_in_signature?: string | null;
    check_out_at?: string | null;
    check_out_location_json?: { latitude: number; longitude: number; accuracy_meters?: number; label?: string } | null;
    check_out_note?: string | null;
    check_out_image_uri?: string | null;
    check_out_signature?: string | null;
    created_at: string;
    updated_at: string;
};

type FormAutomationEvent = 'submission_created' | 'submission_reviewed' | 'submission_approved';

type FormAutomationAction = 'create_task' | 'create_alert';

type AutomationCondition = {
    field: string;
    operator: string;
    value: string;
};

type FormAutomationRule = {
    id: string;
    form_id: string;
    name: string;
    description?: string | null;
    event_type: FormAutomationEvent;
    action_type: FormAutomationAction;
    is_active: boolean;
    conditions_json?: {
        combinator?: 'and' | 'or';
        rules?: Array<{ field?: string; operator?: string; value?: unknown }>;
    } | null;
    action_config_json: Record<string, any>;
    created_at: string;
    updated_at: string;
};

type ReportArtifact = ResponsibilityFields & {
    id: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    updated_at: string;
};

type AccessorOption = {
    id: string;
    type: 'user' | 'team';
    label: string;
};

const statusTone: Record<string, string> = {
    planning: 'bg-amber-500/10 text-amber-300 border border-amber-500/20',
    active: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    paused: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    archived: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
};



const reportStatusTone: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    published: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    archived: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
};

const formStatusTone: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-300 border border-slate-500/20',
    live: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    archived: 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
};

const automationEventOptions: Array<{ value: FormAutomationEvent; label: string }> = [
    { value: 'submission_created', label: 'Submission Created' },
    { value: 'submission_reviewed', label: 'Submission Reviewed' },
    { value: 'submission_approved', label: 'Submission Approved' },
];

const automationActionOptions: Array<{ value: FormAutomationAction; label: string }> = [
    { value: 'create_task', label: 'Create task' },
    { value: 'create_alert', label: 'Create alert (Needs Attention)' },
];

const automationSeverityOptions: Array<{ value: string; label: string }> = [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'critical', label: 'Critical' },
];

const automationOperatorOptions: Array<{ value: string; label: string }> = [
    { value: 'equal', label: 'equals' },
    { value: 'notEqual', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'in', label: 'is in list' },
    { value: 'greaterThan', label: 'greater than' },
    { value: 'lessThan', label: 'less than' },
    { value: 'greaterThanOrEqual', label: 'greater than or equal' },
    { value: 'lessThanOrEqual', label: 'less than or equal' },
    { value: 'exists', label: 'has a value' },
    { value: 'isEmpty', label: 'is empty' },
];

const createEmptyAutomationCondition = (): AutomationCondition => ({
    field: '',
    operator: 'equal',
    value: '',
});

const formatDateKey = (value?: string | Date | null) => {
    if (!value) {
        return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const businessRoleLabelBySlug: Record<string, string> = {
    'project-manager': 'Owner',
    'field-supervisor': 'Manager',
    analyst: 'Contributor',
    'field-personnel': 'Contributor',
    'stakeholder-viewer': 'Viewer',
};

type OpsView = ProjectOpsSection;
type DesignView = ProjectDesignSection;
type DataView = ProjectDataSection;

const ProjectWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const legacyResolved = resolveLegacyProjectTab(
        searchParams.get('tab'),
        searchParams.get('view'),
        searchParams.get('section'),
    );
    const activeTab: ProjectWorkspaceTab = legacyResolved.tab;
    const dataSection: DataView = (legacyResolved.section as DataView) || 'datasets';
    const designSection: DesignView = resolveDesignSection(legacyResolved.section || null);
    const opsView: OpsView = resolveOpsSection(
        legacyResolved.section || null,
        legacyResolved.view || searchParams.get('view'),
    );

    const setWorkspaceTab = (tab: ProjectWorkspaceTab, options?: { section?: string; view?: string }) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', tab);
            if (options?.section) {
                next.set('section', options.section);
            } else {
                next.delete('section');
            }
            if (options?.view) {
                next.set('view', options.view);
            } else {
                next.delete('view');
            }
            return next;
        });
    };

    useEffect(() => {
        if (!searchParams.get('tab')) {
            setSearchParams(() => {
                const next = new URLSearchParams();
                next.set('tab', 'design');
                next.set('section', 'forms');
                return next;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Org Ops Overview lives on the dashboard; project Ops Overview → Hub.
    useEffect(() => {
        if (activeTab === 'ops' && opsView === 'overview' && projectId) {
            navigate(`/projects/${projectId}/hub`, { replace: true });
        }
    }, [activeTab, navigate, opsView, projectId]);

    // Legacy ?tab= redirects
    useEffect(() => {
        const rawTab = searchParams.get('tab');
        if (!rawTab) return;
        const resolved = resolveLegacyProjectTab(
            rawTab,
            searchParams.get('view'),
            searchParams.get('section'),
        );
        const canonicalTab = resolved.tab;
        const needsRedirect = rawTab !== canonicalTab
            || (rawTab === 'forms' || rawTab === 'catalog' || rawTab === 'threads' || rawTab === 'tasks' || rawTab === 'review')
            || (rawTab === 'design' && searchParams.get('section') === 'directory')
            || (rawTab === 'data' && !searchParams.get('section') && resolved.section);
        if (!needsRedirect) return;
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('tab', canonicalTab);
            if (resolved.section) next.set('section', resolved.section);
            else next.delete('section');
            if (resolved.view) next.set('view', resolved.view);
            else next.delete('view');
            return next;
        }, { replace: true });
    }, [searchParams, setSearchParams]);

    const {
        currentOrg,
        currentProject,
        members,
        refreshCurrentProject,
        setCurrentProject,
    } = useOrg();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [forms, setForms] = useState<WorkspaceForm[]>([]);
    const [isCreateFormModalOpen, setIsCreateFormModalOpen] = useState(false);
    const [newFormTitle, setNewFormTitle] = useState('');
    const [newFormKind, setNewFormKind] = useState<'standard' | 'directory'>('standard');
    const [selectedDirectoryForm, setSelectedDirectoryForm] = useState<WorkspaceForm | null>(null);
    const [directoryEntries, setDirectoryEntries] = useState<any[]>([]);
    const [selectedDirectoryFields, setSelectedDirectoryFields] = useState<any[]>([]);
    const [directoryUnpublishedFieldCount, setDirectoryUnpublishedFieldCount] = useState(0);
    const [directoryConfirmAction, setDirectoryConfirmAction] = useState<{
        type: 'hide' | 'delete';
        entry: any;
        anchorRect: DOMRect;
    } | null>(null);
    const [directoryConfirmLoading, setDirectoryConfirmLoading] = useState(false);
    const [entriesLoading, setEntriesLoading] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<ProjectAttendanceRecord[]>([]);
    const [reports, setReports] = useState<ReportArtifact[]>([]);
    const [accessRules, setAccessRules] = useState<ProjectAccessRule[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roleTemplates, setRoleTemplates] = useState<ProjectRoleTemplate[]>([]);
    const [selectedAutomationFormId, setSelectedAutomationFormId] = useState('');
    const [automationRules, setAutomationRules] = useState<FormAutomationRule[]>([]);
    const [automationLoading, setAutomationLoading] = useState(false);
    const [automationConditions, setAutomationConditions] = useState<AutomationCondition[]>([createEmptyAutomationCondition()]);
    const [newAutomationRule, setNewAutomationRule] = useState({
        name: '',
        description: '',
        event_type: 'submission_approved' as FormAutomationEvent,
        action_type: 'create_task' as FormAutomationAction,
        combinator: 'and' as 'and' | 'or',
        title_template: 'Follow up {{ submission.id }}',
        description_template: '',
        detail_template: '',
        severity: 'warning',
        assigned_accessor: '',
        context_mapping_json: '',
        starts_at_value: '',
        due_at_value: '',
        scheduled_date_value: '',
        is_active: true,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessorId, setAccessorId] = useState('');
    const [roleTemplateId, setRoleTemplateId] = useState('');
    const [taskPlannerDate, setTaskPlannerDate] = useState(() => formatDateKey(new Date()));
    const [taskPlannerAssignee, setTaskPlannerAssignee] = useState('');
    const [taskPlannerSource, setTaskPlannerSource] = useState<'all' | 'manual' | 'automated'>('all');
    const attendanceDay = useMemo(() => formatDateKey(new Date()), []);

    const [datasets, setDatasets] = useState<WorkspaceDataset[]>([]);
    const [messageChannels, setMessageChannels] = useState<WorkspaceThread[]>([]);
    const [assets] = useState<WorkspaceAsset[]>([
        {
            id: 'asset-brief',
            title: 'Field briefing deck',
            kind: 'document',
            summary: 'Training and implementation reference shared with supervisors before launch.',
            updated_at: new Date().toISOString(),
        },
        {
            id: 'asset-audio',
            title: 'Stimulus audio clip',
            kind: 'audio',
            summary: 'Audio sample used by field staff during assisted interviews.',
            updated_at: new Date(Date.now() - 1000 * 60 * 125).toISOString(),
        },
    ]);

    useEffect(() => {
        return () => setCurrentProject(null);
    }, [setCurrentProject]);

    useEffect(() => {
        if (!currentOrg || !projectId) {
            return;
        }

        const loadWorkspace = async () => {
            setLoading(true);
            setError(null);
            try {
                const [project, projectForms, projectTasks, projectAttendance, projectReports, projectAccess, orgTeams, templates, analyticsSources, projectThreads] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId),
                    projectAPI.listTasks(currentOrg.id, projectId),
                    projectAPI.listAttendance(currentOrg.id, projectId, attendanceDay),
                    reportAPI.list(currentOrg.id, projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    projectAPI.listRoleTemplates(currentOrg.id),
                    analyticsAPI.listSources(currentOrg.id).catch(() => []),
                    projectAPI.listMessages(currentOrg.id, projectId).catch(() => []),
                ]);
                const pendingReviews = (
                    await Promise.all(
                        projectForms.map(async (form: WorkspaceForm) => {
                            try {
                                const submissions = await submissionAPI.listForForm(form.id, 'submitted');
                                  return (Array.isArray(submissions) ? submissions : []).map((submission: any) => ({
                                    ...submission,
                                    form_title: form.title,
                                }));
                            } catch {
                                return [];
                            }
                        }),
                    )
                ).flat();
                setCurrentProject(project);
                setForms(projectForms);
                const projectDatasets = (Array.isArray(analyticsSources) ? analyticsSources : [])
                    .filter((source: any) => source.project_id === projectId)
                    .map((source: any) => ({
                        id: source.dataset_id,
                        name: source.form_title || source.dataset_name,
                        records_count: source.record_count || 0,
                        updated_at: new Date().toISOString(),
                        status: 'active' as const,
                    }));
                setDatasets(projectDatasets);
                setReviewQueue(pendingReviews);
                setTasks(projectTasks);
                setAttendanceRecords(projectAttendance);
                setReports(projectReports);
                setAccessRules(projectAccess);
                setTeams(orgTeams);
                setRoleTemplates(templates);
                setMessageChannels(
                    (Array.isArray(projectThreads) ? projectThreads : []).map((thread: any) => ({
                        id: thread.id,
                        title: thread.title,
                        summary: thread.summary || '',
                        reply_count: thread.reply_count || 0,
                        updated_at: thread.updated_at,
                    })),
                );
            } catch (err: any) {
                setError(err?.message || 'Failed to load project workspace');
            } finally {
                setLoading(false);
            }
        };

        loadWorkspace();
    }, [attendanceDay, currentOrg, projectId, refreshCurrentProject, setCurrentProject]);

    const selectableAccessors = useMemo(() => {
        return members.map(member => ({
            id: member.user_id,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
    }, [members]);

    const assignmentOptions = useMemo<AccessorOption[]>(() => {
        const userOptions = members.map(member => ({
            id: member.user_id,
            type: 'user' as const,
            label: member.user?.full_name || member.user?.email || member.user?.phone || member.user_id,
        }));
        const teamOptions = teams.map(team => ({
            id: team.id,
            type: 'team' as const,
            label: team.name,
        }));

        return [...userOptions, ...teamOptions].sort((left, right) => left.label.localeCompare(right.label));
    }, [members, teams]);

    useEffect(() => {
        setAccessorId(selectableAccessors[0]?.id || '');
    }, [selectableAccessors]);

    useEffect(() => {
        setRoleTemplateId(roleTemplates[0]?.id || '');
    }, [roleTemplates]);

    useEffect(() => {
        setSelectedAutomationFormId((currentValue) => {
            if (currentValue && forms.some((form) => form.id === currentValue)) {
                return currentValue;
            }
            return forms[0]?.id || '';
        });
    }, [forms]);

    const openFormMedia = (formId: string) => {
        navigate(`/forms/${formId}`);
    };

    useEffect(() => {
        if (!selectedAutomationFormId) {
            setAutomationRules([]);
            return;
        }

        let cancelled = false;

        const loadAutomationRules = async () => {
            setAutomationLoading(true);
            try {
                const rules = await formAPI.listAutomationRules(selectedAutomationFormId);
                if (!cancelled) {
                    setAutomationRules(Array.isArray(rules) ? rules : []);
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err?.response?.data?.detail || err?.message || 'Failed to load automation rules');
                }
            } finally {
                if (!cancelled) {
                    setAutomationLoading(false);
                }
            }
        };

        void loadAutomationRules();

        return () => {
            cancelled = true;
        };
    }, [selectedAutomationFormId]);


    const getBusinessRoleLabel = (rule: Pick<ProjectAccessRule, 'role_name' | 'role_slug' | 'role'>) => {
        const slug = rule.role_slug || rule.role || '';
        return businessRoleLabelBySlug[slug] || rule.role_name || rule.role_slug || rule.role || 'Project access';
    };

    const resolveAccessorLabel = (accId?: string | null, accType?: 'user' | 'team' | null) => {
        if (!accId || !accType) {
            return 'Not set';
        }
        if (accType === 'team') {
            return teams.find(team => team.id === accId)?.name || 'Unknown team';
        }
        const member = members.find(item => item.user_id === accId);
        return member?.user?.full_name || member?.user?.email || member?.user?.phone || 'Unknown member';
    };

    const resolveRuleLabel = (rule: ProjectAccessRule) => resolveAccessorLabel(rule.accessor_id, rule.accessor_type);
    const resolveTaskAssigneeLabel = (task: ProjectTask) => resolveAccessorLabel(task.assigned_accessor_id, task.assigned_accessor_type);
    const selectedAutomationForm = forms.find((form) => form.id === selectedAutomationFormId) || null;

    const getTaskContextText = (task: ProjectTask, key: string) => {
        const value = task.context_json?.[key];
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const getNestedTaskContextText = (task: ProjectTask, parentKey: string, childKey: string) => {
        const parent = task.context_json?.[parentKey];
        if (!parent || typeof parent !== 'object' || Array.isArray(parent)) {
            return null;
        }
        const value = (parent as Record<string, unknown>)[childKey];
        return typeof value === 'string' && value.trim() ? value.trim() : null;
    };

    const getTaskSourceRecordLabel = (task: ProjectTask) => getTaskContextText(task, 'source_record_label');
    const getTaskContextSummary = (task: ProjectTask) => (
        getTaskContextText(task, 'location_label')
        || getTaskContextText(task, 'region')
        || getNestedTaskContextText(task, 'routing', 'cluster')
        || getNestedTaskContextText(task, 'routing', 'zone')
    );

    const isAutomatedTask = (task: ProjectTask) => Boolean(task.source_submission_id);

    const salespersonOptions = useMemo(
        () => assignmentOptions.filter((option) => option.type === 'user'),
        [assignmentOptions],
    );

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const matchesAssignee = !taskPlannerAssignee || getAccessorValue(task.assigned_accessor_id, task.assigned_accessor_type) === taskPlannerAssignee;
            if (!matchesAssignee) {
                return false;
            }

            const matchesSource = taskPlannerSource === 'all'
                || (taskPlannerSource === 'automated' && isAutomatedTask(task))
                || (taskPlannerSource === 'manual' && !isAutomatedTask(task));
            if (!matchesSource) {
                return false;
            }

            if (!taskPlannerDate) {
                return true;
            }

            const taskDates = [task.starts_at, task.due_at, task.scheduled_date]
                .map((value) => formatDateKey(value))
                .filter(Boolean);

            return taskDates.includes(taskPlannerDate);
        });
    }, [taskPlannerAssignee, taskPlannerDate, taskPlannerSource, tasks]);

    const filteredTaskCounts = useMemo(() => ({
        total: filteredTasks.length,
        todo: filteredTasks.filter((task) => task.status === 'todo').length,
        inProgress: filteredTasks.filter((task) => task.status === 'in_progress').length,
        done: filteredTasks.filter((task) => task.status === 'done').length,
        manual: filteredTasks.filter((task) => !isAutomatedTask(task)).length,
        automated: filteredTasks.filter((task) => isAutomatedTask(task)).length,
    }), [filteredTasks]);


    const handleShellNavSelect = (key: string) => {
        if (!projectId) return;
        navigate(projectShellNavHref(projectId, key));
    };

    const shellActiveNav: ProjectShellNavKey = (
        ['tasks', 'ops', 'design', 'data', 'messages'] as const
    ).includes(activeTab as Exclude<ProjectShellNavKey, 'hub'>)
        ? (activeTab as Exclude<ProjectShellNavKey, 'hub'>)
        : 'design';

    const handleGrantAccess = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !projectId || !accessorId || !roleTemplateId) return;

        try {
            const accessRule = await projectAPI.grantAccess(currentOrg.id, projectId, {
                accessor_id: accessorId,
                accessor_type: 'user',
                role_template_id: roleTemplateId,
            });

            setAccessRules(prev => {
                const existingIndex = prev.findIndex(item => item.accessor_id === accessRule.accessor_id && item.accessor_type === accessRule.accessor_type);
                if (existingIndex === -1) {
                    return [...prev, accessRule];
                }
                const next = [...prev];
                next[existingIndex] = accessRule;
                return next;
            });
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to add project member');
        }
    };

    const handleRevokeAccess = async (rule: ProjectAccessRule) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.revokeAccess(currentOrg.id, projectId, rule.accessor_id, rule.accessor_type);
            setAccessRules(prev => prev.filter(item => item.id !== rule.id));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to remove project member');
        }
    };

    const getAccessorValue = (accId?: string | null, accType?: 'user' | 'team' | null) => {
        if (!accId || !accType) {
            return '';
        }
        return `${accType}:${accId}`;
    };

    const parseAccessorValue = (value: string) => {
        if (!value) {
            return { accessor_id: null, accessor_type: null };
        }
        const [accessor_type, accessor_id] = value.split(':');
        return {
            accessor_id,
            accessor_type: accessor_type as 'user' | 'team',
        };
    };

    const getTaskAssignmentValue = (task: ProjectTask) => getAccessorValue(task.assigned_accessor_id, task.assigned_accessor_type);

    const resolveAttendanceMemberLabel = (record: ProjectAttendanceRecord) => {
        const member = members.find(item => item.user_id === record.user_id);
        return member?.user?.full_name || member?.user?.email || member?.user?.phone || record.user_id;
    };

    const formatAttendanceLocation = (location?: { latitude: number; longitude: number; accuracy_meters?: number; label?: string } | null) => {
        if (!location) {
            return 'Location pending';
        }
        return location.label || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    };

    const attendanceSummary = useMemo(() => ({
        total: attendanceRecords.length,
        checkedIn: attendanceRecords.filter((record) => record.status === 'checked_in').length,
        checkedOut: attendanceRecords.filter((record) => record.status === 'checked_out').length,
    }), [attendanceRecords]);

    const workflowMetrics = useMemo(() => {
        const sourceLinkedTasks = tasks.filter((task) => Boolean(task.source_submission_id)).length;
        const automatedTasks = tasks.filter((task) => isAutomatedTask(task)).length;
        const completedTasks = tasks.filter((task) => task.status === 'done').length;
        const publishedReports = reports.filter((report) => report.status === 'published').length;

        return {
            pendingReview: reviewQueue.length,
            sourceLinkedTasks,
            automatedTasks,
            completedTasks,
            completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
            attendanceCompletionRate: attendanceRecords.length > 0 ? Math.round((attendanceSummary.checkedOut / attendanceRecords.length) * 100) : 0,
            publishedReports,
        };
    }, [attendanceRecords.length, attendanceSummary.checkedOut, reports, reviewQueue.length, tasks]);

    const workflowJoinNotes = useMemo(() => ([
        'Source records join to assignments through source_submission_id on project tasks.',
        'Automation provenance stays on automation_rule_id, while task context_json carries copied routing or source labels for reporting.',
        'Attendance joins back to field execution through project_id, user_id, and attendance_date for the same operating day.',
    ]), []);

    const handleTaskStatusChange = async (taskId: string, status: ProjectTask['status']) => {
        if (!currentOrg || !projectId) return;

        try {
            const updated = await projectAPI.updateTask(currentOrg.id, projectId, taskId, { status });
            setTasks(prev => prev.map(task => task.id === updated.id ? updated : task));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update task');
        }
    };

    const handleTaskAssignmentChange = async (taskId: string, assignmentValue: string) => {
        if (!currentOrg || !projectId) return;

        try {
            const updated = assignmentValue
                ? await projectAPI.updateTask(currentOrg.id, projectId, taskId, {
                    assigned_accessor_type: assignmentValue.startsWith('team:') ? 'team' : 'user',
                    assigned_accessor_id: assignmentValue.split(':')[1],
                })
                : await projectAPI.updateTask(currentOrg.id, projectId, taskId, { clear_assignment: true });
            setTasks(prev => prev.map(task => task.id === updated.id ? updated : task));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update task assignment');
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.deleteTask(currentOrg.id, projectId, taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete task');
        }
    };

    const handleCreateForm = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!projectId || !newFormTitle.trim()) return;
        try {
            const newForm = await formAPI.create(projectId, {
                title: newFormTitle.trim(),
                kind: newFormKind
            });
            setIsCreateFormModalOpen(false);
            setNewFormTitle('');
            setNewFormKind('standard');
            navigate(`/forms/${newForm.id}`);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create form');
        }
    };

    const handleFormResponsibilityChange = async (
        form: WorkspaceForm,
        field: 'lead' | 'assigned' | 'guest',
        value: string,
    ) => {
        const nextAccessor = parseAccessorValue(value);

        try {
            const updated = await formAPI.updateResponsibility(form.id, {
                lead_accessor_id: field === 'lead' ? nextAccessor.accessor_id : form.lead_accessor_id || null,
                lead_accessor_type: field === 'lead' ? nextAccessor.accessor_type : form.lead_accessor_type || null,
                assigned_accessor_id: field === 'assigned' ? nextAccessor.accessor_id : form.assigned_accessor_id || null,
                assigned_accessor_type: field === 'assigned' ? nextAccessor.accessor_type : form.assigned_accessor_type || null,
                guest_accessor_id: field === 'guest' ? nextAccessor.accessor_id : form.guest_accessor_id || null,
                guest_accessor_type: field === 'guest' ? nextAccessor.accessor_type : form.guest_accessor_type || null,
            });
            setForms(prev => prev.map(item => item.id === updated.id ? updated : item));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update form responsibility');
        }
    };

    const handleCreateReport = async () => {
        if (!currentOrg || !projectId) return;

        try {
            const created = await reportAPI.create(currentOrg.id, projectId, { title: 'New Report' });
            setReports(prev => [created, ...prev]);
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create report');
        }
    };



    const loadDirectoryData = async (directoryForm: WorkspaceForm) => {
        setEntriesLoading(true);
        try {
            const entries = await formAPI.getDirectoryEntries(directoryForm.id);
            setDirectoryEntries(Array.isArray(entries) ? entries.map(normalizeDirectoryEntry) : []);

            const formDetail = await formAPI.get(directoryForm.id);
            const uiFields = getDirectoryBlueprintFields(formDetail);
            setSelectedDirectoryFields(uiFields);
            setDirectoryUnpublishedFieldCount(countUnpublishedDirectoryFields(formDetail));
        } catch (err: any) {
            console.error('Failed to load directory data', err);
            showToast('Failed to load directory', err?.response?.data?.detail || err?.message || 'Could not load directory entries.', 'error');
        } finally {
            setEntriesLoading(false);
        }
    };

    const handleDirectorySelect = (directoryForm: WorkspaceForm) => {
        setSelectedDirectoryForm(directoryForm);
        loadDirectoryData(directoryForm);
    };

    const getDirectoryEntryId = (entry: any) => entry.submission_id || entry.id;

    const getDirectoryEntryDisplayName = (entry: any) => {
        if (!selectedDirectoryForm) return 'this record';
        const keyVal = entry.key_value ?? entry.data?.[selectedDirectoryForm.directory_key_field_id || ''] ?? '';
        const labelVal = entry.label_value ?? entry.data?.[selectedDirectoryForm.directory_label_field_id || ''] ?? '';
        return labelVal || keyVal || 'this record';
    };

    const executeHideDirectoryEntry = async (entry: any) => {
        if (!selectedDirectoryForm) return;

        const submissionId = getDirectoryEntryId(entry);
        await formAPI.setDirectoryEntryActive(selectedDirectoryForm.id, submissionId, false);
        setDirectoryEntries((prev) => prev.filter((item) => getDirectoryEntryId(item) !== submissionId));
    };

    const executeDeleteDirectoryEntry = async (entry: any) => {
        if (!selectedDirectoryForm) return;

        const submissionId = getDirectoryEntryId(entry);
        await formAPI.deleteDirectoryEntry(selectedDirectoryForm.id, submissionId);
        setDirectoryEntries((prev) => prev.filter((item) => getDirectoryEntryId(item) !== submissionId));
    };

    const handleDirectoryConfirm = async () => {
        if (!directoryConfirmAction) return;

        setDirectoryConfirmLoading(true);
        try {
            if (directoryConfirmAction.type === 'hide') {
                await executeHideDirectoryEntry(directoryConfirmAction.entry);
            } else {
                await executeDeleteDirectoryEntry(directoryConfirmAction.entry);
            }
            setDirectoryConfirmAction(null);
        } catch (err: any) {
            console.error('Failed to update directory entry', err);
            showToast('Action failed', err?.response?.data?.detail || err?.message || 'Failed to update directory entry.', 'error');
        } finally {
            setDirectoryConfirmLoading(false);
        }
    };

    const openDirectoryConfirm = (type: 'hide' | 'delete', entry: any, event: React.MouseEvent<HTMLButtonElement>) => {
        setDirectoryConfirmAction({
            type,
            entry,
            anchorRect: event.currentTarget.getBoundingClientRect(),
        });
    };

    const handleDirectorySaveEntry = async (data: Record<string, string>) => {
        if (!selectedDirectoryForm) return;

        await formAPI.upsertDirectoryEntry(selectedDirectoryForm.id, data);
        const entries = await formAPI.getDirectoryEntries(selectedDirectoryForm.id);
        setDirectoryEntries(Array.isArray(entries) ? entries.map(normalizeDirectoryEntry) : []);
    };



    const summariseSubmissionData = (data: Record<string, any>) => {
        const entries = Object.entries(data || {})
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .slice(0, 3)
            .map(([key, value]) => {
                if (typeof value === 'object') {
                    if (Array.isArray(value)) {
                        return `${key}: ${value.length} item${value.length === 1 ? '' : 's'}`;
                    }
                    return `${key}: object`;
                }
                return `${key}: ${String(value)}`;
            });
        return entries.length > 0 ? entries.join(' • ') : 'No preview available';
    };

    const handleReviewSubmission = async (submissionId: string, reviewStatus: 'approved' | 'rejected') => {
        try {
            await submissionAPI.review(submissionId, { review_status: reviewStatus });
            setReviewQueue(prev => prev.filter(item => item.id !== submissionId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update submission review');
        }
    };

    const handleReportUpdate = async (reportId: string, payload: Partial<ReportArtifact>) => {
        if (!currentOrg || !projectId) return;
        const current = reports.find(report => report.id === reportId);
        if (!current) return;

        try {
            const updated = await reportAPI.update(currentOrg.id, projectId, reportId, {
                title: payload.title ?? current.title,
                description: payload.description ?? current.description ?? null,
                status: payload.status ?? current.status,
                lead_accessor_id: payload.lead_accessor_id !== undefined ? payload.lead_accessor_id : current.lead_accessor_id ?? null,
                lead_accessor_type: payload.lead_accessor_type !== undefined ? payload.lead_accessor_type : current.lead_accessor_type ?? null,
                assigned_accessor_id: payload.assigned_accessor_id !== undefined ? payload.assigned_accessor_id : current.assigned_accessor_id ?? null,
                assigned_accessor_type: payload.assigned_accessor_type !== undefined ? payload.assigned_accessor_type : current.assigned_accessor_type ?? null,
                guest_accessor_id: payload.guest_accessor_id !== undefined ? payload.guest_accessor_id : current.guest_accessor_id ?? null,
                guest_accessor_type: payload.guest_accessor_type !== undefined ? payload.guest_accessor_type : current.guest_accessor_type ?? null,
            });
            setReports(prev => prev.map(report => report.id === updated.id ? updated : report));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update report');
        }
    };

    const handleDeleteReport = async (reportId: string) => {
        if (!currentOrg || !projectId) return;

        try {
            await reportAPI.delete(currentOrg.id, projectId, reportId);
            setReports(prev => prev.filter(report => report.id !== reportId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete report');
        }
    };

    const updateAutomationCondition = (index: number, patch: Partial<AutomationCondition>) => {
        setAutomationConditions((prev) => prev.map((condition, conditionIndex) => (
            conditionIndex === index ? { ...condition, ...patch } : condition
        )));
    };

    const addAutomationCondition = () => {
        setAutomationConditions((prev) => [...prev, createEmptyAutomationCondition()]);
    };

    const removeAutomationCondition = (index: number) => {
        setAutomationConditions((prev) => {
            const next = prev.filter((_, conditionIndex) => conditionIndex !== index);
            return next.length > 0 ? next : [createEmptyAutomationCondition()];
        });
    };

    const resetAutomationBuilder = () => {
        setNewAutomationRule({
            name: '',
            description: '',
            event_type: 'submission_approved',
            action_type: 'create_task',
            combinator: 'and',
            title_template: 'Follow up {{ submission.id }}',
            description_template: '',
            detail_template: '',
            severity: 'warning',
            assigned_accessor: '',
            context_mapping_json: '',
            starts_at_value: '',
            due_at_value: '',
            scheduled_date_value: '',
            is_active: true,
        });
        setAutomationConditions([createEmptyAutomationCondition()]);
    };

    const summariseAutomationRule = (rule: FormAutomationRule) => {
        const rules = rule.conditions_json?.rules || [];
        if (!rules.length) {
            return 'Runs with no conditions.';
        }
        return rules
            .map((entry) => `${entry.field || 'field'} ${entry.operator || 'equal'} ${Array.isArray(entry.value) ? entry.value.join(', ') : String(entry.value ?? '')}`.trim())
            .join(` ${String(rule.conditions_json?.combinator || 'and').toUpperCase()} `);
    };

    const summariseAutomationAction = (rule: FormAutomationRule) => {
        const config = rule.action_config_json || {};
        if (rule.action_type === 'create_alert') {
            return [
                `Alert: ${config.title_template || 'Alert for {{ submission.id }}'}`,
                `Severity: ${config.severity || 'warning'}`,
            ].join(' • ');
        }
        const assigneeLabel = config.assigned_accessor_id && config.assigned_accessor_type
            ? resolveAccessorLabel(config.assigned_accessor_id, config.assigned_accessor_type)
            : 'Unassigned';
        return [
            `Task: ${config.title_template || 'Follow up {{ submission.id }}'}`,
            `Assignee: ${assigneeLabel}`,
            config.context_mapping_json && Object.keys(config.context_mapping_json).length > 0
                ? `Context: ${Object.keys(config.context_mapping_json).length} mapped field${Object.keys(config.context_mapping_json).length === 1 ? '' : 's'}`
                : null,
            config.due_at_value ? `Due: ${config.due_at_value}` : null,
            config.scheduled_date_value ? `Scheduled: ${config.scheduled_date_value}` : null,
        ].filter(Boolean).join(' • ');
    };

    const handleCreateAutomationRule = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedAutomationFormId || !newAutomationRule.name.trim()) {
            return;
        }

        const isAlert = newAutomationRule.action_type === 'create_alert';
        const nextAccessor = parseAccessorValue(newAutomationRule.assigned_accessor);
        let contextMapping: Record<string, unknown> | undefined;
        const rawContextMapping = newAutomationRule.context_mapping_json.trim();
        if (!isAlert && rawContextMapping) {
            try {
                const parsed = JSON.parse(rawContextMapping);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    setError('Task context mapping must be a JSON object.');
                    return;
                }
                contextMapping = parsed as Record<string, unknown>;
            } catch {
                setError('Task context mapping must be valid JSON.');
                return;
            }
        }

        const cleanConditions = automationConditions
            .map((condition) => ({
                field: condition.field.trim(),
                operator: condition.operator,
                value: condition.operator === 'in'
                    ? condition.value.split(',').map((entry) => entry.trim()).filter(Boolean)
                    : condition.value.trim(),
            }))
            .filter((condition) => condition.field);

        const payload = {
            name: newAutomationRule.name.trim(),
            description: newAutomationRule.description.trim() || undefined,
            event_type: newAutomationRule.event_type,
            action_type: newAutomationRule.action_type,
            is_active: newAutomationRule.is_active,
            conditions_json: cleanConditions.length > 0
                ? {
                    combinator: newAutomationRule.combinator,
                    rules: cleanConditions,
                }
                : null,
            action_config_json: isAlert
                ? {
                    title_template: newAutomationRule.title_template.trim() || 'Alert for {{ submission.id }}',
                    detail_template: newAutomationRule.detail_template.trim()
                        || newAutomationRule.description_template.trim()
                        || undefined,
                    severity: newAutomationRule.severity || 'warning',
                }
                : {
                    title_template: newAutomationRule.title_template.trim() || 'Follow up {{ submission.id }}',
                    description_template: newAutomationRule.description_template.trim() || undefined,
                    assigned_accessor_id: nextAccessor.accessor_id || undefined,
                    assigned_accessor_type: nextAccessor.accessor_type || undefined,
                    context_mapping_json: contextMapping,
                    starts_at_value: newAutomationRule.starts_at_value || undefined,
                    due_at_value: newAutomationRule.due_at_value || undefined,
                    scheduled_date_value: newAutomationRule.scheduled_date_value || undefined,
                },
        };

        try {
            const created = await formAPI.createAutomationRule(selectedAutomationFormId, payload);
            setAutomationRules((prev) => [...prev, created]);
            resetAutomationBuilder();
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create automation rule');
        }
    };

    const handleToggleAutomationRule = async (rule: FormAutomationRule) => {
        try {
            const updated = await formAPI.updateAutomationRule(rule.form_id, rule.id, {
                is_active: !rule.is_active,
            });
            setAutomationRules((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update automation rule');
        }
    };

    const handleDeleteAutomationRule = async (rule: FormAutomationRule) => {
        try {
            await formAPI.deleteAutomationRule(rule.form_id, rule.id);
            setAutomationRules((prev) => prev.filter((entry) => entry.id !== rule.id));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete automation rule');
        }
    };

    return (
        <StudioLayout
            navMode="project"
            activeNav={shellActiveNav}
            onSelectNav={handleShellNavSelect}
            onBackToProjects={() => navigate('/dashboard?tab=projects')}
            activeDesignSection={activeTab === 'design' ? designSection : null}
            onSelectDesignSection={(section) => setWorkspaceTab('design', { section })}
            activeOpsSection={activeTab === 'ops' ? (opsView === 'attendance' || opsView === 'review' ? opsView : 'attendance') : null}
            onSelectOpsSection={(section) => {
                setWorkspaceTab('ops', { section });
            }}
            activeDataSection={
                activeTab === 'data' && dataSection !== 'analysis'
                    ? (dataSection as 'directory' | 'datasets' | 'media')
                    : null
            }
            onSelectDataSection={(section) => setWorkspaceTab('data', { section })}
            counts={{ tasks: tasks.length, forms: forms.length, data: datasets.length }}
            contentClassName="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[hsl(var(--background))] md:bg-[#f9fafb] dark:md:bg-[hsl(var(--background))]"
        >
            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))]" />
                </div>
            ) : error ? (
                <div className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 p-6 text-[hsl(var(--text-primary))]">
                    <div className="mb-2 flex items-center gap-3 text-[hsl(var(--error))]">
                        <AlertCircle className="h-5 w-5" />
                        <h2 className="text-base font-semibold">Workspace unavailable</h2>
                    </div>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">{error}</p>
                </div>
            ) : currentProject ? (
                <div className="mx-auto max-w-[1600px] space-y-6">
                    {/* Header Section */}
                    <div className="space-y-1 px-2">
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                {currentProject.name}
                            </h1>
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[currentProject.status] || statusTone.planning}`}>
                                {currentProject.status}
                            </span>
                        </div>
                        <p className="text-sm text-[hsl(var(--text-secondary))] max-w-2xl">
                            {currentProject.description || 'Manage forms, tasks, data, and team access.'}
                        </p>
                    </div>

                    {/* Tab Views — destinations owned by project sidebar */}
                    <div className="mt-2">
                        {/* 1. DESIGN — Forms */}
                        {activeTab === 'design' && designSection === 'forms' && (
                            <FormsDesignPanel
                                forms={forms}
                                teamsWithAccess={
                                    new Set(
                                        accessRules
                                            .filter((rule) => rule.accessor_type === 'team')
                                            .map((rule) => rule.accessor_id),
                                    ).size
                                }
                                onCreate={() => {
                                    setNewFormKind('standard');
                                    setIsCreateFormModalOpen(true);
                                }}
                                onOpen={(formId) => navigate(`/forms/${formId}`)}
                                onSimulate={(formId) => navigate(`/simulator/${formId}`)}
                                onOpenMedia={openFormMedia}
                            />
                        )}

                        {/* 1b. DESIGN — Automations */}
                        {activeTab === 'design' && designSection === 'automations' && (
                            <div className="space-y-6">
                                <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <Play className="h-4 w-4 fill-current" />
                                                </div>
                                                <div>
                                                    <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Automation Rules</h2>
                                                    <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Submission events that create tasks or Needs Attention alerts</p>
                                                </div>
                                            </div>
                                            <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                {automationRules.length}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-4 p-4 lg:p-5">
                                            <div>
                                                <label className="label">Automation Form</label>
                                                <select
                                                    value={selectedAutomationFormId}
                                                    onChange={(event) => setSelectedAutomationFormId(event.target.value)}
                                                    className="input py-2"
                                                >
                                                    {forms.length === 0 ? (
                                                        <option value="">No forms available</option>
                                                    ) : forms.map((form) => (
                                                        <option key={`automation-form-${form.id}`} value={form.id}>
                                                            {form.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {selectedAutomationForm ? (
                                                <form onSubmit={handleCreateAutomationRule} className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <div>
                                                            <label className="label">Rule Name</label>
                                                            <input
                                                                value={newAutomationRule.name}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, name: event.target.value }))}
                                                                className="input"
                                                                placeholder="Approved records create scheduled task"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="label">Event</label>
                                                            <select
                                                                value={newAutomationRule.event_type}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, event_type: event.target.value as FormAutomationEvent }))}
                                                                className="input py-2"
                                                            >
                                                                {automationEventOptions.map((option) => (
                                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <div>
                                                            <label className="label">Action</label>
                                                            <select
                                                                value={newAutomationRule.action_type}
                                                                onChange={(event) => {
                                                                    const next = event.target.value as FormAutomationAction;
                                                                    setNewAutomationRule((prev) => ({
                                                                        ...prev,
                                                                        action_type: next,
                                                                        title_template: next === 'create_alert'
                                                                            ? (prev.title_template.startsWith('Follow up') ? 'Alert for {{ submission.id }}' : prev.title_template)
                                                                            : (prev.title_template.startsWith('Alert for') ? 'Follow up {{ submission.id }}' : prev.title_template),
                                                                    }));
                                                                }}
                                                                className="input py-2"
                                                            >
                                                                {automationActionOptions.map((option) => (
                                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {newAutomationRule.action_type === 'create_alert' ? (
                                                            <div>
                                                                <label className="label">Severity</label>
                                                                <select
                                                                    value={newAutomationRule.severity}
                                                                    onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, severity: event.target.value }))}
                                                                    className="input py-2"
                                                                >
                                                                    {automationSeverityOptions.map((option) => (
                                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ) : (
                                                            <div />
                                                        )}
                                                    </div>

                                                    <div>
                                                        <label className="label">Description</label>
                                                        <input
                                                            value={newAutomationRule.description}
                                                            onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, description: event.target.value }))}
                                                            className="input"
                                                            placeholder="Creates a scheduled task when a reviewed record matches the rule"
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <label className="label">Conditions</label>
                                                            <div className="flex items-center gap-2">
                                                                <select
                                                                    value={newAutomationRule.combinator}
                                                                    onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, combinator: event.target.value as 'and' | 'or' }))}
                                                                    className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-[11px] font-semibold text-[hsl(var(--text-secondary))]"
                                                                >
                                                                    <option value="and">Match all</option>
                                                                    <option value="or">Match any</option>
                                                                </select>
                                                                <button type="button" onClick={addAutomationCondition} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2.5 py-1 text-[11px] font-semibold text-[hsl(var(--text-secondary))]">
                                                                    Add condition
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {automationConditions.map((condition, index) => (
                                                            <div key={`automation-condition-${index}`} className="grid grid-cols-1 gap-2 md:grid-cols-[1.6fr_1fr_1.4fr_auto]">
                                                                <input
                                                                    value={condition.field}
                                                                    onChange={(event) => updateAutomationCondition(index, { field: event.target.value })}
                                                                    className="input"
                                                                    placeholder="data.region"
                                                                />
                                                                <select
                                                                    value={condition.operator}
                                                                    onChange={(event) => updateAutomationCondition(index, { operator: event.target.value })}
                                                                    className="input py-2"
                                                                >
                                                                    {automationOperatorOptions.map((option) => (
                                                                        <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
                                                                    ))}
                                                                </select>
                                                                <input
                                                                    value={condition.value}
                                                                    onChange={(event) => updateAutomationCondition(index, { value: event.target.value })}
                                                                    className="input"
                                                                    placeholder={condition.operator === 'in' ? 'north, south' : 'Expected value'}
                                                                />
                                                                <button type="button" onClick={() => removeAutomationCondition(index)} className="rounded-md px-2 py-2 text-[11px] font-semibold text-[hsl(var(--text-tertiary))] hover:bg-[hsl(var(--surface-elevated))]">
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                                            Paths can reference submission metadata such as <span className="font-mono">submission.review_status</span>, <span className="font-mono">context.project_id</span>, or form data like <span className="font-mono">data.region</span> or <span className="font-mono">data.week_number</span>.
                                                        </p>
                                                    </div>

                                                    {newAutomationRule.action_type === 'create_alert' ? (
                                                        <>
                                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                                <div>
                                                                    <label className="label">Alert Title Template</label>
                                                                    <input
                                                                        value={newAutomationRule.title_template}
                                                                        onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, title_template: event.target.value }))}
                                                                        className="input"
                                                                        placeholder="Alert for {{ submission.id }}"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="label">Alert Detail Template</label>
                                                                    <input
                                                                        value={newAutomationRule.detail_template}
                                                                        onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, detail_template: event.target.value }))}
                                                                        className="input"
                                                                        placeholder="Flagged {{ data.region }} needs follow-up"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">
                                                                Alerts appear in ProjectHub Needs Attention. Provenance shows the automation rule name. Deduped once per rule + submission.
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <>
                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <div>
                                                            <label className="label">Task Title Template</label>
                                                            <input
                                                                value={newAutomationRule.title_template}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, title_template: event.target.value }))}
                                                                className="input"
                                                                placeholder="Follow up {{ submission.id }}"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="label">Assign To</label>
                                                            <select
                                                                value={newAutomationRule.assigned_accessor}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, assigned_accessor: event.target.value }))}
                                                                className="input py-2"
                                                            >
                                                                <option value="">Leave unassigned</option>
                                                                {assignmentOptions.map((option) => (
                                                                    <option key={`automation-accessor-${option.type}-${option.id}`} value={`${option.type}:${option.id}`}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="label">Task Description Template</label>
                                                        <input
                                                            value={newAutomationRule.description_template}
                                                            onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, description_template: event.target.value }))}
                                                            className="input"
                                                            placeholder="Triggered from {{ submission.id }} for {{ data.region }}"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="label">Task Context Mapping (JSON)</label>
                                                        <textarea
                                                            value={newAutomationRule.context_mapping_json}
                                                            onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, context_mapping_json: event.target.value }))}
                                                            className="input min-h-[120px] font-mono text-[11px]"
                                                            placeholder={"{\n  \"source_record_label\": \"data.roommate_name\",\n  \"location_label\": \"{{ data.region }} cluster\",\n  \"routing.cluster\": \"data.cluster\"\n}"}
                                                        />
                                                        <p className="mt-1 text-[10px] text-[hsl(var(--text-tertiary))]">
                                                            Optional. Values can be event paths such as <span className="font-mono">data.region</span> or templates such as <span className="font-mono">{'{{ data.roommate_name }}'}</span>. Dot keys create nested task context.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                                        <div>
                                                            <label className="label">Start At</label>
                                                            <input
                                                                type="datetime-local"
                                                                value={newAutomationRule.starts_at_value}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, starts_at_value: event.target.value }))}
                                                                className="input"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="label">Due At</label>
                                                            <input
                                                                type="datetime-local"
                                                                value={newAutomationRule.due_at_value}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, due_at_value: event.target.value }))}
                                                                className="input"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="label">Scheduled Date</label>
                                                            <input
                                                                type="date"
                                                                value={newAutomationRule.scheduled_date_value}
                                                                onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, scheduled_date_value: event.target.value }))}
                                                                className="input"
                                                            />
                                                        </div>
                                                    </div>
                                                        </>
                                                    )}

                                                    <label className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--text-secondary))]">
                                                        <input
                                                            type="checkbox"
                                                            checked={newAutomationRule.is_active}
                                                            onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, is_active: event.target.checked }))}
                                                            className="h-4 w-4"
                                                        />
                                                        Activate rule immediately
                                                    </label>

                                                    <div className="flex items-center justify-end gap-2">
                                                        <button type="button" onClick={resetAutomationBuilder} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs font-semibold text-[hsl(var(--text-secondary))]">
                                                            Reset
                                                        </button>
                                                        <button type="submit" className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white">
                                                            Save Rule
                                                        </button>
                                                    </div>
                                                </form>
                                            ) : (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">
                                                    Create a form first to configure automation.
                                                </p>
                                            )}

                                            {automationLoading ? (
                                                <div className="flex items-center justify-center py-4">
                                                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-[hsl(var(--primary))]/30 border-t-[hsl(var(--primary))]" />
                                                </div>
                                            ) : automationRules.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">
                                                    No automation rules configured for this form.
                                                </p>
                                            ) : automationRules.map((rule) => (
                                                <div key={rule.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{rule.name}</h3>
                                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rule.is_active ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'}`}>
                                                                    {rule.is_active ? 'Active' : 'Paused'}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                                {automationEventOptions.find((option) => option.value === rule.event_type)?.label || rule.event_type}
                                                                {' · '}
                                                                {automationActionOptions.find((option) => option.value === rule.action_type)?.label || rule.action_type}
                                                            </p>
                                                            {rule.description && (
                                                                <p className="mt-1 text-xs text-[hsl(var(--text-secondary))]">{rule.description}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleToggleAutomationRule(rule)} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--text-secondary))]">
                                                                {rule.is_active ? 'Pause' : 'Activate'}
                                                            </button>
                                                            <button onClick={() => handleDeleteAutomationRule(rule)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[hsl(var(--text-tertiary))] transition-colors hover:bg-[hsl(var(--error))]/10 hover:text-[hsl(var(--error))]">
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 space-y-2 border-t border-[hsl(var(--border))]/50 pt-3 text-[11px] text-[hsl(var(--text-secondary))]">
                                                        <p><span className="font-semibold text-[hsl(var(--text-primary))]">When:</span> {summariseAutomationRule(rule)}</p>
                                                        <p><span className="font-semibold text-[hsl(var(--text-primary))]">Then:</span> {summariseAutomationAction(rule)}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                            </div>
                        )}

                        {/* 2. OPS — mock Attendance + Review */}
                        {activeTab === 'ops' && opsView === 'attendance' && (
                            <OpsAttendanceMock projectName={currentProject.name} />
                        )}
                        {activeTab === 'ops' && opsView === 'review' && (
                            <OpsReviewMock projectName={currentProject.name} />
                        )}

                        {activeTab === 'tasks' && (

                            <div className="space-y-6">
                                    <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <SquareCheckBig className="h-4 w-4" />
                                                </div>
                                                <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Tasks</h2>
                                            </div>
                                            <button onClick={() => navigate('/dashboard?tab=tasks')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                                <Plus className="h-4 w-4" />
                                                <span className="text-xs font-semibold">New</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3 p-4 lg:p-5">
                                            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                                    <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                                                        <div>
                                                            <label className="label">Plan Day</label>
                                                            <input
                                                                type="date"
                                                                value={taskPlannerDate}
                                                                onChange={(event) => setTaskPlannerDate(event.target.value)}
                                                                className="input"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="label">Assignee</label>
                                                            <select
                                                                value={taskPlannerAssignee}
                                                                onChange={(event) => setTaskPlannerAssignee(event.target.value)}
                                                                className="input py-2"
                                                            >
                                                                <option value="">All assignees</option>
                                                                {salespersonOptions.map((option) => (
                                                                    <option key={`task-filter-${option.type}-${option.id}`} value={`${option.type}:${option.id}`}>
                                                                        {option.label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="label">Task Source</label>
                                                            <select
                                                                value={taskPlannerSource}
                                                                onChange={(event) => setTaskPlannerSource(event.target.value as 'all' | 'manual' | 'automated')}
                                                                className="input py-2"
                                                            >
                                                                <option value="all">All tasks</option>
                                                                <option value="manual">Manual only</option>
                                                                <option value="automated">Automation only</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTaskPlannerDate('');
                                                            setTaskPlannerAssignee('');
                                                            setTaskPlannerSource('all');
                                                        }}
                                                        className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-xs font-semibold text-[hsl(var(--text-secondary))]"
                                                    >
                                                        Clear filters
                                                    </button>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.total} shown</span>
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.todo} todo</span>
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.inProgress} in progress</span>
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.done} done</span>
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.manual} manual</span>
                                                    <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{filteredTaskCounts.automated} automated</span>
                                                </div>
                                            </div>
                                            {tasks.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No tasks yet.</p>
                                            ) : filteredTasks.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No tasks match the selected planner filters.</p>
                                            ) : filteredTasks.map(task => (
                                                <div key={task.id} className={`group relative rounded-md border p-3 transition-shadow hover:shadow-md block ${task.status === 'done' ? 'border-[hsl(var(--border))] bg-[hsl(var(--background))]/50 opacity-75' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}>
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={task.status === 'done'}
                                                            onChange={(e) => handleTaskStatusChange(task.id, e.target.checked ? 'done' : 'todo')}
                                                            className="mt-1 h-4 w-4 rounded border-[hsl(var(--border))] bg-[hsl(var(--surface))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] cursor-pointer shrink-0"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {getTaskSourceRecordLabel(task) && (
                                                                    <span className="inline-flex rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                                                                        {getTaskSourceRecordLabel(task)}
                                                                    </span>
                                                                )}
                                                                <h3 className={`text-sm font-semibold leading-tight text-[hsl(var(--text-primary))] ${task.status === 'done' ? 'line-through text-[hsl(var(--text-tertiary))]' : ''}`}>
                                                                    {task.title}
                                                                </h3>
                                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isAutomatedTask(task) ? 'bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border border-[hsl(var(--primary))]/20' : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))]'}`}>
                                                                    {isAutomatedTask(task) ? 'Automated' : 'Manual'}
                                                                </span>
                                                                {task.kind === 'field_visit' && (
                                                                    <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                                                        Scheduled Visit
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isAutomatedTask(task) && (
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                                    Created from submission workflow.
                                                                </p>
                                                            )}
                                                            {!isAutomatedTask(task) && (
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                                    Managed directly in Studio.
                                                                </p>
                                                            )}
                                                            {task.starts_at && (
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                                                                    Starts {new Date(task.starts_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {task.scheduled_date && (
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                                                                    Scheduled {new Date(task.scheduled_date).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                            {getTaskContextSummary(task) && (
                                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                                                                    Context {getTaskContextSummary(task)}
                                                                </p>
                                                            )}
                                                            {task.due_at && (
                                                                <p className="mt-1 text-[11px] font-medium text-orange-500/80">
                                                                    Due {new Date(task.due_at).toLocaleDateString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0" title={resolveTaskAssigneeLabel(task)}>
                                                                {resolveTaskAssigneeLabel(task).charAt(0).toUpperCase()}
                                                            </div>
                                                            <select
                                                                value={getTaskAssignmentValue(task)}
                                                                onChange={(e) => handleTaskAssignmentChange(task.id, e.target.value)}
                                                                className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-20 truncate"
                                                            >
                                                                <option value="">Unassigned</option>
                                                                {assignmentOptions.map(opt => <option key={`task-assign-${task.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                            </select>
                                                        </div>
                                                        <button onClick={() => handleDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold transition-opacity rounded bg-[hsl(var(--error))]/5">
                                                            Del
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                            </div>

                        )}

                        {/* 4. DATA — section chosen from sidebar */}
                        {activeTab === 'data' && dataSection === 'analysis' && (
                            <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 text-center text-sm text-[hsl(var(--text-secondary))]">
                                Open Analysis from the org Data tab in the sidebar, or use the project hub for spatial insights.
                            </div>
                        )}

                        {activeTab === 'data' && dataSection === 'datasets' && (
                            <div className="grid gap-6 lg:grid-cols-12 items-start">
                                <div className="lg:col-span-12 space-y-6">
                                    <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <Database className="h-4 w-4" />
                                                </div>
                                                <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Datasets</h2>
                                            </div>
                                            <button onClick={() => navigate('/dashboard?tab=data&section=datasets')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                                <ChevronRight className="h-4 w-4" />
                                                <span className="text-xs font-semibold">View all</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3 p-4 lg:p-5">
                                            {datasets.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No datasets yet.</p>
                                            ) : datasets.map(dataset => (
                                                <div key={dataset.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{dataset.name}</h3>
                                                            <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{dataset.records_count.toLocaleString()} rows • {new Date(dataset.updated_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${dataset.status === 'active' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-300 border border-slate-500/20'}`}>
                                                            {dataset.status}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 flex items-center justify-end pt-3 border-t border-[hsl(var(--border))]/50">
                                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 flex-wrap">
                                                            <button className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                                <ChevronRight className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'data' && dataSection === 'media' && (
                            <div className="grid gap-6 lg:grid-cols-12 items-start">
                                <div className="lg:col-span-12 space-y-6">
                                    <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                    <Paperclip className="h-4 w-4" />
                                                </div>
                                                <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Media</h2>
                                            </div>
                                            <button onClick={() => navigate('/dashboard?tab=data&section=media')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                                <Plus className="h-4 w-4" />
                                                <span className="text-xs font-semibold">New</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-3 p-4 lg:p-5">
                                            {assets.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No media yet.</p>
                                            ) : assets.map(asset => (
                                                <div key={asset.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{asset.title}</h3>
                                                            <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{asset.kind} • {new Date(asset.updated_at).toLocaleDateString()}</p>
                                                        </div>
                                                        <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                            {asset.kind}
                                                        </span>
                                                    </div>
                                                    <p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">{asset.summary}</p>
                                                    <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                        Placeholder: previews, uploads, and link attachments will be managed here.
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {/* 5. DIRECTORY WORKSPACE */}
                        {activeTab === 'data' && dataSection === 'directory' && (
                            <div className="grid gap-6 lg:grid-cols-12 items-start min-h-[calc(100vh-12rem)]">
                                <div className="lg:col-span-3">
                                    <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden sticky top-4">
                                        <div className="border-b border-[hsl(var(--border))] p-4 lg:p-5 flex items-center justify-between">
                                            <div>
                                                <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Directory Sources</h2>
                                                <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Forms configured as reference databases</p>
                                            </div>
                                            <button
                                                onClick={() => setIsCreateFormModalOpen(true)}
                                                className="flex items-center gap-1 text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-colors px-2 py-1 rounded-lg border border-[hsl(var(--primary))]/30 text-xs font-semibold"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> New Directory
                                            </button>
                                        </div>
                                        <div className="p-4 lg:p-5 flex flex-col gap-3">
                                            {forms.filter(f => f.kind === 'directory').length === 0 ? (
                                                <div className="text-center py-6 bg-[hsl(var(--background))] rounded-xl border border-dashed border-[hsl(var(--border))] text-sm text-[hsl(var(--text-tertiary))]">
                                                    No directory forms created yet. Click New Directory to begin.
                                                </div>
                                            ) : (
                                                forms.filter(f => f.kind === 'directory').map(catForm => {
                                                    const isSelected = selectedDirectoryForm?.id === catForm.id;
                                                    const hasDesignations = catForm.directory_key_field_id && catForm.directory_label_field_id;
                                                    return (
                                                        <div
                                                            key={catForm.id}
                                                            onClick={() => handleDirectorySelect(catForm)}
                                                            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                                                isSelected
                                                                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-sm'
                                                                    : 'border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--surface-elevated))]/30'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <h3 className="text-xs font-bold text-[hsl(var(--text-primary))]">{catForm.title}</h3>
                                                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider ${formStatusTone[catForm.status] || formStatusTone.draft}`}>
                                                                    {catForm.status}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2.5 space-y-1 text-[10px] text-[hsl(var(--text-tertiary))]">
                                                                {hasDesignations ? (
                                                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                                                        <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                                                                            ⚿ Key: {catForm.directory_key_field_id}
                                                                        </span>
                                                                        <span className="bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded border border-blue-500/20 font-medium">
                                                                            🏷 Label: {catForm.directory_label_field_id}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-rose-500 font-semibold flex items-center gap-1">
                                                                        ⚠️ Key/Label not set in builder
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </section>
                                </div>

                                <div className="lg:col-span-9 flex flex-col min-h-0">
                                    <section className="flex flex-col flex-1 rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden min-h-[500px]">
                                        {!selectedDirectoryForm ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
                                                <div className="w-14 h-14 rounded-full bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))]/40 flex items-center justify-center text-[hsl(var(--text-tertiary))] mb-4 shadow-sm">
                                                    <Database className="w-6 h-6" />
                                                </div>
                                                <h3 className="text-sm font-bold text-[hsl(var(--text-primary))]">No Directory Selected</h3>
                                                <p className="text-[11px] text-[hsl(var(--text-tertiary))] max-w-[280px] mt-1 leading-normal">
                                                    Select a directory on the left to view and edit records in the spreadsheet grid.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5 shrink-0">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                            <Database className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <h2 className="text-base font-semibold text-[hsl(var(--text-primary))]">{selectedDirectoryForm.title}</h2>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))]">Edit inline — suggestions come from values in each column</p>
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                        {directoryEntries.length} Records
                                                    </span>
                                                </div>
                                                <DirectoryGrid
                                                    formId={selectedDirectoryForm.id}
                                                    directoryTitle={selectedDirectoryForm.title}
                                                    directoryStatus={selectedDirectoryForm.status}
                                                    keyFieldId={selectedDirectoryForm.directory_key_field_id}
                                                    labelFieldId={selectedDirectoryForm.directory_label_field_id}
                                                    fields={selectedDirectoryFields}
                                                    entries={directoryEntries}
                                                    loading={entriesLoading}
                                                    unpublishedFieldCount={directoryUnpublishedFieldCount}
                                                    onSaveEntry={handleDirectorySaveEntry}
                                                    onHideEntry={(entry, event) => openDirectoryConfirm('hide', entry, event)}
                                                    onDeleteEntry={(entry, event) => openDirectoryConfirm('delete', entry, event)}
                                                    onNotify={showToast}
                                                />
                                            </>
                                        )}
                                    </section>
                                </div>
                            </div>
                        )}

                        {directoryConfirmAction && selectedDirectoryForm && (
                            <ConfirmPopover
                                open
                                anchorRect={directoryConfirmAction.anchorRect}
                                title={
                                    directoryConfirmAction.type === 'delete'
                                        ? `Delete "${getDirectoryEntryDisplayName(directoryConfirmAction.entry)}"?`
                                        : `Hide "${getDirectoryEntryDisplayName(directoryConfirmAction.entry)}"?`
                                }
                                description={
                                    directoryConfirmAction.type === 'delete'
                                        ? 'This permanently removes all versions of this record. This cannot be undone.'
                                        : 'This hides the record from lookups. You can restore it by adding the same key again.'
                                }
                                confirmLabel={directoryConfirmAction.type === 'delete' ? 'Delete' : 'Hide'}
                                variant={directoryConfirmAction.type === 'delete' ? 'danger' : 'default'}
                                loading={directoryConfirmLoading}
                                onConfirm={handleDirectoryConfirm}
                                onCancel={() => setDirectoryConfirmAction(null)}
                            />
                        )}

                        {activeTab === 'messages' && currentOrg?.id && (
                            <div className="mx-auto max-w-5xl space-y-6">
                                <ProjectThreadsPanel
                                    orgId={currentOrg.id}
                                    projectId={projectId}
                                    canEditProject={Boolean(
                                        accessRules.some(
                                            (rule) =>
                                                rule.accessor_type === 'user' &&
                                                rule.accessor_id === user?.id &&
                                                rule.role === 'editor',
                                        ),
                                    )}
                                    initialThreadId={searchParams.get('channel') || searchParams.get('thread')}
                                />
                            </div>
                        )}

                        {/* 5. REPORTS WORKSPACE */}
                        {activeTab === 'reports' && (
                            <div className="mx-auto max-w-xl rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 text-center shadow-sm">
                                <FileBarChart2 className="mx-auto h-10 w-10 text-[hsl(var(--primary))]" />
                                <h2 className="mt-4 text-xl font-semibold text-[hsl(var(--text-primary))]">Reports moved to org</h2>
                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
                                    Stakeholder boards live outside projects so seniors can combine sources and get Team grants without field Ops access.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/dashboard?tab=reports')}
                                    className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white"
                                >
                                    Open Reports
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className="max-w-3xl mx-auto space-y-6">
                                <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                                <Users className="h-4 w-4" />
                                            </div>
                                            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Members</h2>
                                        </div>
                                    </div>
                                    <div className="p-4 lg:p-5 flex flex-col gap-4">
                                        <form onSubmit={handleGrantAccess} className="flex flex-col sm:flex-row gap-2">
                                            <select
                                                value={accessorId}
                                                onChange={(e) => setAccessorId(e.target.value)}
                                                className="flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-xs text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                            >
                                                <option value="">Add member...</option>
                                                {selectableAccessors.map(opt => <option key={`add-mem-${opt.id}`} value={opt.id}>{opt.label}</option>)}
                                            </select>
                                            <div className="flex gap-2">
                                                <select
                                                    value={roleTemplateId}
                                                    onChange={(e) => setRoleTemplateId(e.target.value)}
                                                    className="flex-1 sm:w-20 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-2 text-[11px] text-[hsl(var(--text-primary))] focus:ring-1 focus:ring-[hsl(var(--primary))]"
                                                >
                                                    {roleTemplates.map(rt => <option key={`add-role-${rt.id}`} value={rt.id}>{businessRoleLabelBySlug[rt.slug] || rt.name}</option>)}
                                                </select>
                                                <button type="submit" disabled={!accessorId || !roleTemplateId} className="w-14 sm:w-auto shrink-0 rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[hsl(var(--primary-hover))] shadow-sm">
                                                    Add
                                                </button>
                                            </div>
                                        </form>

                                        <div className="space-y-2">
                                            {accessRules.length === 0 ? (
                                                <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-2">No members.</p>
                                            ) : accessRules.map(rule => (
                                                <div key={`member-rule-${rule.id}`} className="group flex items-center justify-between rounded-md p-2.5 hover:bg-[hsl(var(--background))] transition-colors border border-transparent hover:border-[hsl(var(--border))]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                                                            {resolveRuleLabel(rule).charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0 pr-2">
                                                            <p className="text-sm font-semibold text-[hsl(var(--text-primary))] leading-tight truncate">{resolveRuleLabel(rule)}</p>
                                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-widest mt-0.5">{getBusinessRoleLabel(rule)}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleRevokeAccess(rule)} className="opacity-0 group-hover:opacity-100 py-1.5 px-2.5 rounded bg-[hsl(var(--error))]/5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold transition-opacity shrink-0">
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {isCreateFormModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-[hsl(var(--border))] flex items-center justify-between">
                            <h3 className="text-base font-bold text-[hsl(var(--text-primary))]">Create New Form</h3>
                            <button
                                onClick={() => {
                                    setIsCreateFormModalOpen(false);
                                    setNewFormTitle('');
                                    setNewFormKind('standard');
                                }}
                                className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-primary))] text-sm"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleCreateForm} className="p-5 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                    Form Title
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g., Equipment Checklist or Material Directory"
                                    value={newFormTitle}
                                    onChange={(e) => setNewFormTitle(e.target.value)}
                                    className="w-full text-sm px-3 py-2 bg-[hsl(var(--background))] rounded-lg border border-[hsl(var(--border))]/60 outline-none text-[hsl(var(--text-primary))] placeholder-[hsl(var(--text-tertiary))]/70 focus:border-[hsl(var(--primary))]/60 focus:ring-2 focus:ring-[hsl(var(--primary))]/10 transition-all shadow-inner"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-secondary))]">
                                    Select Form Type
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div
                                        onClick={() => setNewFormKind('standard')}
                                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                                            newFormKind === 'standard'
                                                ? 'border-emerald-500 bg-emerald-500/5 shadow-md shadow-emerald-500/5'
                                                : 'border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--surface-elevated))]/30'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            newFormKind === 'standard'
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'
                                        }`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[hsl(var(--text-primary))]">Standard Form</p>
                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-0.5 leading-normal">
                                                Standard flow for surveys, signatures, pictures, checklist workflows and audits.
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        onClick={() => setNewFormKind('directory')}
                                        className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                                            newFormKind === 'directory'
                                                ? 'border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/5'
                                                : 'border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--surface-elevated))]/30'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                            newFormKind === 'directory'
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-secondary))]'
                                        }`}>
                                            <Database className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-[hsl(var(--text-primary))] flex items-center gap-1.5">
                                                Directory Form
                                                <span className="text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                                    Reference
                                                </span>
                                            </p>
                                            <p className="text-[10px] text-[hsl(var(--text-tertiary))] mt-0.5 leading-normal">
                                                Restricted fields. Serves as lookup reference data (unique Key field required).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateFormModalOpen(false);
                                        setNewFormTitle('');
                                        setNewFormKind('standard');
                                        if (projectId) navigate(`/projects/${projectId}/ai-survey`);
                                    }}
                                    className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[hsl(var(--border))]/60 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/60 transition-colors"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                                    Create with AI
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateFormModalOpen(false);
                                        setNewFormTitle('');
                                        setNewFormKind('standard');
                                    }}
                                    className="px-3 py-2 rounded-lg border border-[hsl(var(--border))]/60 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]/60 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white text-xs font-semibold shadow-sm transition-colors"
                                >
                                    Create Form
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </StudioLayout>
    );
};

export default ProjectWorkspace;