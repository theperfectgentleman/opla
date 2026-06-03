import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    AlertCircle,
    ChevronRight,
    FileBarChart2,
    FileText,
    CheckCircle2,
    MessageSquare,
    Paperclip,
    Play,
    Plus,
    SquareCheckBig,
    Users,
    Database,
    XCircle,
    MapPin,
} from 'lucide-react';

import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { formAPI, projectAPI, reportAPI, submissionAPI, teamAPI } from '../lib/api';

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

type CatalogItem = {
    id: string;
    project_id: string;
    sku_code: string;
    label: string;
    default_price?: number | null;
    unit?: string | null;
    brand?: string | null;
    is_active: boolean;
    price_editable: boolean;
    created_at: string;
    updated_at: string;
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
    kind: 'general' | 'journey_visit';
    status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
    starts_at?: string;
    due_at?: string;
    visit_date?: string;
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

type FormAutomationAction = 'create_task';

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

const ProjectWorkspace: React.FC = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const {
        currentOrg,
        currentProject,
        members,
        refreshCurrentProject,
        setCurrentProject,
    } = useOrg();

    const [forms, setForms] = useState<WorkspaceForm[]>([]);
    const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
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
        combinator: 'and' as 'and' | 'or',
        title_template: 'Follow up {{ submission.id }}',
        description_template: '',
        assigned_accessor: '',
        context_mapping_json: '',
        starts_at_value: '',
        due_at_value: '',
        visit_date_value: '',
        is_active: true,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accessorId, setAccessorId] = useState('');
    const [roleTemplateId, setRoleTemplateId] = useState('');
    const [taskPlannerDate, setTaskPlannerDate] = useState(() => formatDateKey(new Date()));
    const [taskPlannerAssignee, setTaskPlannerAssignee] = useState('');
    const [taskPlannerSource, setTaskPlannerSource] = useState<'all' | 'manual' | 'automated'>('all');
    const [newCatalogItem, setNewCatalogItem] = useState({
        sku_code: '',
        label: '',
        default_price: '',
        unit: '',
        brand: '',
    });
    const attendanceDay = useMemo(() => formatDateKey(new Date()), []);

    const [datasets] = useState<WorkspaceDataset[]>([
        { id: 'ds-1', name: 'Customer Feedback', records_count: 1240, updated_at: new Date().toISOString(), status: 'active' },
        { id: 'ds-2', name: 'Site Inspections 2024', records_count: 85, updated_at: new Date().toISOString(), status: 'active' },
    ]);
    const [threads] = useState<WorkspaceThread[]>([
        {
            id: 'thread-kickoff',
            title: 'Project kickoff channel',
            summary: 'Use this thread for launch notices, @mentions, and decisions that should stay attached to the project.',
            reply_count: 12,
            updated_at: new Date().toISOString(),
        },
        {
            id: 'thread-escalations',
            title: 'Escalations and blockers',
            summary: 'Operational issue lane for field blockers, supervisor escalations, and rapid follow-up.',
            reply_count: 4,
            updated_at: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
        },
    ]);
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
                const [project, projectForms, projectTasks, projectAttendance, projectReports, projectAccess, orgTeams, templates, projectCatalogItems] = await Promise.all([
                    refreshCurrentProject(currentOrg.id, projectId),
                    formAPI.list(projectId),
                    projectAPI.listTasks(currentOrg.id, projectId),
                    projectAPI.listAttendance(currentOrg.id, projectId, attendanceDay),
                    reportAPI.list(currentOrg.id, projectId),
                    projectAPI.listAccess(currentOrg.id, projectId),
                    teamAPI.list(currentOrg.id),
                    projectAPI.listRoleTemplates(currentOrg.id),
                    projectAPI.listCatalogItems(currentOrg.id, projectId),
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
                setCatalogItems(projectCatalogItems);
                setReviewQueue(pendingReviews);
                setTasks(projectTasks);
                setAttendanceRecords(projectAttendance);
                setReports(projectReports);
                setAccessRules(projectAccess);
                setTeams(orgTeams);
                setRoleTemplates(templates);
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

            const taskDates = [task.starts_at, task.due_at, task.visit_date]
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


    const handleShellNavSelect = (key: 'projects' | 'forms' | 'members' | 'audience' | 'analysis' | 'threads' | 'assets' | 'reports' | 'settings' | 'tasks' | string) => {
        navigate(`/dashboard?tab=${key}`);
    };

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

    const handleCreateForm = async () => {
        if (!projectId) return;
        try {
            const newForm = await formAPI.create(projectId, { title: 'New Form' });
            navigate(`/builder/${newForm.id}`);
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

    const handleCreateCatalogItem = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!currentOrg || !projectId || !newCatalogItem.sku_code.trim() || !newCatalogItem.label.trim()) return;

        try {
            const created = await projectAPI.createCatalogItem(currentOrg.id, projectId, {
                sku_code: newCatalogItem.sku_code.trim(),
                label: newCatalogItem.label.trim(),
                default_price: newCatalogItem.default_price ? Number(newCatalogItem.default_price) : undefined,
                unit: newCatalogItem.unit.trim() || undefined,
                brand: newCatalogItem.brand.trim() || undefined,
            });
            setCatalogItems(prev => [...prev, created].sort((left, right) => left.label.localeCompare(right.label)));
            setNewCatalogItem({ sku_code: '', label: '', default_price: '', unit: '', brand: '' });
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to create catalog item');
        }
    };

    const handleCatalogItemToggle = async (item: CatalogItem, patch: { is_active?: boolean; price_editable?: boolean }) => {
        if (!currentOrg || !projectId) return;

        try {
            const updated = await projectAPI.updateCatalogItem(currentOrg.id, projectId, item.id, patch);
            setCatalogItems(prev => prev.map(entry => entry.id === updated.id ? updated : entry));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to update catalog item');
        }
    };

    const handleDeleteCatalogItem = async (itemId: string) => {
        if (!currentOrg || !projectId) return;

        try {
            await projectAPI.deleteCatalogItem(currentOrg.id, projectId, itemId);
            setCatalogItems(prev => prev.filter(item => item.id !== itemId));
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Failed to delete catalog item');
        }
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
            combinator: 'and',
            title_template: 'Follow up {{ submission.id }}',
            description_template: '',
            assigned_accessor: '',
            context_mapping_json: '',
            starts_at_value: '',
            due_at_value: '',
            visit_date_value: '',
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
            config.visit_date_value ? `Scheduled: ${config.visit_date_value}` : null,
        ].filter(Boolean).join(' • ');
    };

    const handleCreateAutomationRule = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedAutomationFormId || !newAutomationRule.name.trim()) {
            return;
        }

        const nextAccessor = parseAccessorValue(newAutomationRule.assigned_accessor);
        let contextMapping: Record<string, unknown> | undefined;
        const rawContextMapping = newAutomationRule.context_mapping_json.trim();
        if (rawContextMapping) {
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
            action_type: 'create_task' as FormAutomationAction,
            is_active: newAutomationRule.is_active,
            conditions_json: cleanConditions.length > 0
                ? {
                    combinator: newAutomationRule.combinator,
                    rules: cleanConditions,
                }
                : null,
            action_config_json: {
                title_template: newAutomationRule.title_template.trim() || 'Follow up {{ submission.id }}',
                description_template: newAutomationRule.description_template.trim() || undefined,
                assigned_accessor_id: nextAccessor.accessor_id || undefined,
                assigned_accessor_type: nextAccessor.accessor_type || undefined,
                context_mapping_json: contextMapping,
                starts_at_value: newAutomationRule.starts_at_value || undefined,
                due_at_value: newAutomationRule.due_at_value || undefined,
                visit_date_value: newAutomationRule.visit_date_value || undefined,
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

    const workspaceStats = [
        { label: 'Forms', value: forms.length },
        { label: 'Datasets', value: datasets.length },
        { label: 'Assets', value: assets.length },
        { label: 'Tasks', value: tasks.length },
        { label: 'Threads', value: threads.length },
        { label: 'Reports', value: reports.length },
        { label: 'Members', value: accessRules.length },
    ];

    return (
        <StudioLayout
            activeNav="projects"
            onSelectNav={handleShellNavSelect as any}
            counts={{ projects: 0, forms: forms.length, datasets: datasets.length, members: members?.length || 0 } as any}
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
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between px-2">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold tracking-tight text-[hsl(var(--text-primary))]">
                                    {currentProject.name}
                                </h1>
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[currentProject.status] || statusTone.planning}`}>
                                    {currentProject.status}
                                </span>
                            </div>
                            <p className="text-sm text-[hsl(var(--text-secondary))] max-w-2xl">
                                {currentProject.description || 'Manage forms, tasks, reports, and team access.'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {workspaceStats.map(stat => (
                                <div key={stat.label} className="flex flex-col border-l border-[hsl(var(--border))] pl-4 first:border-l-0 first:pl-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{stat.label}</span>
                                    <span className="text-xl font-semibold text-[hsl(var(--text-primary))]">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3-Column Board */}
                    <div className="grid gap-6 lg:grid-cols-3 items-start">

                        {/* COLUMN 1: FORMS */}
                        <div className="space-y-6 flex flex-col">
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Forms</h2>
                                    </div>
                                    <button onClick={handleCreateForm} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {forms.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No forms yet.</p>
                                    ) : forms.map(form => (
                                        <div key={form.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{form.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">v{form.version} • {new Date(form.updated_at).toLocaleDateString()}</p>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${formStatusTone[form.status] || formStatusTone.draft}`}>
                                                    {form.status}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type)}>
                                                        {resolveAccessorLabel(form.lead_accessor_id, form.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <select
                                                        value={getAccessorValue(form.assigned_accessor_id, form.assigned_accessor_type)}
                                                        onChange={(e) => handleFormResponsibilityChange(form, 'assigned', e.target.value)}
                                                        className="text-xs bg-transparent text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] cursor-pointer outline-none w-24 truncate"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {assignmentOptions.map(opt => <option key={`form-assign-${form.id}-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>{opt.label}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 flex-wrap justify-end">
                                                    <button onClick={() => navigate(`/simulator/${form.id}`)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                        <Play className="h-3.5 w-3.5 fill-current" />
                                                    </button>
                                                    <button onClick={() => navigate(`/builder/${form.id}`)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded hover:bg-[hsl(var(--primary))]/10 block">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Play className="h-4 w-4 fill-current" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Automation Rules</h2>
                                            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Submission events that create project tasks</p>
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
                                                        value={newAutomationRule.visit_date_value}
                                                        onChange={(event) => setNewAutomationRule((prev) => ({ ...prev, visit_date_value: event.target.value }))}
                                                        className="input"
                                                    />
                                                </div>
                                            </div>

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
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{automationEventOptions.find((option) => option.value === rule.event_type)?.label || rule.event_type}</p>
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

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <CheckCircle2 className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Review Queue</h2>
                                            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Pending submissions awaiting approval</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                        {reviewQueue.length}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {reviewQueue.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">
                                            No submissions are waiting for review.
                                        </p>
                                    ) : reviewQueue.map(item => (
                                        <div key={item.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">{item.form_title}</p>
                                                    <h3 className="mt-1 text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">Submission pending review</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">{new Date(item.created_at).toLocaleString()}</p>
                                                </div>
                                                <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                                    Submitted
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">{summariseSubmissionData(item.data)}</p>
                                            <div className="mt-3 flex items-center justify-end gap-2 pt-3 border-t border-[hsl(var(--border))]/50">
                                                <button
                                                    onClick={() => handleReviewSubmission(item.id, 'rejected')}
                                                    className="inline-flex items-center gap-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--error))]/30 hover:text-[hsl(var(--error))]"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={() => handleReviewSubmission(item.id, 'approved')}
                                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                                                >
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Database className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Item Catalog</h2>
                                            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Project-scoped reference items and default metadata</p>
                                        </div>
                                    </div>
                                    <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                        {catalogItems.length}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-4 p-4 lg:p-5">
                                    <form onSubmit={handleCreateCatalogItem} className="grid grid-cols-1 gap-2 md:grid-cols-5">
                                        <input
                                            value={newCatalogItem.sku_code}
                                            onChange={(event) => setNewCatalogItem(prev => ({ ...prev, sku_code: event.target.value }))}
                                            className="input"
                                            placeholder="Item code"
                                        />
                                        <input
                                            value={newCatalogItem.label}
                                            onChange={(event) => setNewCatalogItem(prev => ({ ...prev, label: event.target.value }))}
                                            className="input"
                                            placeholder="Label"
                                        />
                                        <input
                                            value={newCatalogItem.default_price}
                                            onChange={(event) => setNewCatalogItem(prev => ({ ...prev, default_price: event.target.value }))}
                                            className="input"
                                            placeholder="Default price"
                                            type="number"
                                            step="0.01"
                                        />
                                        <input
                                            value={newCatalogItem.unit}
                                            onChange={(event) => setNewCatalogItem(prev => ({ ...prev, unit: event.target.value }))}
                                            className="input"
                                            placeholder="Unit"
                                        />
                                        <div className="flex gap-2">
                                            <input
                                                value={newCatalogItem.brand}
                                                onChange={(event) => setNewCatalogItem(prev => ({ ...prev, brand: event.target.value }))}
                                                className="input"
                                                placeholder="Brand"
                                            />
                                            <button type="submit" className="rounded-md bg-[hsl(var(--primary))] px-3 py-2 text-xs font-semibold text-white">
                                                Add
                                            </button>
                                        </div>
                                    </form>

                                    {catalogItems.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">
                                            No catalog items yet.
                                        </p>
                                    ) : catalogItems.map(item => (
                                        <div key={item.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{item.label}</h3>
                                                        <span className="rounded-md bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">{item.sku_code}</span>
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                        {(item.brand || 'No brand')} • {(item.unit || 'No unit')} • {item.default_price != null ? `$${item.default_price.toFixed(2)}` : 'No default price'}
                                                    </p>
                                                </div>
                                                <button onClick={() => handleDeleteCatalogItem(item.id)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-[hsl(var(--text-tertiary))] transition-colors hover:bg-[hsl(var(--error))]/10 hover:text-[hsl(var(--error))]">
                                                    Delete
                                                </button>
                                            </div>
                                            <div className="mt-3 flex items-center gap-4 pt-3 border-t border-[hsl(var(--border))]/50">
                                                <label className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.is_active}
                                                        onChange={(event) => handleCatalogItemToggle(item, { is_active: event.target.checked })}
                                                        className="h-4 w-4"
                                                    />
                                                    Active
                                                </label>
                                                <label className="flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.price_editable}
                                                        onChange={(event) => handleCatalogItemToggle(item, { price_editable: event.target.checked })}
                                                        className="h-4 w-4"
                                                    />
                                                    Price editable
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* DATASETS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Database className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Datasets</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=datasets')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
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

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <Paperclip className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Assets</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=assets')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {assets.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No assets yet.</p>
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

                        {/* COLUMN 2: TASKS */}
                        <div className="space-y-6 flex flex-col">
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
                                                        {task.kind === 'journey_visit' && (
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
                                                    {task.visit_date && (
                                                        <p className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                                                            Scheduled {new Date(task.visit_date).toLocaleDateString()}
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

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <MessageSquare className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Threads</h2>
                                    </div>
                                    <button onClick={() => navigate('/dashboard?tab=threads')} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {threads.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No threads yet.</p>
                                    ) : threads.map(thread => (
                                        <div key={thread.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))]">{thread.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">Updated {new Date(thread.updated_at).toLocaleString()}</p>
                                                </div>
                                                <span className="inline-flex rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                                    {thread.reply_count} replies
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-[hsl(var(--text-secondary))]">{thread.summary}</p>
                                            <div className="mt-3 rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                Placeholder: message feed, composer, mentions, and activity history will land here.
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Attendance</h2>
                                            <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Operational check-in and check-out for {attendanceDay}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                        <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{attendanceSummary.total} total</span>
                                        <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{attendanceSummary.checkedIn} active</span>
                                        <span className="rounded-full bg-[hsl(var(--surface-elevated))] px-2.5 py-1">{attendanceSummary.checkedOut} completed</span>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    {attendanceRecords.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No attendance activity recorded for this day.</p>
                                    ) : attendanceRecords.map(record => (
                                        <div key={record.id} className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">{resolveAttendanceMemberLabel(record)}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                        Checked in {new Date(record.check_in_at).toLocaleTimeString()}
                                                        {record.check_out_at ? ` • Checked out ${new Date(record.check_out_at).toLocaleTimeString()}` : ''}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${record.status === 'checked_out' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'}`}>
                                                    {record.status === 'checked_out' ? 'Checked Out' : 'Checked In'}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-[11px] text-[hsl(var(--text-secondary))]">
                                                Check-in: {formatAttendanceLocation(record.check_in_location_json)}
                                            </p>
                                            {record.check_out_location_json && (
                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-secondary))]">
                                                    Check-out: {formatAttendanceLocation(record.check_out_location_json)}
                                                </p>
                                            )}
                                            {(record.check_in_note || record.check_out_note) && (
                                                <p className="mt-2 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                    {record.check_out_note || record.check_in_note}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* COLUMN 3: REPORTS AND MEMBERS */}
                        <div className="space-y-6 flex flex-col">

                            {/* REPORTS */}
                            <section className="flex flex-col rounded-[24px] bg-[hsl(var(--surface))] border border-[hsl(var(--border))] shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-[hsl(var(--border))] p-4 lg:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                                            <FileBarChart2 className="h-4 w-4" />
                                        </div>
                                        <h2 className="text-lg font-semibold text-[hsl(var(--text-primary))]">Reports</h2>
                                    </div>
                                    <button onClick={handleCreateReport} className="flex items-center gap-1 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--primary))] transition-colors px-2 py-1 rounded-lg hover:bg-[hsl(var(--surface-elevated))]">
                                        <Plus className="h-4 w-4" />
                                        <span className="text-xs font-semibold">New</span>
                                    </button>
                                </div>
                                <div className="flex flex-col gap-3 p-4 lg:p-5">
                                    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
                                        <div className="flex flex-col gap-3">
                                            <div>
                                                <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Workflow Coverage</h3>
                                                <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))]">
                                                    Operational metrics that reporting can now consume from source review, tasks, automation, and attendance.
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Pending review</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.pendingReview}</p>
                                                </div>
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Source-linked tasks</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.sourceLinkedTasks}</p>
                                                </div>
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Automation-created</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.automatedTasks}</p>
                                                </div>
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Task completion</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.completionRate}%</p>
                                                </div>
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Attendance complete</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.attendanceCompletionRate}%</p>
                                                </div>
                                                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Published reports</p>
                                                    <p className="mt-2 text-lg font-semibold text-[hsl(var(--text-primary))]">{workflowMetrics.publishedReports}</p>
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--surface-elevated))] p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Reporting joins</p>
                                                <div className="mt-2 space-y-1.5 text-[11px] text-[hsl(var(--text-secondary))]">
                                                    {workflowJoinNotes.map((note) => (
                                                        <p key={note}>{note}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {reports.length === 0 ? (
                                        <p className="text-sm text-[hsl(var(--text-tertiary))] text-center py-4 bg-[hsl(var(--background))] rounded-md border border-dashed border-[hsl(var(--border))]">No reports yet.</p>
                                    ) : reports.map(report => (
                                        <div key={report.id} className="group relative rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 transition-shadow hover:shadow-md">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 pr-2">
                                                    <h3 className="text-sm font-semibold leading-tight text-[hsl(var(--text-primary))] truncate">{report.title}</h3>
                                                    <p className="mt-1 text-[11px] text-[hsl(var(--text-tertiary))] truncate">{report.description || 'No description'}</p>
                                                </div>
                                                <select
                                                    value={report.status}
                                                    onChange={(e) => handleReportUpdate(report.id, { status: e.target.value as ReportArtifact['status'] })}
                                                    className={`shrink-0 appearance-none inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-center cursor-pointer outline-none border-0 ${reportStatusTone[report.status] || reportStatusTone.draft}`}
                                                >
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                            </div>
                                            <div className="mt-3 flex items-center justify-between pt-3 border-t border-[hsl(var(--border))]/50">
                                                <div className="flex items-center gap-2 max-w-[50%]">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0" title={resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type)}>
                                                        {resolveAccessorLabel(report.lead_accessor_id, report.lead_accessor_type).charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-[10px] text-[hsl(var(--text-secondary))] uppercase tracking-widest leading-none font-bold truncate">Owner</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <button onClick={() => handleDeleteReport(report.id)} className="p-1 px-1.5 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))] text-[10px] font-semibold rounded bg-[hsl(var(--error))]/5">
                                                        Del
                                                    </button>
                                                    <button onClick={() => navigate(`/projects/${projectId}/reports/${report.id}`)} className="p-1 text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--primary))] rounded-md hover:bg-[hsl(var(--primary))]/10">
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* MEMBERS */}
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

                    </div>
                </div>
            ) : null}
        </StudioLayout>
    );
};

export default ProjectWorkspace;