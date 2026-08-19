/** Org-level report boards persisted by OrgReportService. */

import type { ReportBlock } from '../components/reports/reportBlocks';
import { createDefaultBlocks, normalizeBlocks } from '../components/reports/reportBlocks';
import { analyticsAPI } from './api';

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
    sourceProjectIds: string[];
    teamGrants: ReportTeamGrant[];
    comments: ReportComment[];
    content: ReportBlock[];
    legacyProjectId?: string;
    legacyReportId?: string;
    updatedAt: string;
    createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
}

function asStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function hydrateGrants(value: unknown): ReportTeamGrant[] {
    if (!Array.isArray(value)) return [];
    const grants: ReportTeamGrant[] = [];
    for (const item of value) {
        if (!isRecord(item)) continue;
        const role = asString(item.role);
        if (role !== 'viewer' && role !== 'commenter' && role !== 'explorer' && role !== 'owner') continue;
        grants.push({
            teamId: asString(item.teamId),
            teamName: asString(item.teamName),
            role,
        });
    }
    return grants;
}

function hydrateComments(value: unknown): ReportComment[] {
    if (!Array.isArray(value)) return [];
    const comments: ReportComment[] = [];
    for (const item of value) {
        if (!isRecord(item)) continue;
        comments.push({
            id: asString(item.id),
            author: asString(item.author),
            body: asString(item.body),
            createdAt: asString(item.createdAt),
        });
    }
    return comments;
}

function hydrateBucket(row: unknown): ReportBucket {
    const record = isRecord(row) ? row : {};
    const title = asString(record.title, 'Untitled report');
    const contentRaw = record.content;
    const content =
        Array.isArray(contentRaw) && contentRaw.length > 0
            ? normalizeBlocks(contentRaw)
            : createDefaultBlocks(title);
    const statusRaw = asString(record.status, 'draft');
    const status: ReportBucket['status'] =
        statusRaw === 'published' || statusRaw === 'archived' ? statusRaw : 'draft';
    return {
        id: asString(record.id),
        orgId: asString(record.orgId),
        title,
        description: asString(record.description),
        status,
        sourceProjectIds: asStringList(record.sourceProjectIds),
        teamGrants: hydrateGrants(record.teamGrants),
        comments: hydrateComments(record.comments),
        content,
        updatedAt: asString(record.updatedAt, new Date().toISOString()),
        createdAt: asString(record.createdAt, new Date().toISOString()),
    };
}

export const REPORT_GRANT_ROLE_LABELS: Record<ReportGrantRole, string> = {
    viewer: 'Viewer',
    commenter: 'Commenter',
    explorer: 'Explorer',
    owner: 'Owner',
};

export async function listReportBuckets(orgId: string): Promise<ReportBucket[]> {
    const rows = await analyticsAPI.listOrgReports(orgId);
    if (!Array.isArray(rows)) return [];
    return rows.map(hydrateBucket);
}

export async function getReportBucket(orgId: string, bucketId: string): Promise<ReportBucket | null> {
    try {
        const row = await analyticsAPI.getOrgReport(orgId, bucketId);
        return hydrateBucket(row);
    } catch {
        return null;
    }
}

export async function createReportBucket(
    orgId: string,
    input: {
        title: string;
        description?: string;
        sourceProjectIds?: string[];
        teamGrants?: ReportTeamGrant[];
        legacyProjectId?: string;
        legacyReportId?: string;
    },
): Promise<ReportBucket> {
    const title = input.title.trim() || 'Untitled report';
    const row = await analyticsAPI.createOrgReport(orgId, {
        title,
        description: input.description?.trim() || '',
        status: 'draft',
        sourceProjectIds: input.sourceProjectIds || [],
        teamGrants: input.teamGrants || [],
        comments: [],
        content: createDefaultBlocks(title),
    });
    return hydrateBucket(row);
}

export async function updateReportBucket(
    orgId: string,
    bucketId: string,
    patch: Partial<
        Pick<
            ReportBucket,
            'title' | 'description' | 'status' | 'sourceProjectIds' | 'teamGrants' | 'comments' | 'content'
        >
    >,
): Promise<ReportBucket | null> {
    try {
        const row = await analyticsAPI.updateOrgReport(orgId, bucketId, patch);
        return hydrateBucket(row);
    } catch {
        return null;
    }
}
