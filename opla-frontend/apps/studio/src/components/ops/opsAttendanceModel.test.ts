import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProjectAttendanceRecord } from '../../lib/opsApi.ts';
import {
    attendanceRowNote,
    attendanceRowTime,
    attendanceStatusLabel,
    formatAttendanceClock,
    formatAttendanceLocation,
    localDateKey,
    resolveAttendanceMemberLabel,
    summarizeAttendance,
} from './opsAttendanceModel.ts';

function record(partial: Partial<ProjectAttendanceRecord> & Pick<ProjectAttendanceRecord, 'id' | 'user_id' | 'status'>): ProjectAttendanceRecord {
    return {
        project_id: 'proj-1',
        attendance_date: '2026-09-14',
        check_in_at: '2026-09-14T08:42:00',
        check_in_location_json: { latitude: 5.6037, longitude: -0.187, label: 'Zone A' },
        created_at: '2026-09-14T08:42:00',
        updated_at: '2026-09-14T08:42:00',
        ...partial,
    };
}

describe('Studio Ops attendance model', () => {
    it('summarizes live roster KPIs from check-in / check-out status', () => {
        const summary = summarizeAttendance([
            { status: 'checked_in' },
            { status: 'checked_in' },
            { status: 'checked_out' },
        ]);
        assert.deepEqual(summary, { total: 3, checkedIn: 3, inField: 2, checkedOut: 1 });
    });

    it('labels members, status, clock, and location from API records', () => {
        const checkedIn = record({
            id: 'a1',
            user_id: 'u-ama',
            status: 'checked_in',
            check_in_note: 'Field team',
        });
        const checkedOut = record({
            id: 'a2',
            user_id: 'u-kwame',
            status: 'checked_out',
            check_in_at: '2026-09-14T08:10:00',
            check_out_at: '2026-09-14T16:10:00',
            check_out_location_json: { latitude: 5.6071, longitude: -0.1901 },
            check_out_note: 'Completed route',
        });

        const members = [
            { user_id: 'u-ama', user: { full_name: 'Ama Mensah' } },
            { user_id: 'u-kwame', user: { email: 'kwame@org.test' } },
        ];

        assert.equal(resolveAttendanceMemberLabel(checkedIn, members), 'Ama Mensah');
        assert.equal(resolveAttendanceMemberLabel(checkedOut, members), 'kwame@org.test');
        assert.equal(resolveAttendanceMemberLabel({ user_id: 'missing' }, members), 'missing');
        assert.equal(attendanceStatusLabel('checked_in'), 'Checked in');
        assert.equal(attendanceStatusLabel('checked_out'), 'Checked out');
        assert.equal(formatAttendanceLocation(checkedIn.check_in_location_json), 'Zone A');
        assert.equal(formatAttendanceLocation(checkedOut.check_out_location_json), '5.6071, -0.1901');
        assert.equal(formatAttendanceLocation(null), 'Location pending');
        assert.equal(attendanceRowNote(checkedIn), 'Field team · Zone A');
        assert.equal(attendanceRowNote(checkedOut), 'Completed route · 5.6071, -0.1901');
        assert.equal(attendanceRowTime(checkedIn), formatAttendanceClock(checkedIn.check_in_at));
        assert.equal(attendanceRowTime(checkedOut), formatAttendanceClock(checkedOut.check_out_at));
    });

    it('formats a local calendar day as YYYY-MM-DD', () => {
        assert.equal(localDateKey(new Date(2026, 8, 14, 23, 15)), '2026-09-14');
    });
});
