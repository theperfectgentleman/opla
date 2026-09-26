"""Seed catalog for per-organisation AI action costs.

Runtime charges always read ``org_ai_action_costs``. This list is only the
starting row written when an organisation wallet is created (migration for
existing orgs, and ``ensure_wallet`` for new ones).

Values are AI credit units an org admin can change in Settings. They are not
prices, and they are not SMS credits.
"""

from __future__ import annotations

from typing import TypedDict


class AiActionSpec(TypedDict):
    action_key: str
    label: str
    credit_cost: int


# Starter unit so a new wallet can charge and block. Admins replace it in Settings.
DEFAULT_AI_ACTION_CREDIT_COST = 1

AI_SURVEY_INTERVIEW = "ai_survey.interview"
AI_SURVEY_DRAFT = "ai_survey.draft"
AI_SURVEY_REVISE = "ai_survey.revise"

AI_ACTION_CATALOG: list[AiActionSpec] = [
    {
        "action_key": AI_SURVEY_INTERVIEW,
        "label": "AI survey interview",
        "credit_cost": DEFAULT_AI_ACTION_CREDIT_COST,
    },
    {
        "action_key": AI_SURVEY_DRAFT,
        "label": "AI survey draft",
        "credit_cost": DEFAULT_AI_ACTION_CREDIT_COST,
    },
    {
        "action_key": AI_SURVEY_REVISE,
        "label": "AI survey revision",
        "credit_cost": DEFAULT_AI_ACTION_CREDIT_COST,
    },
]

AI_ACTION_KEYS = {item["action_key"] for item in AI_ACTION_CATALOG}

AI_CREDITS_TOP_UP_MESSAGE = (
    "This organization is out of AI credits. "
    "Top up AI credits to use AI features again. "
    "The rest of Opla keeps working."
)
