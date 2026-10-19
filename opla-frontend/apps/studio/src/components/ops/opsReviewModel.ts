import { localDateKey, type ReviewQueueItem, type SubmissionReviewStatus } from '../../lib/opsApi.ts';

export type ReviewFilter = 'submitted' | 'approved' | 'rejected' | 'all';

export type ReviewSummary = {
    pending: number;
    approvedToday: number;
    rejectedToday: number;
};

export type ReviewMember = {
    user_id: string;
    user?: {
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
    } | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function summariseSubmissionData(data: Record<string, unknown> | null | undefined): string {
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
}

export function isSameLocalDay(iso: string | null | undefined, now: Date): boolean {
    if (!iso) {
        return false;
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return false;
    }
    return localDateKey(date) === localDateKey(now);
}

export function summarizeReviewQueue(items: ReviewQueueItem[], now: Date = new Date()): ReviewSummary {
    return {
        pending: items.filter((item) => item.review_status === 'submitted').length,
        approvedToday: items.filter(
            (item) => item.review_status === 'approved' && isSameLocalDay(item.reviewed_at || item.created_at, now),
        ).length,
        rejectedToday: items.filter(
            (item) => item.review_status === 'rejected' && isSameLocalDay(item.reviewed_at || item.created_at, now),
        ).length,
    };
}

export function filterReviewQueue(items: ReviewQueueItem[], filter: ReviewFilter): ReviewQueueItem[] {
    if (filter === 'all') {
        return items;
    }
    return items.filter((item) => item.review_status === filter);
}

export function reviewStatusLabel(status: SubmissionReviewStatus): string {
    if (status === 'approved') {
        return 'Approved';
    }
    if (status === 'rejected') {
        return 'Rejected';
    }
    return 'Submitted';
}

export function formatReviewClock(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatReviewWhen(iso: string, now: Date = new Date()): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const clock = formatReviewClock(iso);
    const dayKey = localDateKey(date);
    if (dayKey === localDateKey(now)) {
        return `Today · ${clock}`;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dayKey === localDateKey(yesterday)) {
        return `Yesterday · ${clock}`;
    }
    return `${date.getDate()} ${MONTHS[date.getMonth()]} · ${clock}`;
}

export function resolveSubmitterLabel(item: ReviewQueueItem, members: ReviewMember[]): string {
    if (!item.user_id) {
        return 'Public capture';
    }
    const member = members.find((entry) => item.user_id === entry.user_id);
    return member?.user?.full_name || member?.user?.email || member?.user?.phone || item.user_id;
}

export function mapFormSubmissions(
    form: { id: string; title: string },
    submissions: unknown,
): ReviewQueueItem[] {
    if (!Array.isArray(submissions)) {
        return [];
    }
    return submissions.map((submission) => {
        const row = submission as ReviewQueueItem;
        return {
            ...row,
            form_title: form.title,
        };
    });
}
