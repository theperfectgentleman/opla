import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';

import { projectAPI } from '../../lib/api';
import {
    apiErrorMessage,
    asArray,
    attendanceEventPayload,
    attendanceLocationFromCoords,
    type AttendanceEventPayload,
    type ProjectAttendanceRecord,
} from '../../lib/opsApi';
import {
    attendanceRowNote,
    attendanceRowTime,
    attendanceStatusLabel,
    localDateKey,
    resolveAttendanceMemberLabel,
    summarizeAttendance,
    type AttendanceMember,
} from './opsAttendanceModel';

type OpsAttendanceProps = {
    orgId: string;
    projectId: string;
    projectName?: string;
    members: AttendanceMember[];
    currentUserId?: string;
    onTodayRecordsChange?: (records: ProjectAttendanceRecord[]) => void;
};

async function readBrowserLocation(): Promise<AttendanceEventPayload['location']> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
        throw new Error('Location is required for attendance.');
    }
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => resolve(attendanceLocationFromCoords(position.coords)),
            () => reject(new Error('Location permission is required for attendance.')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    });
}

const OpsAttendance: React.FC<OpsAttendanceProps> = ({
    orgId,
    projectId,
    projectName,
    members,
    currentUserId,
    onTodayRecordsChange,
}) => {
    const todayKey = useMemo(() => localDateKey(), []);
    const [day, setDay] = useState(todayKey);
    const [records, setRecords] = useState<ProjectAttendanceRecord[]>([]);
    const [myRecord, setMyRecord] = useState<ProjectAttendanceRecord | null>(null);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [roster, mine] = await Promise.all([
                projectAPI.listAttendance(orgId, projectId, day),
                projectAPI.getMyAttendanceStatus(orgId, projectId, day).catch(() => null),
            ]);
            const nextRecords = asArray<ProjectAttendanceRecord>(roster);
            setRecords(nextRecords);
            setMyRecord(mine ?? nextRecords.find((row) => row.user_id === currentUserId) ?? null);
            if (day === todayKey) {
                onTodayRecordsChange?.(nextRecords);
            }
        } catch (err) {
            setError(apiErrorMessage(err, 'Could not load attendance.'));
        } finally {
            setLoading(false);
        }
    }, [currentUserId, day, onTodayRecordsChange, orgId, projectId, todayKey]);

    useEffect(() => {
        void load();
    }, [load]);

    const summary = useMemo(() => summarizeAttendance(records), [records]);
    const viewingToday = day === todayKey;
    const canCheckIn = viewingToday && !myRecord;
    const canCheckOut = viewingToday && myRecord?.status === 'checked_in';

    const submitAttendance = async (action: 'check-in' | 'check-out') => {
        setActing(true);
        setError(null);
        try {
            const location = await readBrowserLocation();
            const payload = attendanceEventPayload(location, { note });
            const updated = action === 'check-in'
                ? await projectAPI.checkInAttendance(orgId, projectId, payload)
                : await projectAPI.checkOutAttendance(orgId, projectId, payload);
            setMyRecord(updated);
            setNote('');
            await load();
        } catch (err) {
            setError(apiErrorMessage(err, `Could not ${action === 'check-in' ? 'check in' : 'check out'}.`));
        } finally {
            setActing(false);
        }
    };

    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Attendance</h2>
                    <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                        Day-of check-in and check-out{projectName ? ` for ${projectName}` : ''}. Agents check in from mobile; Studio shows the live roster.
                    </p>
                </div>
                <label className="block text-xs font-semibold text-[hsl(var(--text-secondary))]">
                    Day
                    <input
                        type="date"
                        value={day}
                        onChange={(event) => setDay(event.target.value)}
                        className="input mt-1"
                    />
                </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Checked in', value: String(summary.checkedIn) },
                    { label: 'In field', value: String(summary.inField) },
                    { label: 'Checked out', value: String(summary.checkedOut) },
                ].map((kpi) => (
                    <div
                        key={kpi.label}
                        className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] px-4 py-3"
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]">
                            {kpi.label}
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{kpi.value}</p>
                    </div>
                ))}
            </div>

            {viewingToday && (
                <section className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Your attendance</h3>
                            <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                {myRecord
                                    ? `${attendanceStatusLabel(myRecord.status)}${attendanceRowTime(myRecord) ? ` · ${attendanceRowTime(myRecord)}` : ''}`
                                    : 'Not checked in today'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={!canCheckIn || acting}
                                onClick={() => void submitAttendance('check-in')}
                                className="rounded-md bg-[hsl(var(--primary))] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                            >
                                Check in
                            </button>
                            <button
                                type="button"
                                disabled={!canCheckOut || acting}
                                onClick={() => void submitAttendance('check-out')}
                                className="rounded-md border border-[hsl(var(--border))] px-2.5 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] disabled:opacity-40"
                            >
                                Check out
                            </button>
                        </div>
                    </div>
                    {(canCheckIn || canCheckOut) && (
                        <input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Optional note"
                            className="input mt-3"
                        />
                    )}
                </section>
            )}

            {error && (
                <p className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-3 py-2 text-sm text-[hsl(var(--error))]">
                    {error}
                </p>
            )}

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                            {viewingToday ? 'Today’s roster' : 'Roster'}
                        </h3>
                        <p className="text-xs text-[hsl(var(--text-tertiary))]">
                            {loading ? 'Loading live attendance…' : `${summary.total} agent${summary.total === 1 ? '' : 's'} on the record`}
                        </p>
                    </div>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-[hsl(var(--text-secondary))]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading attendance
                    </div>
                ) : records.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[hsl(var(--text-tertiary))]">
                        No check-ins for this day.
                    </p>
                ) : (
                    <div className="divide-y divide-[hsl(var(--border))]/70">
                        {records.map((row) => (
                            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        {resolveAttendanceMemberLabel(row, members)}
                                    </p>
                                    <p className="text-xs text-[hsl(var(--text-tertiary))]">{attendanceRowNote(row)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-semibold text-[hsl(var(--text-secondary))]">
                                        {attendanceStatusLabel(row.status)}
                                    </p>
                                    <p className="text-[11px] tabular-nums text-[hsl(var(--text-tertiary))]">
                                        {attendanceRowTime(row)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default OpsAttendance;
