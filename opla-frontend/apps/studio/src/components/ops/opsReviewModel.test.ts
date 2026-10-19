import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ReviewQueueItem } from '../../lib/opsApi.ts';
import {
    filterReviewQueue,
    formatReviewWhen,
    mapFormSubmissions,
    resolveSubmitterLabel,
    reviewStatusLabel,
    summariseSubmissionData,
    summarizeReviewQueue,
} from './opsReviewModel.ts';

function item(partial: Partial<ReviewQueueItem> & Pick<ReviewQueueItem, 'id' | 'review_status'>): ReviewQueueItem {
    return {
        form_id: 'form-1',
        form_title: 'Outlet audit',
        data: { shop: 'Zone B' },
        created_at: '2026-09-14T10:24:00',
        ...partial,
    };
}

describe('Studio Ops review model', () => {
    it('summarizes pending / approved-today / rejected-today from live submissions', () => {
        const now = new Date(2026, 8, 14, 16, 0, 0);
        const summary = summarizeReviewQueue(
            [
                item({ id: 's1', review_status: 'submitted' }),
                item({ id: 's2', review_status: 'submitted' }),
                item({
                    id: 's3',
                    review_status: 'approved',
                    reviewed_at: '2026-09-14T11:00:00',
                }),
                item({
                    id: 's4',
                    review_status: 'rejected',
                    reviewed_at: '2026-09-13T17:00:00',
                    created_at: '2026-09-13T16:00:00',
                }),
            ],
            now,
        );
        assert.deepEqual(summary, { pending: 2, approvedToday: 1, rejectedToday: 0 });
    });

    it('filters the queue and labels review status', () => {
        const rows = [
            item({ id: 's1', review_status: 'submitted' }),
            item({ id: 's2', review_status: 'approved' }),
        ];
        assert.deepEqual(filterReviewQueue(rows, 'submitted').map((row) => row.id), ['s1']);
        assert.equal(filterReviewQueue(rows, 'all').length, 2);
        assert.equal(reviewStatusLabel('submitted'), 'Submitted');
        assert.equal(reviewStatusLabel('approved'), 'Approved');
        assert.equal(reviewStatusLabel('rejected'), 'Rejected');
    });

    it('previews submission data and formats relative times', () => {
        const now = new Date(2026, 8, 14, 18, 0, 0);
        assert.equal(
            summariseSubmissionData({ region: 'Accra', count: 3, photos: ['a', 'b'] }),
            'region: Accra • count: 3 • photos: 2 items',
        );
        assert.equal(summariseSubmissionData({}), 'No preview available');
        assert.match(formatReviewWhen('2026-09-14T10:24:00', now), /^Today · \d{2}:\d{2}$/);
        assert.match(formatReviewWhen('2026-09-13T17:02:00', now), /^Yesterday · \d{2}:\d{2}$/);
        assert.match(formatReviewWhen('2026-09-01T09:00:00', now), /^1 Sep · \d{2}:\d{2}$/);
    });

    it('maps form submissions onto the review queue and names submitters', () => {
        const mapped = mapFormSubmissions(
            { id: 'form-1', title: 'School visit form' },
            [{ id: 's1', form_id: 'form-1', user_id: 'u-1', data: {}, review_status: 'submitted', created_at: '2026-09-14T10:24:00' }],
        );
        assert.equal(mapped[0]?.form_title, 'School visit form');
        assert.equal(mapFormSubmissions({ id: 'form-1', title: 'X' }, null).length, 0);

        const members = [{ user_id: 'u-1', user: { full_name: 'Efua Darko' } }];
        assert.equal(resolveSubmitterLabel(item({ id: 's1', review_status: 'submitted', user_id: 'u-1' }), members), 'Efua Darko');
        assert.equal(resolveSubmitterLabel(item({ id: 's2', review_status: 'submitted', user_id: null }), members), 'Public capture');
    });
});
