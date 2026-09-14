import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    apiErrorMessage,
    asArray,
    attendanceEventPayload,
    attendanceLocationFromCoords,
    formSubmissionsPath,
    localDateKey,
    projectAttendanceCheckInPath,
    projectAttendanceCheckOutPath,
    projectAttendanceCollectionPath,
    projectAttendanceMyStatusPath,
    submissionReviewPath,
} from './opsApi.ts';

describe('Studio Ops API contracts (parity with mobile + backend tests)', () => {
    it('builds project attendance collection, status, check-in, and check-out paths', () => {
        const orgId = 'org-1';
        const projectId = 'proj-9';
        assert.equal(
            projectAttendanceCollectionPath(orgId, projectId),
            '/organizations/org-1/projects/proj-9/attendance',
        );
        assert.equal(
            projectAttendanceMyStatusPath(orgId, projectId),
            '/organizations/org-1/projects/proj-9/attendance/my-status',
        );
        assert.equal(
            projectAttendanceCheckInPath(orgId, projectId),
            '/organizations/org-1/projects/proj-9/attendance/check-in',
        );
        assert.equal(
            projectAttendanceCheckOutPath(orgId, projectId),
            '/organizations/org-1/projects/proj-9/attendance/check-out',
        );
    });

    it('builds form submission list and review paths', () => {
        assert.equal(formSubmissionsPath('form-22'), '/forms/form-22/submissions');
        assert.equal(submissionReviewPath('sub-44'), '/submissions/sub-44/review');
    });

    it('wraps a browser location into the attendance location contract', () => {
        assert.deepEqual(
            attendanceLocationFromCoords({ latitude: 5.6037, longitude: -0.187, accuracy: 12.5 }),
            {
                latitude: 5.6037,
                longitude: -0.187,
                accuracy_meters: 12.5,
                label: 'Studio',
            },
        );
        assert.deepEqual(
            attendanceLocationFromCoords({ latitude: 1, longitude: 2 }, 'Field hub'),
            { latitude: 1, longitude: 2, label: 'Field hub' },
        );
    });

    it('omits blank optional fields from check-in / check-out payloads', () => {
        const location = { latitude: 5.6, longitude: -0.18, label: 'Studio' };
        assert.deepEqual(attendanceEventPayload(location, { note: '  ', signature: '' }), { location });
        assert.deepEqual(
            attendanceEventPayload(location, {
                timestamp: '2026-05-25T08:15:00',
                note: ' Morning roll call ',
                signature: 'K. Mensah',
            }),
            {
                location,
                timestamp: '2026-05-25T08:15:00',
                note: 'Morning roll call',
                signature: 'K. Mensah',
            },
        );
    });

    it('normalizes API lists and FastAPI error details', () => {
        assert.deepEqual(asArray([{ id: 1 }]), [{ id: 1 }]);
        assert.deepEqual(asArray(null), []);
        assert.equal(
            apiErrorMessage({ response: { data: { detail: 'Submission review permission is required for this project' } } }, 'fallback'),
            'Submission review permission is required for this project',
        );
        assert.equal(
            apiErrorMessage({ response: { data: { detail: [{ msg: 'Attendance location is required' }] } } }, 'fallback'),
            'Attendance location is required',
        );
        assert.equal(apiErrorMessage({ message: 'Network Error' }, 'fallback'), 'Network Error');
        assert.equal(apiErrorMessage({}, 'Could not load attendance'), 'Could not load attendance');
        assert.equal(localDateKey(new Date(2026, 8, 14, 23, 15)), '2026-09-14');
    });
});
