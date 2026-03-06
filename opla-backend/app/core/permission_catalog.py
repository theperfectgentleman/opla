from __future__ import annotations

from typing import Iterable


PERMISSION_CATALOG = [
    {
        "key": "organization.manage_settings",
        "label": "Manage organization settings",
        "description": "Update branding, environment settings, and organization-wide configuration.",
        "category": "Organization",
    },
    {
        "key": "organization.manage_members",
        "label": "Manage members",
        "description": "Invite users, change membership state, and manage organization access.",
        "category": "Organization",
    },
    {
        "key": "organization.manage_roles",
        "label": "Manage role templates",
        "description": "Create, update, and assign role templates for the organization.",
        "category": "Organization",
    },
    {
        "key": "project.view",
        "label": "View projects",
        "description": "Open project workspaces and see project metadata.",
        "category": "Projects",
    },
    {
        "key": "project.create",
        "label": "Create projects",
        "description": "Create new project workspaces inside the organization.",
        "category": "Projects",
    },
    {
        "key": "project.edit",
        "label": "Edit projects",
        "description": "Update project details and operational configuration.",
        "category": "Projects",
    },
    {
        "key": "project.manage_access",
        "label": "Manage project access",
        "description": "Grant or revoke access to project workspaces.",
        "category": "Projects",
    },
    {
        "key": "project.manage_lifecycle",
        "label": "Manage project lifecycle",
        "description": "Activate, pause, archive, and otherwise control project state.",
        "category": "Projects",
    },
    {
        "key": "team.view",
        "label": "View teams",
        "description": "See team structures and assigned people.",
        "category": "Teams",
    },
    {
        "key": "team.manage",
        "label": "Manage teams",
        "description": "Create teams and change membership or assignments.",
        "category": "Teams",
    },
    {
        "key": "form.view",
        "label": "View forms",
        "description": "View form definitions and live versions.",
        "category": "Forms",
    },
    {
        "key": "form.create",
        "label": "Create forms",
        "description": "Create new forms inside a project.",
        "category": "Forms",
    },
    {
        "key": "form.edit",
        "label": "Edit forms",
        "description": "Edit form blueprints and draft content.",
        "category": "Forms",
    },
    {
        "key": "form.publish",
        "label": "Publish forms",
        "description": "Promote a draft form version to live.",
        "category": "Forms",
    },
    {
        "key": "form.delete",
        "label": "Delete forms",
        "description": "Remove forms or retire them from active use.",
        "category": "Forms",
    },
    {
        "key": "submission.create",
        "label": "Submit data",
        "description": "Create new submissions from runtime forms.",
        "category": "Submissions",
    },
    {
        "key": "submission.view_own",
        "label": "View own submissions",
        "description": "Review submissions created by the current user.",
        "category": "Submissions",
    },
    {
        "key": "submission.view_team",
        "label": "View team submissions",
        "description": "Review submissions from assigned field teams.",
        "category": "Submissions",
    },
    {
        "key": "submission.view_all",
        "label": "View all submissions",
        "description": "Review any submission inside the authorized workspace.",
        "category": "Submissions",
    },
    {
        "key": "submission.review",
        "label": "Review submissions",
        "description": "Approve, comment on, or otherwise review submission quality.",
        "category": "Submissions",
    },
    {
        "key": "submission.export",
        "label": "Export submissions",
        "description": "Export submission data for downstream analysis.",
        "category": "Submissions",
    },
    {
        "key": "analysis.view",
        "label": "View analysis",
        "description": "Open analytics, dashboards, and derived insights.",
        "category": "Analysis",
    },
    {
        "key": "analysis.export",
        "label": "Export analysis",
        "description": "Export analysis outputs or transformed datasets.",
        "category": "Analysis",
    },
    {
        "key": "report.view",
        "label": "View reports",
        "description": "Read generated reports and management summaries.",
        "category": "Reports",
    },
    {
        "key": "report.export",
        "label": "Export reports",
        "description": "Download or distribute report outputs.",
        "category": "Reports",
    },
    {
        "key": "communication.field",
        "label": "Message field teams",
        "description": "Send operational communication to field teams or collectors.",
        "category": "Communication",
    },
    {
        "key": "communication.internal",
        "label": "Message internal teams",
        "description": "Communicate with internal supervisors, analysts, or managers.",
        "category": "Communication",
    },
]

STARTER_ROLE_TEMPLATES = [
    {
        "name": "Org Admin",
        "slug": "org-admin",
        "description": "Full governance access across the organization and its project workspaces.",
        "scope": "organization",
        "permissions": [item["key"] for item in PERMISSION_CATALOG],
        "priority": 100,
        "is_system": True,
    },
    {
        "name": "Project Manager",
        "slug": "project-manager",
        "description": "Owns delivery and operations for a project workspace.",
        "scope": "project",
        "permissions": [
            "project.view",
            "project.create",
            "project.edit",
            "project.manage_access",
            "project.manage_lifecycle",
            "team.view",
            "team.manage",
            "form.view",
            "form.create",
            "form.edit",
            "form.publish",
            "form.delete",
            "submission.view_all",
            "submission.review",
            "submission.export",
            "analysis.view",
            "report.view",
            "report.export",
            "communication.field",
            "communication.internal",
        ],
        "priority": 90,
        "is_system": True,
    },
    {
        "name": "Field Supervisor",
        "slug": "field-supervisor",
        "description": "Coordinates field teams, monitors collection, and reviews submissions.",
        "scope": "project",
        "permissions": [
            "project.view",
            "team.view",
            "team.manage",
            "form.view",
            "submission.view_team",
            "submission.review",
            "report.view",
            "communication.field",
            "communication.internal",
        ],
        "priority": 70,
        "is_system": True,
    },
    {
        "name": "Field Personnel",
        "slug": "field-personnel",
        "description": "Runs forms in the field and submits data with minimal operational access.",
        "scope": "project",
        "permissions": [
            "project.view",
            "form.view",
            "submission.create",
            "submission.view_own",
        ],
        "priority": 40,
        "is_system": True,
    },
    {
        "name": "Analyst",
        "slug": "analyst",
        "description": "Designs forms, examines data quality, and works on analysis outputs.",
        "scope": "project",
        "permissions": [
            "project.view",
            "form.view",
            "form.create",
            "form.edit",
            "form.publish",
            "submission.view_all",
            "submission.export",
            "analysis.view",
            "analysis.export",
            "report.view",
            "report.export",
            "communication.internal",
        ],
        "priority": 75,
        "is_system": True,
    },
    {
        "name": "Stakeholder Viewer",
        "slug": "stakeholder-viewer",
        "description": "Consumes reports and outcomes without operational editing rights.",
        "scope": "project",
        "permissions": [
            "project.view",
            "analysis.view",
            "report.view",
            "communication.internal",
        ],
        "priority": 30,
        "is_system": True,
    },
]

STARTER_PROJECT_ROLE_TEMPLATES = [
    role for role in STARTER_ROLE_TEMPLATES if role["scope"] == "project"
]

VALID_PERMISSION_KEYS = {item["key"] for item in PERMISSION_CATALOG}

PROJECT_ROLE_PERMISSION_MAP = {
    "collector": {
        "project.view",
        "form.view",
        "submission.create",
        "submission.view_own",
    },
    "analyst": {
        "project.view",
        "form.view",
        "form.create",
        "form.edit",
        "form.publish",
        "submission.view_all",
        "submission.export",
        "analysis.view",
        "analysis.export",
        "report.view",
        "report.export",
        "communication.internal",
    },
    "editor": {
        "project.view",
        "project.edit",
        "project.manage_access",
        "project.manage_lifecycle",
        "team.view",
        "team.manage",
        "form.view",
        "form.create",
        "form.edit",
        "form.publish",
        "form.delete",
        "submission.view_all",
        "submission.review",
        "submission.export",
        "analysis.view",
        "report.view",
        "report.export",
        "communication.field",
        "communication.internal",
    },
}

LEGACY_PROJECT_ROLE_BY_TEMPLATE_SLUG = {
    "field-personnel": "collector",
    "analyst": "analyst",
    "project-manager": "editor",
    "field-supervisor": "editor",
    "stakeholder-viewer": "analyst",
}


def normalize_permissions(permissions: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for permission in permissions:
        if permission in seen:
            continue
        seen.add(permission)
        normalized.append(permission)
    return normalized


def validate_permissions(permissions: Iterable[str]) -> list[str]:
    normalized = normalize_permissions(permissions)
    invalid = [permission for permission in normalized if permission not in VALID_PERMISSION_KEYS]
    if invalid:
        raise ValueError(f"Unknown permissions: {', '.join(invalid)}")
    return normalized