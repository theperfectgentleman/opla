import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Ban,
    CheckCircle2,
    FileUp,
    Loader2,
    Megaphone,
    RefreshCw,
    RotateCcw,
    Send,
    Users,
    Wallet,
    X,
} from 'lucide-react';

import { useToast } from '../../contexts/ToastContext';
import { broadcastAPI, teamAPI, type BroadcastContactPayload } from '../../lib/api';
import { apiErrorMessage, asArray } from '../../lib/opsApi';
import {
    countSegments,
    formatPhoneForDisplay,
    hasGsmLookalikes,
    hasNameToken,
    parseContactsCsv,
    parseManualNumbers,
    renderMessage,
    summarizeContacts,
    toGsmFriendly,
    type CsvImportResult,
} from '../../lib/smsBroadcast';

type ProviderStatus = {
    enabled: boolean;
    provider: string;
    sender_id?: string | null;
    issue?: string | null;
    can_send: boolean;
    batch_size: number;
    max_recipients: number;
};

type Balance = { available: boolean; balance?: number | null; bonus?: number | null; error?: string | null };

type Rejected = { input: string; name?: string | null; source: string; reason: string };

type Preview = {
    recipient_count: number;
    recipients: Array<{ phone: string; name?: string | null; sources: string[]; team_names: string[] }>;
    invalid: Rejected[];
    unsupported: Rejected[];
    opted_out: Rejected[];
    members_without_phone: Array<{ user_id: string; name: string; team_name: string }>;
    duplicates_removed: number;
    estimate: { encoding: string; length: number; parts: number; max_parts: number; estimated_credits: number };
    max_recipients: number;
};

type Broadcast = {
    id: string;
    body: string;
    status: 'queued' | 'sending' | 'completed' | 'partial' | 'failed' | string;
    provider: string;
    sender_id?: string | null;
    recipient_count: number;
    sent_count: number;
    failed_count: number;
    estimated_credits: number;
    credits_used?: number | null;
    last_error?: string | null;
    audience_json?: { teams?: Array<{ id: string; name: string }>; csv_count?: number; manual_count?: number } | null;
    creator?: { id: string; full_name: string } | null;
    created_at: string;
    completed_at?: string | null;
};

type Delivery = {
    id: string;
    phone: string;
    name?: string | null;
    sources?: string[] | null;
    team_names?: string[] | null;
    parts: number;
    status: 'queued' | 'sent' | 'failed' | string;
    error?: string | null;
    attempts: number;
    sent_at?: string | null;
};

type BroadcastDetail = Broadcast & { queued_count: number; deliveries: Delivery[] };

type OptOut = { id: string; phone: string; reason?: string | null; created_at: string };

type Team = { id: string; name: string; member_count?: number };

type Props = { orgId: string; projectId: string; projectName?: string };

const card = 'rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))]';
const label = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(var(--text-tertiary))]';
const input =
    'w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--text-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/30';
const primaryButton =
    'inline-flex items-center gap-2 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40';
const ghostButton =
    'inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))] disabled:opacity-40';

const STATUS_TONE: Record<string, string> = {
    queued: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    sending: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
    sent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[status] || STATUS_TONE.queued}`}>
        {status}
    </span>
);

function formatWhen(value?: string | null): string {
    if (!value) return '';
    // API timestamps are naive UTC.
    const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const RejectedList: React.FC<{ title: string; items: Rejected[]; tone: 'error' | 'muted' }> = ({ title, items, tone }) => {
    if (items.length === 0) return null;
    return (
        <details className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
            <summary className={`cursor-pointer font-semibold ${tone === 'error' ? 'text-[hsl(var(--error))]' : 'text-[hsl(var(--text-secondary))]'}`}>
                {title} ({items.length}) — skipped
            </summary>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {items.map((item, index) => (
                    <li key={`${item.input}-${index}`} className="flex justify-between gap-3 text-[hsl(var(--text-secondary))]">
                        <span className="font-mono">{item.input || '(blank)'}{item.name ? ` · ${item.name}` : ''}</span>
                        <span className="text-right text-[hsl(var(--text-tertiary))]">{item.reason}</span>
                    </li>
                ))}
            </ul>
        </details>
    );
};

const MessagesBroadcasts: React.FC<Props> = ({ orgId, projectId, projectName }) => {
    const { showToast } = useToast();
    const [provider, setProvider] = useState<ProviderStatus | null>(null);
    const [balance, setBalance] = useState<Balance | null>(null);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // compose
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [csv, setCsv] = useState<(CsvImportResult & { fileName: string }) | null>(null);
    const [manualText, setManualText] = useState('');
    const [message, setMessage] = useState('');
    const [nameFallback, setNameFallback] = useState('');
    const [preview, setPreview] = useState<Preview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [sending, setSending] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const messageRef = useRef<HTMLTextAreaElement>(null);

    // history
    const [history, setHistory] = useState<Broadcast[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<BroadcastDetail | null>(null);
    const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'queued' | 'sent' | 'failed'>('all');
    const [retrying, setRetrying] = useState(false);

    // opt-outs
    const [optOuts, setOptOuts] = useState<OptOut[]>([]);
    const [optOutPhone, setOptOutPhone] = useState('');

    const canSend = Boolean(provider?.can_send);
    const enabled = Boolean(provider?.enabled);

    const manualContacts = useMemo(() => parseManualNumbers(manualText), [manualText]);
    const manualSummary = useMemo(() => summarizeContacts(manualContacts), [manualContacts]);
    const csvSummary = useMemo(() => (csv ? summarizeContacts(csv.contacts) : null), [csv]);
    const contacts: BroadcastContactPayload[] = useMemo(
        () => [...(csv?.contacts || []), ...manualContacts],
        [csv, manualContacts],
    );
    const segments = useMemo(() => countSegments(message), [message]);
    const usesName = hasNameToken(message);
    const hasAudience = selectedTeams.length > 0 || contacts.length > 0;

    const loadBalance = useCallback(async () => {
        setBalanceLoading(true);
        try {
            setBalance(await broadcastAPI.balance(orgId, projectId));
        } catch (err) {
            setBalance({ available: false, error: apiErrorMessage(err, 'Could not load the SMS balance') });
        } finally {
            setBalanceLoading(false);
        }
    }, [orgId, projectId]);

    const loadHistory = useCallback(async () => {
        const rows = asArray<Broadcast>(await broadcastAPI.list(orgId, projectId));
        setHistory(rows);
        return rows;
    }, [orgId, projectId]);

    const loadOptOuts = useCallback(async () => {
        setOptOuts(asArray<OptOut>(await broadcastAPI.listOptOuts(orgId, projectId)));
    }, [orgId, projectId]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const status: ProviderStatus = await broadcastAPI.providerStatus(orgId, projectId);
                if (cancelled) return;
                setProvider(status);
                if (status.can_send) {
                    const [teamRows] = await Promise.all([teamAPI.list(orgId), loadHistory(), loadOptOuts()]);
                    if (cancelled) return;
                    setTeams(asArray<Team>(teamRows));
                    if (status.enabled) void loadBalance();
                }
            } catch (err) {
                if (!cancelled) setError(apiErrorMessage(err, 'Could not load broadcasts'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [orgId, projectId, loadBalance, loadHistory, loadOptOuts]);

    // Server preview (dedupe across teams/CSV/manual, opt-outs, exact credits), debounced.
    useEffect(() => {
        if (!canSend || !hasAudience) {
            setPreview(null);
            setPreviewError(null);
            return;
        }
        const handle = window.setTimeout(async () => {
            setPreviewLoading(true);
            try {
                const result: Preview = await broadcastAPI.preview(orgId, projectId, {
                    team_ids: selectedTeams,
                    contacts,
                    message,
                    name_fallback: nameFallback,
                });
                setPreview(result);
                setPreviewError(null);
            } catch (err) {
                setPreview(null);
                setPreviewError(apiErrorMessage(err, 'Could not build the recipient list'));
            } finally {
                setPreviewLoading(false);
            }
        }, 450);
        return () => window.clearTimeout(handle);
    }, [canSend, hasAudience, orgId, projectId, selectedTeams, contacts, message, nameFallback, optOuts]);

    // Selected broadcast detail, polled while it is still going out.
    const loadDetail = useCallback(
        async (id: string) => {
            const data: BroadcastDetail = await broadcastAPI.get(orgId, projectId, id);
            setDetail(data);
            return data;
        },
        [orgId, projectId],
    );

    useEffect(() => {
        if (!selectedId) {
            setDetail(null);
            return;
        }
        let timer: number | undefined;
        let stopped = false;
        const tick = async () => {
            try {
                const data = await loadDetail(selectedId);
                if (stopped) return;
                if (data.status === 'queued' || data.status === 'sending') {
                    timer = window.setTimeout(tick, 2500);
                } else {
                    void loadHistory();
                }
            } catch (err) {
                if (!stopped) setError(apiErrorMessage(err, 'Could not load the broadcast'));
            }
        };
        void tick();
        return () => {
            stopped = true;
            if (timer) window.clearTimeout(timer);
        };
    }, [selectedId, loadDetail, loadHistory]);

    const handleCsvFile = async (file: File | undefined) => {
        if (!file) return;
        const text = await file.text();
        const parsed = parseContactsCsv(text);
        if (parsed.error) {
            showToast('CSV not imported', parsed.error, 'error');
            return;
        }
        setCsv({ ...parsed, fileName: file.name });
        if (fileRef.current) fileRef.current.value = '';
    };

    const insertNameToken = () => {
        const el = messageRef.current;
        if (!el) {
            setMessage((prev) => `${prev}{name}`);
            return;
        }
        const start = el.selectionStart ?? message.length;
        const end = el.selectionEnd ?? message.length;
        const next = `${message.slice(0, start)}{name}${message.slice(end)}`;
        setMessage(next);
        window.requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + 6, start + 6);
        });
    };

    const resetCompose = () => {
        setSelectedTeams([]);
        setCsv(null);
        setManualText('');
        setMessage('');
        setNameFallback('');
        setPreview(null);
        setConfirming(false);
    };

    const handleSend = async () => {
        if (!preview) return;
        setSending(true);
        try {
            const created: Broadcast = await broadcastAPI.send(orgId, projectId, {
                team_ids: selectedTeams,
                contacts,
                message: message.trim(),
                name_fallback: nameFallback,
                expected_recipient_count: preview.recipient_count,
            });
            showToast('Broadcast queued', `Sending to ${created.recipient_count} people in batches of ${provider?.batch_size ?? 100}.`);
            resetCompose();
            await loadHistory();
            setSelectedId(created.id);
            void loadBalance();
        } catch (err) {
            showToast('Broadcast not sent', apiErrorMessage(err, 'Send failed'), 'error');
            setConfirming(false);
        } finally {
            setSending(false);
        }
    };

    const handleRetry = async () => {
        if (!detail) return;
        setRetrying(true);
        try {
            const result = await broadcastAPI.retryFailed(orgId, projectId, detail.id);
            showToast('Retrying', `${result.requeued} failed recipient(s) queued again.`);
            await loadDetail(detail.id);
            setSelectedId(null);
            window.setTimeout(() => setSelectedId(detail.id), 0);
        } catch (err) {
            showToast('Retry failed', apiErrorMessage(err, 'Could not retry'), 'error');
        } finally {
            setRetrying(false);
        }
    };

    const addOptOut = async (phone: string, reason?: string) => {
        try {
            await broadcastAPI.addOptOut(orgId, projectId, { phone, reason });
            setOptOutPhone('');
            await loadOptOuts();
            showToast('Added to do-not-text list', formatPhoneForDisplay(phone));
        } catch (err) {
            showToast('Not added', apiErrorMessage(err, 'Could not add the number'), 'error');
        }
    };

    const removeOptOut = async (row: OptOut) => {
        try {
            await broadcastAPI.removeOptOut(orgId, projectId, row.id);
            await loadOptOuts();
        } catch (err) {
            showToast('Not removed', apiErrorMessage(err, 'Could not remove the number'), 'error');
        }
    };

    const optedOutPhones = useMemo(() => new Set(optOuts.map((row) => row.phone)), [optOuts]);
    const visibleDeliveries = useMemo(
        () => (detail?.deliveries || []).filter((d) => deliveryFilter === 'all' || d.status === deliveryFilter),
        [detail, deliveryFilter],
    );
    const sampleRecipient = preview?.recipients[0];
    const balanceShort =
        preview && balance?.available && typeof balance.balance === 'number'
            ? preview.estimate.estimated_credits > balance.balance
            : false;
    const tooMany = preview ? preview.recipient_count > preview.max_recipients : false;
    const sendDisabled =
        !enabled || !preview || preview.recipient_count === 0 || !message.trim() || previewLoading || tooMany || sending;

    if (loading) {
        return (
            <div className="flex h-48 items-center justify-center text-[hsl(var(--text-tertiary))]">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (error && !provider) {
        return (
            <p className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-3 py-2 text-sm text-[hsl(var(--error))]">
                {error}
            </p>
        );
    }

    if (!canSend) {
        return (
            <div className={`${card} p-6`}>
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                        <Megaphone className="h-4 w-4" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-[hsl(var(--text-primary))]">SMS broadcasts</h2>
                        <p className="text-sm text-[hsl(var(--text-secondary))]">
                            Only organisation admins, project managers and field supervisors can send SMS broadcasts for this project.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 px-1">
                <div>
                    <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))]">SMS broadcasts</h2>
                    <p className="text-sm text-[hsl(var(--text-secondary))]">
                        Text field teams{projectName ? ` on ${projectName}` : ''}, a CSV list, or numbers you type.
                        {provider?.sender_id ? <> Messages come from <span className="font-semibold">{provider.sender_id}</span>.</> : null}
                    </p>
                </div>
                {enabled && (
                    <div className={`${card} flex items-center gap-3 px-4 py-2`}>
                        <Wallet className="h-4 w-4 text-[hsl(var(--primary))]" />
                        <div>
                            <p className={label}>SMS balance</p>
                            <p className="text-sm font-semibold tabular-nums text-[hsl(var(--text-primary))]">
                                {balance?.available
                                    ? `${balance.balance ?? 0} credits${balance.bonus ? ` + ${balance.bonus} bonus` : ''}`
                                    : balance?.error || '—'}
                            </p>
                        </div>
                        <button type="button" onClick={() => void loadBalance()} className="text-[hsl(var(--text-tertiary))]" title="Refresh balance">
                            <RefreshCw className={`h-3.5 w-3.5 ${balanceLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                )}
            </div>

            {!enabled && (
                <div className="flex items-start gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                        <p className="font-semibold">SMS sending is switched off on this server.</p>
                        <p>{provider?.issue || 'Ask an admin to configure the SMS provider.'} You can still prepare a message and check recipients.</p>
                    </div>
                </div>
            )}

            {error && (
                <p className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-3 py-2 text-sm text-[hsl(var(--error))]">{error}</p>
            )}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
                {/* Compose */}
                <section className={`${card} space-y-5 p-5`}>
                    <div>
                        <p className={label}>1 · Recipients</p>
                        <div className="mt-3 space-y-4">
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                    <Users className="h-4 w-4" /> Teams
                                </div>
                                {teams.length === 0 ? (
                                    <p className="text-xs text-[hsl(var(--text-tertiary))]">No teams in this organisation yet. Create them under Teams.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {teams.map((team) => {
                                            const active = selectedTeams.includes(team.id);
                                            return (
                                                <button
                                                    key={team.id}
                                                    type="button"
                                                    onClick={() =>
                                                        setSelectedTeams((prev) =>
                                                            active ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                                                        )
                                                    }
                                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                                        active
                                                            ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                            : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                                                    }`}
                                                >
                                                    {active ? '✓ ' : ''}
                                                    {team.name}
                                                    {typeof team.member_count === 'number' ? ` · ${team.member_count}` : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--text-primary))]">
                                        <FileUp className="h-4 w-4" /> CSV import
                                    </span>
                                    <span className="text-[11px] text-[hsl(var(--text-tertiary))]">
                                        Column named phone / number / msisdn (or the first column); optional name column
                                    </span>
                                </div>
                                {csv ? (
                                    <div className="flex items-start justify-between gap-3 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--text-secondary))]">
                                        <div>
                                            <p className="font-semibold text-[hsl(var(--text-primary))]">{csv.fileName}</p>
                                            <p>
                                                {csv.contacts.length} rows · {csvSummary?.unique ?? 0} unique valid
                                                {csvSummary && csvSummary.invalid.length > 0 ? ` · ${csvSummary.invalid.length} invalid` : ''}
                                                {csv.skippedBlank ? ` · ${csv.skippedBlank} blank` : ''}
                                            </p>
                                            <p className="text-[hsl(var(--text-tertiary))]">
                                                Phone column: {csv.phoneColumn || 'first column'}
                                                {csv.nameColumn ? ` · Name column: ${csv.nameColumn}` : ''}
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => setCsv(null)} className="text-[hsl(var(--text-tertiary))]" title="Remove CSV">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex cursor-pointer items-center justify-center rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-4 text-xs font-semibold text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--surface-elevated))]">
                                        Choose a .csv file
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept=".csv,.txt,text/csv,text/plain"
                                            className="hidden"
                                            onChange={(event) => void handleCsvFile(event.target.files?.[0])}
                                        />
                                    </label>
                                )}
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-[hsl(var(--text-primary))]">Type or paste numbers</span>
                                    {manualContacts.length > 0 && (
                                        <span className="text-[11px] text-[hsl(var(--text-tertiary))]">
                                            {manualSummary.unique} valid{manualSummary.invalid.length ? ` · ${manualSummary.invalid.length} invalid` : ''}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={manualText}
                                    onChange={(event) => setManualText(event.target.value)}
                                    rows={2}
                                    placeholder="0244 123 456, +233 20 123 4567, +44 7700 900123"
                                    className={input}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <p className={label}>2 · Message</p>
                            <button type="button" onClick={insertNameToken} className={ghostButton} title="Insert the recipient's first name">
                                + {'{name}'}
                            </button>
                        </div>
                        <textarea
                            ref={messageRef}
                            value={message}
                            onChange={(event) => setMessage(event.target.value)}
                            rows={5}
                            maxLength={1600}
                            placeholder="Site closed today — do not visit. Check the app for tomorrow's route."
                            className={`${input} mt-2`}
                        />
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[hsl(var(--text-tertiary))]">
                            <span className="tabular-nums">
                                {segments.length} chars · {segments.encoding === 'gsm7' ? 'GSM' : 'Unicode'} · {segments.parts} SMS part
                                {segments.parts === 1 ? '' : 's'} · {segments.remaining} left in this part
                            </span>
                            {usesName && <span>{'{name}'} becomes each person’s first name; counts use the real names</span>}
                        </div>
                        {segments.encoding === 'unicode' && segments.unicodeChars.length > 0 && (
                            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                                These characters switch the message to Unicode (70 characters per SMS instead of 160):{' '}
                                <span className="font-mono">{segments.unicodeChars.slice(0, 8).map((ch) => `“${ch}”`).join(' ')}</span>
                                {hasGsmLookalikes(message) && (
                                    <button
                                        type="button"
                                        onClick={() => setMessage(toGsmFriendly(message))}
                                        className="ml-2 font-semibold underline"
                                    >
                                        Replace smart punctuation
                                    </button>
                                )}
                            </p>
                        )}
                        {usesName && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--text-secondary))]">
                                <span>If a name is missing, use</span>
                                <input
                                    value={nameFallback}
                                    onChange={(event) => setNameFallback(event.target.value)}
                                    placeholder="(leave blank to drop it)"
                                    className={`${input} max-w-[200px] py-1 text-xs`}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <p className={label}>3 · Review</p>
                        {!hasAudience ? (
                            <p className="mt-2 text-sm text-[hsl(var(--text-tertiary))]">Pick a team, import a CSV or type numbers to see who gets the message.</p>
                        ) : previewError ? (
                            <p className="mt-2 text-sm text-[hsl(var(--error))]">{previewError}</p>
                        ) : !preview ? (
                            <p className="mt-2 flex items-center gap-2 text-sm text-[hsl(var(--text-tertiary))]">
                                <Loader2 className="h-4 w-4 animate-spin" /> Building the recipient list…
                            </p>
                        ) : (
                            <div className="mt-2 space-y-3">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-md border border-[hsl(var(--border))] px-3 py-2">
                                        <p className={label}>Recipients</p>
                                        <p className="text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                                            {preview.recipient_count}
                                            {previewLoading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
                                        </p>
                                    </div>
                                    <div className="rounded-md border border-[hsl(var(--border))] px-3 py-2">
                                        <p className={label}>Parts × people</p>
                                        <p className="text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">
                                            {preview.estimate.max_parts > preview.estimate.parts
                                                ? `≤${preview.estimate.max_parts}`
                                                : preview.estimate.parts || segments.parts}{' '}
                                            × {preview.recipient_count}
                                        </p>
                                    </div>
                                    <div className={`rounded-md border px-3 py-2 ${balanceShort ? 'border-rose-300 bg-rose-50 dark:bg-rose-900/20' : 'border-[hsl(var(--border))]'}`}>
                                        <p className={label}>Estimated credits</p>
                                        <p className="text-xl font-bold tabular-nums text-[hsl(var(--text-primary))]">{preview.estimate.estimated_credits}</p>
                                        {balanceShort && <p className="text-[11px] text-rose-700 dark:text-rose-300">More than the current balance</p>}
                                    </div>
                                </div>
                                <p className="text-xs text-[hsl(var(--text-tertiary))]">
                                    {preview.duplicates_removed > 0 ? `${preview.duplicates_removed} duplicate number(s) merged. ` : ''}
                                    Credits are an estimate (1 credit per SMS part); mNotify reports the real figure after sending.
                                </p>
                                {tooMany && (
                                    <p className="text-sm text-[hsl(var(--error))]">
                                        That is more than {preview.max_recipients} recipients. Split the list into smaller broadcasts.
                                    </p>
                                )}
                                <RejectedList title="Invalid numbers" items={preview.invalid} tone="error" />
                                <RejectedList title="Outside the SMS route" items={preview.unsupported} tone="muted" />
                                <RejectedList title="Opted out" items={preview.opted_out} tone="muted" />
                                {preview.members_without_phone.length > 0 && (
                                    <details className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
                                        <summary className="cursor-pointer font-semibold text-[hsl(var(--text-secondary))]">
                                            Team members without a phone number ({preview.members_without_phone.length}) — skipped
                                        </summary>
                                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[hsl(var(--text-secondary))]">
                                            {preview.members_without_phone.map((member) => (
                                                <li key={`${member.user_id}-${member.team_name}`}>
                                                    {member.name} <span className="text-[hsl(var(--text-tertiary))]">· {member.team_name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                )}
                                {preview.recipients.length > 0 && (
                                    <details className="rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs">
                                        <summary className="cursor-pointer font-semibold text-[hsl(var(--text-secondary))]">
                                            Show recipients ({preview.recipients.length})
                                        </summary>
                                        <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                                            {preview.recipients.slice(0, 500).map((recipient) => (
                                                <li key={recipient.phone} className="flex justify-between gap-3 text-[hsl(var(--text-secondary))]">
                                                    <span>{recipient.name || '—'}</span>
                                                    <span className="font-mono">{formatPhoneForDisplay(recipient.phone)}</span>
                                                    <span className="text-right text-[hsl(var(--text-tertiary))]">
                                                        {recipient.team_names.length ? recipient.team_names.join(', ') : recipient.sources.join(', ')}
                                                    </span>
                                                </li>
                                            ))}
                                            {preview.recipients.length > 500 && (
                                                <li className="text-[hsl(var(--text-tertiary))]">…and {preview.recipients.length - 500} more</li>
                                            )}
                                        </ul>
                                    </details>
                                )}
                            </div>
                        )}
                    </div>

                    {confirming && preview ? (
                        <div className="space-y-3 rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-4">
                            <p className="text-sm font-semibold text-[hsl(var(--text-primary))]">
                                Send this SMS to {preview.recipient_count} {preview.recipient_count === 1 ? 'person' : 'people'}?
                            </p>
                            <p className="text-xs text-[hsl(var(--text-secondary))]">
                                About {preview.estimate.estimated_credits} credits
                                {balance?.available ? ` of ${balance.balance ?? 0} available` : ''}. From {provider?.sender_id || 'the configured sender'}.
                                This cannot be undone.
                            </p>
                            <pre className="whitespace-pre-wrap rounded-md bg-[hsl(var(--surface))] px-3 py-2 text-xs text-[hsl(var(--text-primary))]">
                                {renderMessage(message.trim(), sampleRecipient?.name, nameFallback)}
                            </pre>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => void handleSend()} disabled={sending} className={primaryButton}>
                                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    Yes, send now
                                </button>
                                <button type="button" onClick={() => setConfirming(false)} disabled={sending} className={ghostButton}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setConfirming(true)} disabled={sendDisabled} className={primaryButton}>
                                <Send className="h-4 w-4" /> Review and send
                            </button>
                            {(hasAudience || message) && (
                                <button type="button" onClick={resetCompose} className={ghostButton}>
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* History */}
                <section className="space-y-4">
                    <div className={`${card} overflow-hidden`}>
                        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3">
                            <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Sent broadcasts</h3>
                            <button type="button" onClick={() => void loadHistory()} className="text-[hsl(var(--text-tertiary))]" title="Refresh">
                                <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {history.length === 0 ? (
                            <p className="px-4 py-6 text-sm text-[hsl(var(--text-tertiary))]">Nothing sent from this project yet.</p>
                        ) : (
                            <ul className="max-h-80 divide-y divide-[hsl(var(--border))] overflow-y-auto">
                                {history.map((row) => (
                                    <li key={row.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                                            className={`w-full px-4 py-3 text-left hover:bg-[hsl(var(--surface-elevated))] ${row.id === selectedId ? 'bg-[hsl(var(--primary))]/5' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs text-[hsl(var(--text-tertiary))]">
                                                    {formatWhen(row.created_at)}
                                                    {row.creator ? ` · ${row.creator.full_name}` : ''}
                                                </span>
                                                <StatusBadge status={row.status} />
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-sm text-[hsl(var(--text-primary))]">{row.body}</p>
                                            <p className="mt-1 text-[11px] tabular-nums text-[hsl(var(--text-tertiary))]">
                                                {row.sent_count}/{row.recipient_count} sent
                                                {row.failed_count ? ` · ${row.failed_count} failed` : ''} ·{' '}
                                                {row.credits_used != null ? `${row.credits_used} credits used` : `~${row.estimated_credits} credits`}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {detail && (
                        <div className={`${card} overflow-hidden`}>
                            <div className="space-y-2 border-b border-[hsl(var(--border))] px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))]">Delivery log</h3>
                                    <div className="flex items-center gap-2">
                                        <StatusBadge status={detail.status} />
                                        <button type="button" onClick={() => setSelectedId(null)} className="text-[hsl(var(--text-tertiary))]" title="Close">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="whitespace-pre-wrap text-xs text-[hsl(var(--text-secondary))]">{detail.body}</p>
                                {detail.audience_json?.teams?.length ? (
                                    <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Teams: {detail.audience_json.teams.map((t) => t.name).join(', ')}</p>
                                ) : null}
                                {detail.last_error && detail.status !== 'completed' && (
                                    <p className="text-[11px] text-[hsl(var(--error))]">Last error: {detail.last_error}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    {(['all', 'sent', 'failed', 'queued'] as const).map((key) => {
                                        const count = key === 'all' ? detail.deliveries.length : detail.deliveries.filter((d) => d.status === key).length;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setDeliveryFilter(key)}
                                                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                                                    deliveryFilter === key
                                                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]'
                                                        : 'border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]'
                                                }`}
                                            >
                                                {key} {count}
                                            </button>
                                        );
                                    })}
                                    {detail.failed_count > 0 && (
                                        <button type="button" onClick={() => void handleRetry()} disabled={retrying || !enabled} className={`${ghostButton} ml-auto`}>
                                            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                                            Retry {detail.failed_count} failed
                                        </button>
                                    )}
                                </div>
                            </div>
                            <ul className="max-h-96 divide-y divide-[hsl(var(--border))] overflow-y-auto text-xs">
                                {visibleDeliveries.map((delivery) => (
                                    <li key={delivery.id} className="flex items-start justify-between gap-3 px-4 py-2">
                                        <div className="min-w-0">
                                            <p className="font-medium text-[hsl(var(--text-primary))]">{delivery.name || '—'}</p>
                                            <p className="font-mono text-[hsl(var(--text-secondary))]">{formatPhoneForDisplay(delivery.phone)}</p>
                                            {delivery.error && <p className="text-[hsl(var(--error))]">{delivery.error}</p>}
                                            <p className="text-[hsl(var(--text-tertiary))]">
                                                {(delivery.team_names?.length ? delivery.team_names : delivery.sources || []).join(', ')}
                                                {delivery.attempts > 1 ? ` · ${delivery.attempts} attempts` : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <StatusBadge status={delivery.status} />
                                            {optedOutPhones.has(delivery.phone) ? (
                                                <span className="text-[10px] text-[hsl(var(--text-tertiary))]">opted out</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => void addOptOut(delivery.phone, 'Marked from delivery log')}
                                                    className="inline-flex items-center gap-1 text-[10px] text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]"
                                                    title="Never text this number again from this organisation"
                                                >
                                                    <Ban className="h-3 w-3" /> opt out
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                                {visibleDeliveries.length === 0 && <li className="px-4 py-4 text-[hsl(var(--text-tertiary))]">No recipients in this view.</li>}
                            </ul>
                            <p className="border-t border-[hsl(var(--border))] px-4 py-2 text-[10px] text-[hsl(var(--text-tertiary))]">
                                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                                “Sent” means mNotify accepted the message for delivery. Handset delivery reports are not tracked yet.
                            </p>
                        </div>
                    )}

                    <details className={`${card} px-4 py-3`}>
                        <summary className="cursor-pointer text-sm font-semibold text-[hsl(var(--text-primary))]">
                            Do-not-text list ({optOuts.length})
                        </summary>
                        <p className="mt-2 text-xs text-[hsl(var(--text-tertiary))]">
                            Numbers here are skipped by every broadcast in this organisation.
                        </p>
                        <form
                            className="mt-2 flex gap-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (optOutPhone.trim()) void addOptOut(optOutPhone.trim());
                            }}
                        >
                            <input value={optOutPhone} onChange={(event) => setOptOutPhone(event.target.value)} placeholder="0244 123 456" className={`${input} py-1.5 text-xs`} />
                            <button type="submit" className={ghostButton} disabled={!optOutPhone.trim()}>
                                Add
                            </button>
                        </form>
                        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                            {optOuts.map((row) => (
                                <li key={row.id} className="flex items-center justify-between gap-2 text-[hsl(var(--text-secondary))]">
                                    <span className="font-mono">{formatPhoneForDisplay(row.phone)}</span>
                                    <span className="truncate text-[hsl(var(--text-tertiary))]">{row.reason || ''}</span>
                                    <button type="button" onClick={() => void removeOptOut(row)} className="text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--error))]" title="Remove">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </details>
                </section>
            </div>
        </div>
    );
};

export default MessagesBroadcasts;
