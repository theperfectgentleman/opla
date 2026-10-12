import React, { useCallback, useEffect, useState } from 'react';
import { aiCreditsAPI } from '../../lib/api';
import {
    type AiCreditLedgerEntry,
    type AiCreditWallet,
    aiCreditEntryLabel,
    formatAiCreditAmount,
} from '../../lib/aiCredits';

type AiCreditsPanelProps = {
    orgId: string;
    canManage: boolean;
};

const AiCreditsPanel: React.FC<AiCreditsPanelProps> = ({ orgId, canManage }) => {
    const [wallet, setWallet] = useState<AiCreditWallet | null>(null);
    const [entries, setEntries] = useState<AiCreditLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [topUpAmount, setTopUpAmount] = useState('');
    const [topUpNote, setTopUpNote] = useState('');
    const [savingTopUp, setSavingTopUp] = useState(false);
    const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
    const [savingCost, setSavingCost] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const next = await aiCreditsAPI.getWallet(orgId);
            setWallet(next);
            setCostDrafts(
                Object.fromEntries(next.action_costs.map((row) => [row.action_key, String(row.credit_cost)])),
            );
            if (canManage) {
                const ledger = await aiCreditsAPI.listLedger(orgId);
                setEntries(ledger.entries || []);
            } else {
                setEntries([]);
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || err?.message || 'Could not load AI credits');
        } finally {
            setLoading(false);
        }
    }, [canManage, orgId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleTopUp = async (event: React.FormEvent) => {
        event.preventDefault();
        const amount = Number(topUpAmount);
        if (!Number.isInteger(amount) || amount <= 0) {
            setError('Enter a whole number of AI credits to add.');
            return;
        }
        setSavingTopUp(true);
        setError('');
        try {
            await aiCreditsAPI.topUp(orgId, { amount, note: topUpNote.trim() || undefined });
            setTopUpAmount('');
            setTopUpNote('');
            await load();
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : err?.message || 'Top-up failed');
        } finally {
            setSavingTopUp(false);
        }
    };

    const handleSaveCost = async (actionKey: string) => {
        const creditCost = Number(costDrafts[actionKey]);
        if (!Number.isInteger(creditCost) || creditCost < 0) {
            setError('AI action cost must be a whole number of credits, zero or more.');
            return;
        }
        setSavingCost(actionKey);
        setError('');
        try {
            await aiCreditsAPI.updateActionCost(orgId, actionKey, creditCost);
            await load();
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            setError(typeof detail === 'string' ? detail : err?.message || 'Could not update AI action cost');
        } finally {
            setSavingCost(null);
        }
    };

    return (
        <div className="card" data-testid="ai-credits-panel">
            <div className="space-y-6">
                <div>
                    <h4 className="text-sm font-bold mb-1 text-[hsl(var(--text-primary))]">AI credits</h4>
                    <p className="text-xs text-[hsl(var(--text-secondary))]">
                        Each organization has its own AI credit balance. AI features such as the survey wizard spend these credits. AI credits are separate from any future SMS costs.
                    </p>
                </div>

                {error ? (
                    <p className="text-sm text-[hsl(var(--error))]" data-testid="ai-credits-error">{error}</p>
                ) : null}

                <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--text-tertiary))]">Balance</p>
                    <p className="text-3xl font-bold mt-1" data-testid="ai-credits-balance">
                        {loading && !wallet ? '…' : wallet?.balance ?? 0}
                    </p>
                    <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">AI credits remaining</p>
                </div>

                <div className="border-t border-[hsl(var(--border))] pt-5 space-y-3">
                    <div>
                        <h5 className="text-sm font-bold">AI action costs</h5>
                        <p className="text-xs text-[hsl(var(--text-secondary))]">
                            How many AI credits each action spends. Change the units here — they are stored per organization, not hard-coded.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {(wallet?.action_costs || []).map((row) => (
                            <div key={row.action_key} className="flex flex-wrap items-center gap-2">
                                <span className="text-sm min-w-[12rem]">{row.label}</span>
                                {canManage ? (
                                    <>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={costDrafts[row.action_key] ?? ''}
                                            onChange={(event) =>
                                                setCostDrafts((prev) => ({ ...prev, [row.action_key]: event.target.value }))
                                            }
                                            className="input w-24"
                                            aria-label={`${row.label} AI credit cost`}
                                            data-testid={`ai-credits-cost-${row.action_key}`}
                                        />
                                        <button
                                            type="button"
                                            className="px-3 py-2 rounded-md border border-[hsl(var(--border))] text-xs font-semibold"
                                            disabled={savingCost === row.action_key}
                                            onClick={() => void handleSaveCost(row.action_key)}
                                        >
                                            Save
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-sm font-semibold">{row.credit_cost}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {canManage ? (
                    <form onSubmit={handleTopUp} className="border-t border-[hsl(var(--border))] pt-5 space-y-3">
                        <div>
                            <h5 className="text-sm font-bold">Manual top-up</h5>
                            <p className="text-xs text-[hsl(var(--text-secondary))]">
                                Add AI credits after payment is received by MoMo or invoice. This does not charge a card.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={topUpAmount}
                                onChange={(event) => setTopUpAmount(event.target.value)}
                                className="input w-32"
                                placeholder="Amount"
                                aria-label="AI credits to add"
                                data-testid="ai-credits-topup-amount"
                            />
                            <input
                                type="text"
                                value={topUpNote}
                                onChange={(event) => setTopUpNote(event.target.value)}
                                className="input flex-1 min-w-[12rem]"
                                placeholder="Note (MoMo or invoice reference)"
                                aria-label="Top-up note"
                                data-testid="ai-credits-topup-note"
                            />
                            <button
                                type="submit"
                                disabled={savingTopUp}
                                className="px-4 py-2 rounded-md bg-[hsl(var(--primary))] text-white text-sm font-semibold disabled:opacity-50"
                                data-testid="ai-credits-topup-submit"
                            >
                                Add AI credits
                            </button>
                        </div>
                    </form>
                ) : (
                    <p className="text-xs text-[hsl(var(--text-secondary))] border-t border-[hsl(var(--border))] pt-5">
                        An organization admin adds AI credits after payment. Ask an admin to top up when this balance is not enough for an AI action.
                    </p>
                )}

                {canManage ? (
                    <div className="border-t border-[hsl(var(--border))] pt-5 space-y-3">
                        <h5 className="text-sm font-bold">AI credit history</h5>
                        {entries.length === 0 ? (
                            <p className="text-xs text-[hsl(var(--text-secondary))]" data-testid="ai-credits-history">
                                No AI credit activity yet.
                            </p>
                        ) : (
                            <div className="overflow-x-auto" data-testid="ai-credits-history">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wider text-[hsl(var(--text-tertiary))]">
                                            <th className="py-2 pr-3 font-bold">When</th>
                                            <th className="py-2 pr-3 font-bold">Type</th>
                                            <th className="py-2 pr-3 font-bold">Action</th>
                                            <th className="py-2 pr-3 font-bold">Change</th>
                                            <th className="py-2 pr-3 font-bold">Balance</th>
                                            <th className="py-2 font-bold">Note</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry) => (
                                            <tr key={entry.id} className="border-t border-[hsl(var(--border))]">
                                                <td className="py-2 pr-3 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                                                <td className="py-2 pr-3">{aiCreditEntryLabel(entry.entry_type)}</td>
                                                <td className="py-2 pr-3">{entry.action_key || '—'}</td>
                                                <td className="py-2 pr-3 font-semibold">{formatAiCreditAmount(entry.amount)}</td>
                                                <td className="py-2 pr-3">{entry.balance_after}</td>
                                                <td className="py-2">{entry.note || entry.actor_name || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default AiCreditsPanel;
