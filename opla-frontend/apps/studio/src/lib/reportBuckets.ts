/** Org-level report buckets (mock store until org report APIs exist). */

import type { ReportBlock } from '../components/reports/reportBlocks';
import { createDefaultBlocks, normalizeBlocks } from '../components/reports/reportBlocks';

export type ReportGrantRole = 'viewer' | 'commenter' | 'explorer' | 'owner';

export type ReportTeamGrant = {
    teamId: string;
    teamName: string;
    role: ReportGrantRole;
};

export type ReportComment = {
    id: string;
    author: string;
    body: string;
    createdAt: string;
};

export type ReportBucket = {
    id: string;
    orgId: string;
    title: string;
    description: string;
    status: 'draft' | 'published' | 'archived';
    /** Projects whose data/artifacts this board may draw from */
    sourceProjectIds: string[];
    teamGrants: ReportTeamGrant[];
    comments: ReportComment[];
    /** Typed canvas blocks (same shape as project report content). */
    content: ReportBlock[];
    /** Optional link to a legacy project-scoped report artifact */
    legacyProjectId?: string;
    legacyReportId?: string;
    updatedAt: string;
    createdAt: string;
};

const storageKey = (orgId: string) => `opla_report_buckets_v1_${orgId}`;

function hydrateBucket(row: Partial<ReportBucket> & { id: string; orgId: string; title: string }): ReportBucket {
    const title = row.title || 'Untitled report';
    const content =
        Array.isArray(row.content) && row.content.length > 0
            ? normalizeBlocks(row.content)
            : createDefaultBlocks(title);
    return {
        id: row.id,
        orgId: row.orgId,
        title,
        description: row.description || '',
        status: row.status || 'draft',
        sourceProjectIds: row.sourceProjectIds || [],
        teamGrants: row.teamGrants || [],
        comments: row.comments || [],
        content,
        legacyProjectId: row.legacyProjectId,
        legacyReportId: row.legacyReportId,
        updatedAt: row.updatedAt || new Date().toISOString(),
        createdAt: row.createdAt || new Date().toISOString(),
    };
}

function readAll(orgId: string): ReportBucket[] {
    try {
        const raw = localStorage.getItem(storageKey(orgId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((row) => hydrateBucket(row));
    } catch {
        return [];
    }
}

function writeAll(orgId: string, buckets: ReportBucket[]) {
    localStorage.setItem(storageKey(orgId), JSON.stringify(buckets));
}

export const REPORT_GRANT_ROLE_LABELS: Record<ReportGrantRole, string> = {
    viewer: 'Viewer',
    commenter: 'Commenter',
    explorer: 'Explorer',
    owner: 'Owner',
};

export function listReportBuckets(orgId: string): ReportBucket[] {
    return readAll(orgId).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
}

export function getReportBucket(orgId: string, bucketId: string): ReportBucket | null {
    return readAll(orgId).find((row) => row.id === bucketId) || null;
}

export function createReportBucket(
    orgId: string,
    input: {
        title: string;
        description?: string;
        sourceProjectIds?: string[];
        teamGrants?: ReportTeamGrant[];
        legacyProjectId?: string;
        legacyReportId?: string;
    },
): ReportBucket {
    const now = new Date().toISOString();
    const title = input.title.trim() || 'Untitled report';
    const bucket: ReportBucket = {
        id: `rb_${crypto.randomUUID()}`,
        orgId,
        title,
        description: input.description?.trim() || '',
        status: 'draft',
        sourceProjectIds: input.sourceProjectIds || [],
        teamGrants: input.teamGrants || [],
        comments: [
            {
                id: `c_${crypto.randomUUID()}`,
                author: 'System',
                body: 'Welcome — seniors can view, comment, and explore curated analytics here. They cannot run field Ops from this board.',
                createdAt: now,
            },
        ],
        content: createDefaultBlocks(title),
        legacyProjectId: input.legacyProjectId,
        legacyReportId: input.legacyReportId,
        updatedAt: now,
        createdAt: now,
    };
    const next = [bucket, ...readAll(orgId)];
    writeAll(orgId, next);
    return bucket;
}

export function updateReportBucket(
    orgId: string,
    bucketId: string,
    patch: Partial<
        Pick<
            ReportBucket,
            'title' | 'description' | 'status' | 'sourceProjectIds' | 'teamGrants' | 'comments' | 'content'
        >
    >,
): ReportBucket | null {
    const all = readAll(orgId);
    const index = all.findIndex((row) => row.id === bucketId);
    if (index < 0) return null;
    const updated: ReportBucket = {
        ...all[index],
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    all[index] = updated;
    writeAll(orgId, all);
    return updated;
}

export function deleteReportBucket(orgId: string, bucketId: string): boolean {
    const all = readAll(orgId);
    const next = all.filter((row) => row.id !== bucketId);
    if (next.length === all.length) return false;
    writeAll(orgId, next);
    return true;
}

/** Seed one mock board so the canvas is reachable without a create flow. */
export function ensureDemoReportBucket(
    orgId: string,
    sourceProjectIds: string[] = [],
): ReportBucket {
    const existing = readAll(orgId);
    if (existing.length > 0) return existing[0];
    const now = new Date().toISOString();
    const title = 'Demo programme board';
    const bucket: ReportBucket = {
        id: `rb_demo_${orgId.slice(0, 8)}`,
        orgId,
        title,
        description: 'Stakeholder canvas — narrative, live data, and AI sections on one board.',
        status: 'published',
        sourceProjectIds: sourceProjectIds.slice(0, 2),
        teamGrants: [],
        comments: [
            {
                id: `c_demo_${orgId.slice(0, 8)}`,
                author: 'Programme lead',
                body: 'Zone B check-ins dipped this week — can we get a note from Ops before Friday?',
                createdAt: now,
            },
            {
                id: `c_demo2_${orgId.slice(0, 8)}`,
                author: 'You',
                body: 'Welcome — this is the report canvas seniors will use to watch and steer.',
                createdAt: now,
            },
        ],
        content: createDefaultBlocks(title),
        updatedAt: now,
        createdAt: now,
    };
    writeAll(orgId, [bucket]);
    return bucket;
}

export function ensureLegacyReportBucket(
    orgId: string,
    legacy: {
        projectId: string;
        reportId: string;
        title: string;
        description?: string;
        status: 'draft' | 'published' | 'archived';
        updatedAt: string;
    },
): ReportBucket {
    const existing = readAll(orgId).find(
        (row) => row.legacyProjectId === legacy.projectId && row.legacyReportId === legacy.reportId,
    );
    if (existing) {
        return updateReportBucket(orgId, existing.id, {
            title: legacy.title,
            description: legacy.description || existing.description,
            status: legacy.status,
            sourceProjectIds: existing.sourceProjectIds.includes(legacy.projectId)
                ? existing.sourceProjectIds
                : [...existing.sourceProjectIds, legacy.projectId],
        }) || existing;
    }
    return createReportBucket(orgId, {
        title: legacy.title,
        description: legacy.description,
        sourceProjectIds: [legacy.projectId],
        legacyProjectId: legacy.projectId,
        legacyReportId: legacy.reportId,
    });
}
