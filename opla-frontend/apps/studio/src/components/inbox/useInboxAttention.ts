import { useEffect, useMemo, useState } from 'react';
import { formAPI, projectAPI, submissionAPI } from '../../lib/api';

export type InboxProject = {
    id: string;
    name: string;
    status: string;
};

export type InboxTask = {
    id: string;
    project_id: string;
    status: string;
};

export type ProjectPulse = {
    projectId: string;
    projectName: string;
    openTasks: number;
    pendingReview: number;
    checkedIn: number;
    attendanceTotal: number;
};

export type InboxAttentionItem = {
    id: string;
    projectId: string;
    projectName: string;
    title: string;
    detail: string;
    action: 'review' | 'attendance' | 'hub';
    weight: number;
};

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

export function buildInboxAttentionItems(pulses: ProjectPulse[]): InboxAttentionItem[] {
    const items: InboxAttentionItem[] = [];

    for (const row of pulses) {
        if (row.pendingReview > 0) {
            items.push({
                id: `${row.projectId}-review`,
                projectId: row.projectId,
                projectName: row.projectName,
                title: `${row.pendingReview} submission${row.pendingReview === 1 ? '' : 's'} awaiting review`,
                detail: 'Open the project review queue',
                action: 'review',
                weight: row.pendingReview * 10,
            });
        }
        if (row.openTasks > 0) {
            items.push({
                id: `${row.projectId}-tasks`,
                projectId: row.projectId,
                projectName: row.projectName,
                title: `${row.openTasks} open task${row.openTasks === 1 ? '' : 's'}`,
                detail: 'Check programme Hub for today’s work',
                action: 'hub',
                weight: row.openTasks,
            });
        }
        if (row.attendanceTotal > 0 && row.checkedIn < row.attendanceTotal) {
            const missing = row.attendanceTotal - row.checkedIn;
            items.push({
                id: `${row.projectId}-attendance`,
                projectId: row.projectId,
                projectName: row.projectName,
                title: `${missing} agent${missing === 1 ? '' : 's'} not checked in`,
                detail: 'Open attendance for this programme',
                action: 'attendance',
                weight: missing * 3,
            });
        }
    }

    return items.sort((a, b) => b.weight - a.weight);
}

/** Shared Inbox pulse loader — powers Inbox page + header notification badge. */
export function useInboxAttention(
    orgId: string | undefined,
    projects: InboxProject[],
    tasks: InboxTask[],
) {
    const [pulses, setPulses] = useState<ProjectPulse[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!orgId || projects.length === 0) {
                setPulses([]);
                return;
            }
            setLoading(true);
            const day = todayIso();
            try {
                const rows = await Promise.all(
                    projects.map(async (project) => {
                        const openTasks = tasks.filter(
                            (task) =>
                                task.project_id === project.id
                                && task.status !== 'done'
                                && task.status !== 'cancelled',
                        ).length;

                        let pendingReview = 0;
                        let checkedIn = 0;
                        let attendanceTotal = 0;

                        try {
                            const [forms, attendance] = await Promise.all([
                                formAPI.list(project.id, 'standard').catch(() => []),
                                projectAPI.listAttendance(orgId, project.id, day).catch(() => []),
                            ]);
                            const captureForms = Array.isArray(forms) ? forms : [];
                            const queues = await Promise.all(
                                captureForms.map((form: { id: string }) =>
                                    submissionAPI.listForForm(form.id, 'submitted').catch(() => []),
                                ),
                            );
                            pendingReview = queues.reduce(
                                (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
                                0,
                            );
                            const attendanceRows = Array.isArray(attendance) ? attendance : [];
                            attendanceTotal = attendanceRows.length;
                            checkedIn = attendanceRows.filter(
                                (row: { status?: string }) =>
                                    row.status === 'checked_in' || row.status === 'checked_out',
                            ).length;
                        } catch {
                            // keep zeros
                        }

                        return {
                            projectId: project.id,
                            projectName: project.name,
                            openTasks,
                            pendingReview,
                            checkedIn,
                            attendanceTotal,
                        } satisfies ProjectPulse;
                    }),
                );
                if (!cancelled) setPulses(rows);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [orgId, projects, tasks]);

    const totals = useMemo(() => {
        const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').length;
        const pendingReview = pulses.reduce((sum, row) => sum + row.pendingReview, 0);
        const checkedIn = pulses.reduce((sum, row) => sum + row.checkedIn, 0);
        const activeProjects = projects.filter((project) => project.status === 'active').length;
        return { openTasks, pendingReview, checkedIn, activeProjects };
    }, [projects, pulses, tasks]);

    const attentionItems = useMemo(() => buildInboxAttentionItems(pulses), [pulses]);
    const attentionCount = attentionItems.length;

    return { pulses, loading, totals, attentionItems, attentionCount };
}
