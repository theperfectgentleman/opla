import { localDateKey, type AttendanceLocation, type AttendanceStatus, type ProjectAttendanceRecord } from '../../lib/opsApi.ts';

export type AttendanceMember = {
    user_id: string;
    user?: {
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
    } | null;
};

export type AttendanceSummary = {
    total: number;
    checkedIn: number;
    inField: number;
    checkedOut: number;
};

export { localDateKey };

export function summarizeAttendance(records: Array<{ status: AttendanceStatus }>): AttendanceSummary {
    const checkedIn = records.filter(
        (record) => record.status === 'checked_in' || record.status === 'checked_out',
    ).length;
    const inField = records.filter((record) => record.status === 'checked_in').length;
    const checkedOut = records.filter((record) => record.status === 'checked_out').length;
    return {
        total: records.length,
        checkedIn,
        inField,
        checkedOut,
    };
}

export function attendanceStatusLabel(status: AttendanceStatus): string {
    return status === 'checked_out' ? 'Checked out' : 'Checked in';
}

export function formatAttendanceClock(iso?: string | null): string {
    if (!iso) {
        return '';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function formatAttendanceLocation(location?: AttendanceLocation | null): string {
    if (!location) {
        return 'Location pending';
    }
    if (location.label?.trim()) {
        return location.label;
    }
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

export function resolveAttendanceMemberLabel(
    record: Pick<ProjectAttendanceRecord, 'user_id'>,
    members: AttendanceMember[],
): string {
    const member = members.find((item) => item.user_id === record.user_id);
    return member?.user?.full_name || member?.user?.email || member?.user?.phone || record.user_id;
}

export function attendanceRowNote(record: ProjectAttendanceRecord): string {
    const note = record.status === 'checked_out'
        ? record.check_out_note || record.check_in_note
        : record.check_in_note;
    const location = formatAttendanceLocation(
        record.status === 'checked_out' ? record.check_out_location_json : record.check_in_location_json,
    );
    return [note, location].filter(Boolean).join(' · ');
}

export function attendanceRowTime(record: ProjectAttendanceRecord): string {
    return formatAttendanceClock(record.status === 'checked_out' ? record.check_out_at : record.check_in_at);
}
