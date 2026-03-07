import React, { useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Link2, Shield } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import StudioLayout from '../components/StudioLayout';
import { useOrg } from '../contexts/OrgContext';
import { useToast } from '../contexts/ToastContext';
import { orgAPI } from '../lib/api';

type AcceptResponse = {
    status: 'accepted' | 'pending_review';
    invitation: {
        id: string;
        org_id: string;
        org_name?: string | null;
        team_id?: string | null;
        team_name?: string | null;
        invitation_type: 'organization' | 'team';
        member_type: 'internal' | 'contractor';
        delivery_mode: 'email' | 'short_link' | 'generated_link' | 'pin_code';
        approval_mode: 'auto' | 'review';
        status: 'pending' | 'approved' | 'accepted' | 'revoked' | 'declined';
        invited_email?: string | null;
        token?: string | null;
        pin_code?: string | null;
        claimed_at?: string | null;
        approved_at?: string | null;
        accepted_at?: string | null;
        expires_at?: string | null;
        created_at: string;
        updated_at: string;
    };
    membership?: {
        id: string;
        org_id?: string;
        user_id: string;
        global_role: 'admin' | 'member';
        member_type: 'internal' | 'contractor';
        invitation_status: 'pending' | 'accepted';
        joined_at: string;
    } | null;
};

const InvitationAccept: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshOrganizations } = useOrg();
    const { showToast } = useToast();

    const initialToken = searchParams.get('token') || '';
    const initialPin = searchParams.get('pin') || '';

    const [token, setToken] = useState(initialToken);
    const [pinCode, setPinCode] = useState(initialPin);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<AcceptResponse | null>(null);

    const mode = useMemo<'token' | 'pin'>(() => (pinCode && !token ? 'pin' : 'token'), [pinCode, token]);

    const handleAccept = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setResult(null);

        const trimmedToken = token.trim();
        const trimmedPin = pinCode.trim();
        if ((trimmedToken ? 1 : 0) + (trimmedPin ? 1 : 0) !== 1) {
            setError('Provide exactly one invitation token or PIN code.');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await orgAPI.acceptInvitation({
                token: trimmedToken || undefined,
                pin_code: trimmedPin || undefined,
            });
            setResult(response);
            await refreshOrganizations();
            if (response.status === 'accepted') {
                showToast('Invitation accepted', 'Your membership has been activated.', 'success');
            } else {
                showToast('Pending review', 'Your claim was recorded and is waiting for approval.', 'info');
            }
        } catch (err: any) {
            const detail = err?.response?.data?.detail || err?.message || 'Failed to accept invitation';
            setError(detail);
            showToast('Invitation failed', detail, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopy = async (value?: string | null) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            showToast('Copied', 'Invitation value copied to clipboard.', 'success');
        } catch {
            showToast('Copy failed', 'Clipboard access was not available.', 'error');
        }
    };

    return (
        <StudioLayout
            activeNav="members"
            onSelectNav={(key) => navigate(`/dashboard?tab=${key}`)}
            contentClassName="flex-1 overflow-y-auto p-10"
        >
            <div className="mx-auto max-w-3xl space-y-8">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">Accept Invitation</h1>
                    <p className="text-[hsl(var(--text-secondary))]">
                        Join an organization or team by pasting the invitation token or contractor PIN you received.
                    </p>
                </div>

                <section className="rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-sm">
                    <form onSubmit={handleAccept} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <label className="space-y-3">
                                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                    <Link2 className="h-4 w-4" />
                                    Invitation Token
                                </span>
                                <input
                                    value={token}
                                    onChange={(event) => {
                                        setToken(event.target.value);
                                        if (event.target.value) {
                                            setPinCode('');
                                        }
                                    }}
                                    placeholder="Paste the generated or short-link token"
                                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm"
                                />
                            </label>

                            <label className="space-y-3">
                                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                    <KeyRound className="h-4 w-4" />
                                    Contractor PIN
                                </span>
                                <input
                                    value={pinCode}
                                    onChange={(event) => {
                                        const nextValue = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                                        setPinCode(nextValue);
                                        if (nextValue) {
                                            setToken('');
                                        }
                                    }}
                                    placeholder="Enter the 6-digit team PIN"
                                    className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 text-sm tracking-[0.2em]"
                                />
                            </label>
                        </div>

                        {error ? (
                            <div className="rounded-md border border-[hsl(var(--error))]/20 bg-[hsl(var(--error))]/10 px-4 py-3 text-sm text-[hsl(var(--error))]">
                                {error}
                            </div>
                        ) : null}

                        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-4 text-sm text-[hsl(var(--text-secondary))]">
                            Internal invitations accept email or short-link tokens. Contractor invitations accept generated-link tokens or team PINs.
                        </div>

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">
                                Current mode: {mode === 'pin' ? 'PIN code' : 'Token'}
                            </span>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="rounded-md bg-[hsl(var(--primary))] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Accepting...' : 'Accept Invitation'}
                            </button>
                        </div>
                    </form>
                </section>

                {result ? (
                    <section className="rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-8 shadow-sm">
                        <div className="flex items-start gap-4">
                            {result.status === 'accepted' ? (
                                <CheckCircle2 className="mt-1 h-7 w-7 text-[#22c55e]" />
                            ) : (
                                <Shield className="mt-1 h-7 w-7 text-[#3b82f6]" />
                            )}
                            <div className="min-w-0 flex-1">
                                <h2 className="text-2xl font-semibold">
                                    {result.status === 'accepted' ? 'Invitation Accepted' : 'Pending Review'}
                                </h2>
                                <p className="mt-2 text-sm text-[hsl(var(--text-secondary))]">
                                    {result.status === 'accepted'
                                        ? 'Your account now has access under the invitation rules below.'
                                        : 'Your claim has been recorded. An administrator must approve it before membership is activated.'}
                                </p>
                                <p className="mt-3 text-sm font-medium text-[hsl(var(--text-primary))]">
                                    {result.invitation.team_name
                                        ? `Target team: ${result.invitation.team_name}`
                                        : result.invitation.org_name
                                            ? `Target organization: ${result.invitation.org_name}`
                                            : 'Invitation target loaded'}
                                </p>

                                <div className="mt-6 grid gap-4 md:grid-cols-2">
                                    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm">
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Invitation</p>
                                        <p className="mt-2">Organization: {result.invitation.org_name || result.invitation.org_id}</p>
                                        {result.invitation.team_name ? <p className="mt-1">Team: {result.invitation.team_name}</p> : null}
                                        <p className="mt-1">Type: {result.invitation.invitation_type}</p>
                                        <p className="mt-1">Member type: {result.invitation.member_type}</p>
                                        <p className="mt-1">Delivery: {result.invitation.delivery_mode.replace('_', ' ')}</p>
                                        <p className="mt-1">Approval: {result.invitation.approval_mode}</p>
                                        <p className="mt-1">Status: {result.invitation.status}</p>
                                    </div>
                                    <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm">
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--text-tertiary))]">Membership</p>
                                        {result.membership ? (
                                            <>
                                                <p className="mt-2">Global role: {result.membership.global_role}</p>
                                                <p className="mt-1">Member type: {result.membership.member_type}</p>
                                                <p className="mt-1">Joined: {new Date(result.membership.joined_at).toLocaleString()}</p>
                                            </>
                                        ) : (
                                            <p className="mt-2 text-[hsl(var(--text-secondary))]">Membership is not active yet.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    {result.invitation.token ? (
                                        <button
                                            onClick={() => handleCopy(result.invitation.token)}
                                            className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                        >
                                            <Copy className="h-4 w-4" />
                                            Copy Token
                                        </button>
                                    ) : null}
                                    {result.status === 'accepted' ? (
                                        <button
                                            onClick={() => navigate('/dashboard?tab=projects')}
                                            className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--surface-elevated))]"
                                        >
                                            Go to Dashboard
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}
            </div>
        </StudioLayout>
    );
};

export default InvitationAccept;
