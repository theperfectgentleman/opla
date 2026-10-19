import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    AI_CREDITS_PARTIAL_MESSAGE,
    AI_CREDITS_TOP_UP_MESSAGE,
    AI_SURVEY_DRAFT,
    AI_SURVEY_INTERVIEW,
    aiCreditEntryLabel,
    aiCreditsActionCostPath,
    aiCreditsLedgerPath,
    aiCreditsTopUpPath,
    aiCreditsWalletPath,
    formatAiCreditAmount,
    aiCreditsBannerMessage,
    readAiCreditsBlock,
    walletBlocksAction,
} from './aiCredits.ts';

describe('AI credit wallet contracts', () => {
    it('builds organisation AI credit paths, separate from a generic credits API', () => {
        assert.equal(aiCreditsWalletPath('org-1'), '/organizations/org-1/ai-credits');
        assert.equal(aiCreditsLedgerPath('org-1'), '/organizations/org-1/ai-credits/ledger');
        assert.equal(aiCreditsTopUpPath('org-1'), '/organizations/org-1/ai-credits/top-ups');
        assert.equal(
            aiCreditsActionCostPath('org-1', AI_SURVEY_DRAFT),
            '/organizations/org-1/ai-credits/action-costs/ai_survey.draft',
        );
    });

    it('reads the top-up message only from an exhausted AI credit response', () => {
        const blocked = readAiCreditsBlock({
            response: {
                data: {
                    detail: {
                        code: 'ai_credits_exhausted',
                        message: AI_CREDITS_TOP_UP_MESSAGE,
                        balance: 0,
                        required: 1,
                        action_key: AI_SURVEY_INTERVIEW,
                    },
                },
            },
        });
        assert.equal(blocked, AI_CREDITS_TOP_UP_MESSAGE);
        assert.match(AI_CREDITS_TOP_UP_MESSAGE, /AI credits/);
        assert.match(AI_CREDITS_TOP_UP_MESSAGE, /rest of Opla keeps working/);

        assert.equal(readAiCreditsBlock({ response: { data: { detail: 'Brief is required' } } }), null);
        assert.equal(readAiCreditsBlock(new Error('network')), null);
        assert.equal(
            readAiCreditsBlock({ response: { data: { detail: { code: 'ai_credits_exhausted' } } } }),
            AI_CREDITS_TOP_UP_MESSAGE,
        );
    });

    it('blocks an action only when the wallet says it cannot be spent', () => {
        assert.equal(walletBlocksAction(null, AI_SURVEY_INTERVIEW), false);
        assert.equal(
            walletBlocksAction({ can_spend: { [AI_SURVEY_INTERVIEW]: false, [AI_SURVEY_DRAFT]: true } }, AI_SURVEY_INTERVIEW),
            true,
        );
        assert.equal(
            walletBlocksAction({ can_spend: { [AI_SURVEY_DRAFT]: true } }, AI_SURVEY_DRAFT),
            false,
        );
    });

    it('uses the full top-up message only when nothing can be spent', () => {
        assert.equal(aiCreditsBannerMessage(null), '');
        assert.equal(
            aiCreditsBannerMessage({
                balance: 0,
                can_spend: { [AI_SURVEY_INTERVIEW]: false, [AI_SURVEY_DRAFT]: false, 'ai_survey.revise': false },
            }),
            AI_CREDITS_TOP_UP_MESSAGE,
        );
        assert.equal(
            aiCreditsBannerMessage({
                balance: 3,
                can_spend: { [AI_SURVEY_INTERVIEW]: false, [AI_SURVEY_DRAFT]: true, 'ai_survey.revise': true },
            }),
            AI_CREDITS_PARTIAL_MESSAGE,
        );
        assert.equal(
            aiCreditsBannerMessage({
                balance: 5,
                can_spend: { [AI_SURVEY_INTERVIEW]: true, [AI_SURVEY_DRAFT]: true, 'ai_survey.revise': true },
            }),
            '',
        );
    });

    it('formats ledger amounts and entry labels for the history list', () => {
        assert.equal(formatAiCreditAmount(12), '+12');
        assert.equal(formatAiCreditAmount(-3), '-3');
        assert.equal(formatAiCreditAmount(0), '0');
        assert.equal(aiCreditEntryLabel('top_up'), 'Top-up');
        assert.equal(aiCreditEntryLabel('spend'), 'AI action');
        assert.equal(aiCreditEntryLabel('refund'), 'Refund');
    });
});
