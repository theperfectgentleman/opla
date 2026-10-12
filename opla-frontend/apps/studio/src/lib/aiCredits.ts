/** AI credit wallet helpers. These units are not SMS credits. */

export const AI_SURVEY_INTERVIEW = 'ai_survey.interview';
export const AI_SURVEY_DRAFT = 'ai_survey.draft';
export const AI_SURVEY_REVISE = 'ai_survey.revise';

export const AI_CREDITS_EXHAUSTED_CODE = 'ai_credits_exhausted';

export const AI_CREDITS_TOP_UP_MESSAGE =
    'This organization is out of AI credits. Top up AI credits to use AI features again. The rest of Opla keeps working.';

export const AI_CREDITS_PARTIAL_MESSAGE =
    'Some AI actions need more AI credits than this organization has. Top up AI credits to use them. Actions you can still afford stay available. The rest of Opla keeps working.';

export const AI_CREDIT_ACTION_KEYS = [AI_SURVEY_INTERVIEW, AI_SURVEY_DRAFT, AI_SURVEY_REVISE] as const;

export type AiCreditActionCost = {
    action_key: string;
    label: string;
    credit_cost: number;
};

export type AiCreditWallet = {
    organization_id: string;
    balance: number;
    action_costs: AiCreditActionCost[];
    can_spend: Record<string, boolean>;
};

export type AiCreditLedgerEntry = {
    id: string;
    entry_type: 'top_up' | 'spend' | 'refund' | string;
    amount: number;
    balance_after: number;
    action_key?: string | null;
    note?: string | null;
    actor_user_id?: string | null;
    actor_name?: string | null;
    created_at: string;
};

export function aiCreditsWalletPath(orgId: string): string {
    return `/organizations/${orgId}/ai-credits`;
}

export function aiCreditsLedgerPath(orgId: string): string {
    return `/organizations/${orgId}/ai-credits/ledger`;
}

export function aiCreditsTopUpPath(orgId: string): string {
    return `/organizations/${orgId}/ai-credits/top-ups`;
}

export function aiCreditsActionCostPath(orgId: string, actionKey: string): string {
    return `/organizations/${orgId}/ai-credits/action-costs/${encodeURIComponent(actionKey)}`;
}

type ErrorDetail = {
    code?: string;
    message?: string;
    balance?: number;
    required?: number;
    action_key?: string;
};

function errorDetail(err: unknown): ErrorDetail | string | null {
    const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        return detail as ErrorDetail;
    }
    if (typeof detail === 'string') return detail;
    return null;
}

export function readAiCreditsBlock(err: unknown): string | null {
    const detail = errorDetail(err);
    if (!detail || typeof detail === 'string') return null;
    if (detail.code !== AI_CREDITS_EXHAUSTED_CODE) return null;
    const message = typeof detail.message === 'string' ? detail.message.trim() : '';
    return message || AI_CREDITS_TOP_UP_MESSAGE;
}

export function walletBlocksAction(wallet: Pick<AiCreditWallet, 'can_spend'> | null | undefined, actionKey: string): boolean {
    if (!wallet?.can_spend) return false;
    return wallet.can_spend[actionKey] === false;
}

export function aiCreditsBannerMessage(wallet: Pick<AiCreditWallet, 'balance' | 'can_spend'> | null | undefined): string {
    if (!wallet?.can_spend) return '';
    const blocked = AI_CREDIT_ACTION_KEYS.filter((key) => wallet.can_spend[key] === false);
    if (blocked.length === 0) return '';
    if (wallet.balance <= 0 || blocked.length === AI_CREDIT_ACTION_KEYS.length) {
        return AI_CREDITS_TOP_UP_MESSAGE;
    }
    return AI_CREDITS_PARTIAL_MESSAGE;
}

export function formatAiCreditAmount(amount: number): string {
    if (amount > 0) return `+${amount}`;
    return String(amount);
}

export function aiCreditEntryLabel(entryType: string): string {
    if (entryType === 'top_up') return 'Top-up';
    if (entryType === 'spend') return 'AI action';
    if (entryType === 'refund') return 'Refund';
    return entryType;
}
