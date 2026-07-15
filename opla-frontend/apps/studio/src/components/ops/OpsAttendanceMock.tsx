import React from 'react';
import { MapPin } from 'lucide-react';

type OpsAttendanceMockProps = {
    projectName?: string;
};

const MOCK_ROWS = [
    { name: 'Ama Mensah', status: 'Checked in', time: '08:42', note: 'Field team — Zone A' },
    { name: 'Kwame Boateng', status: 'Checked out', time: '16:10', note: 'Completed route' },
    { name: 'Efua Darko', status: 'Checked in', time: '09:05', note: 'Awaiting assignment' },
];

const OpsAttendanceMock: React.FC<OpsAttendanceMockProps> = ({ projectName }) => {
    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <div>
                <h2 className="text-2xl font-bold text-[hsl(var(--text-primary))]">Attendance</h2>
                <p className="mt-1 text-sm text-[hsl(var(--text-secondary))]">
                    Day-of check-in and check-out{projectName ? ` for ${projectName}` : ''}. Mock layout — wiring comes next.
                </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    { label: 'Expected', value: '12' },
                    { label: 'Checked in', value: '8' },
                    { label: 'Checked out', value: '3' },
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

            <section className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]">
                <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] px-4 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Today’s roster</h3>
                        <p className="text-xs text-[hsl(var(--text-tertiary))]">Sample agents — not live data</p>
                    </div>
                </div>
                <div className="divide-y divide-[hsl(var(--border))]/70">
                    {MOCK_ROWS.map((row) => (
                        <div key={row.name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                            <div>
                                <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">{row.name}</p>
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">{row.note}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-[hsl(var(--text-secondary))]">{row.status}</p>
                                <p className="text-[11px] tabular-nums text-[hsl(var(--text-tertiary))]">{row.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default OpsAttendanceMock;
