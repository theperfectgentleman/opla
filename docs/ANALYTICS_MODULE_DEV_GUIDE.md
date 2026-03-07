# Analytics Module — Development Guide

> **Purpose**: Build a nearly-independent, Metabase-inspired analytics system inside Opla Studio.
> A user clicks **Analytics** in the sidebar, sees a launcher of available tools, picks one, works with any dataset, and saves the result.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Package Installation](#2-tech-stack--package-installation)
3. [Phase A — Database Schema (Alembic Migration)](#3-phase-a--database-schema-alembic-migration)
4. [Phase B — Backend Analytics Service & Routes](#4-phase-b--backend-analytics-service--routes)
5. [Phase C — Frontend: Analytics Hub Page](#5-phase-c--frontend-analytics-hub-page)
6. [Phase D — Data Explorer (Query Builder + Table)](#6-phase-d--data-explorer-query-builder--table)
7. [Phase E — Chart Builder](#7-phase-e--chart-builder)
8. [Phase F — Spreadsheet View (Syncfusion)](#8-phase-f--spreadsheet-view-syncfusion)
9. [Phase G — Pivot Table (Syncfusion)](#9-phase-g--pivot-table-syncfusion)
10. [Phase H — Dashboard Canvas](#10-phase-h--dashboard-canvas)
11. [Phase I — Save, Load, Share](#11-phase-i--save-load-share)
12. [Verification Checklist](#12-verification-checklist)
13. [File Inventory](#13-file-inventory)

---

## 1. Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  ANALYTICS HUB   (route: /dashboard?tab=analysis)                   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐ │
│  │ Data        │ │ Chart       │ │ Spreadsheet │ │ Pivot        │ │
│  │ Explorer    │ │ Builder     │ │ (Syncfusion)│ │ (Syncfusion) │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬───────┘ │
│         │               │               │               │          │
│         └───────────────┴───────┬───────┴───────────────┘          │
│                                 │                                   │
│                    ┌────────────▼────────────┐                      │
│                    │  Analytics Data Layer    │                      │
│                    │  (shared context/hooks)  │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                   │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │  Dashboard Canvas  (react-grid-layout)                        │  │
│  │  Drag saved questions as cards                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                      POST /api/v1/analytics/query
                      GET  /api/v1/analytics/sources
                      CRUD /api/v1/analytics/questions
                      CRUD /api/v1/analytics/dashboards
                                  │
                          ┌───────▼───────┐
                          │  PostgreSQL    │
                          │  (SQLAlchemy   │
                          │   Core)        │
                          └───────────────┘
```

### Design Principles

1. **Self-contained** — The analytics module lives in its own folder on both frontend and backend. It imports from `app.core.database` and `app.api.dependencies` but nothing else.
2. **Any-dataset capable** — The system discovers queryable sources from `form_datasets` + `form_dataset_fields`. Any form with a published dataset becomes an analytics source automatically.
3. **JSON-config driven** — Every saved question, chart, spreadsheet state, and dashboard layout is a JSONB blob in Postgres. No extra infrastructure.
4. **Lazy-loaded** — Syncfusion Spreadsheet and Pivot Table are `React.lazy()` imports. They add zero bytes to the login/dashboard bundle.

---

## 2. Tech Stack & Package Installation

### Frontend Packages

Run from `opla-frontend/apps/studio`:

```powershell
# Open-source core
npm install react-querybuilder echarts echarts-for-react ag-grid-community ag-grid-react react-grid-layout @tanstack/react-query

# Syncfusion (Spreadsheet + Pivot only)
npm install @syncfusion/ej2-base @syncfusion/ej2-react-base @syncfusion/ej2-react-spreadsheet @syncfusion/ej2-react-pivotview @syncfusion/ej2

# Types
npm install -D @types/react-grid-layout
```

**Verification**: After install, run `npm run build` — it must succeed with zero errors.

### Backend Packages

No new Python packages needed. The existing `sqlalchemy ^2.0.25` + `psycopg2-binary` + `pydantic ^2.6.0` cover everything.

### Syncfusion License

Create or edit `opla-frontend/apps/studio/src/main.tsx`:

```tsx
import { registerLicense } from '@syncfusion/ej2-base';
// Community license — free for < $1M revenue
// Get your key at https://www.syncfusion.com/account/manage-trials/downloads
registerLicense(import.meta.env.VITE_SYNCFUSION_LICENSE_KEY || '');
```

Add to `.env`:
```
VITE_SYNCFUSION_LICENSE_KEY=your_key_here
```

> Components work fully without a key during development — they just show a watermark banner. The key removes the watermark. Do NOT block development on license setup.

---

## 3. Phase A — Database Schema (Alembic Migration)

### File: `opla-backend/alembic/versions/014_analytics.py`

Create a new Alembic migration. The revision number follows the existing sequence (latest is `013_form_dataset.py`).

```python
"""analytics: saved questions, dashboards, dashboard cards

Revision ID: 014_analytics
Revises: 013_form_dataset
Create Date: 2026-03-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

revision = "014_analytics"
down_revision = "013_form_dataset"
branch_labels = None
depends_on = None

def upgrade() -> None:
    # ── saved_questions ──────────────────────────────────────────
    op.create_table(
        "saved_questions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # What data source(s) this question targets
        sa.Column("source_config", JSONB, nullable=False, comment="{ dataset_id, table_name, join_config }"),
        # The query builder state (react-querybuilder JSON)
        sa.Column("query_config", JSONB, nullable=False, comment="{ filters, groupBy, aggregates, orderBy, limit }"),
        # The visualization configuration
        # tool: "table" | "chart" | "spreadsheet" | "pivot"
        sa.Column("viz_type", sa.String(50), nullable=False, server_default="table"),
        sa.Column("viz_config", JSONB, nullable=True, comment="Chart type, axes, colors, pivot field mapping, spreadsheet state"),
        # Caching hint
        sa.Column("cache_ttl_seconds", sa.Integer, nullable=True, comment="Optional TTL for materialized result cache"),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── analytics_dashboards ─────────────────────────────────────
    op.create_table(
        "analytics_dashboards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        # react-grid-layout serialised layout
        sa.Column("layout_config", JSONB, nullable=False, server_default="[]"),
        sa.Column("is_archived", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # ── dashboard_cards (join table) ──────────────────────────────
    op.create_table(
        "dashboard_cards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("dashboard_id", UUID(as_uuid=True), sa.ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("question_id", UUID(as_uuid=True), sa.ForeignKey("saved_questions.id", ondelete="CASCADE"), nullable=False, index=True),
        # Grid position from react-grid-layout
        sa.Column("position", JSONB, nullable=False, comment="{ x, y, w, h, minW, minH }"),
        # Per-card viz overrides (e.g. different chart type than the saved question default)
        sa.Column("viz_override", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table("dashboard_cards")
    op.drop_table("analytics_dashboards")
    op.drop_table("saved_questions")
```

### Verification (Phase A)

```powershell
cd opla-backend
python -m alembic upgrade head
# Expected: "Running upgrade 013_form_dataset -> 014_analytics"
# NO errors

# Confirm tables exist:
python -c "
from app.core.database import engine_sync
from sqlalchemy import inspect
i = inspect(engine_sync)
tables = i.get_table_names()
assert 'saved_questions' in tables, 'saved_questions missing'
assert 'analytics_dashboards' in tables, 'analytics_dashboards missing'
assert 'dashboard_cards' in tables, 'dashboard_cards missing'
print('✓ All 3 analytics tables created')
"
```

---

## 4. Phase B — Backend Analytics Service & Routes

### B.1 — SQLAlchemy Models

#### File: `opla-backend/app/models/analytics.py`

```python
"""Analytics models — saved questions, dashboards, dashboard cards."""
import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from app.models.base import Base


class VizType(str, enum.Enum):
    TABLE = "table"
    CHART = "chart"
    SPREADSHEET = "spreadsheet"
    PIVOT = "pivot"


class SavedQuestion(Base):
    __tablename__ = "saved_questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_config = Column(JSONB, nullable=False)
    query_config = Column(JSONB, nullable=False)
    viz_type = Column(String(50), nullable=False, default=VizType.TABLE.value)
    viz_config = Column(JSONB, nullable=True)
    cache_ttl_seconds = Column(Integer, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", backref=backref("saved_questions", lazy="dynamic"))
    project = relationship("Project", backref=backref("saved_questions", lazy="dynamic"))
    creator = relationship("User", backref=backref("saved_questions", lazy="dynamic"))
    cards = relationship("DashboardCard", back_populates="question", cascade="all, delete-orphan")


class AnalyticsDashboard(Base):
    __tablename__ = "analytics_dashboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    layout_config = Column(JSONB, nullable=False, default=list)
    is_archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", backref=backref("analytics_dashboards", lazy="dynamic"))
    project = relationship("Project", backref=backref("analytics_dashboards", lazy="dynamic"))
    creator = relationship("User", backref=backref("analytics_dashboards", lazy="dynamic"))
    cards = relationship("DashboardCard", back_populates="dashboard", cascade="all, delete-orphan")


class DashboardCard(Base):
    __tablename__ = "dashboard_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("analytics_dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("saved_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(JSONB, nullable=False)
    viz_override = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dashboard = relationship("AnalyticsDashboard", back_populates="cards")
    question = relationship("SavedQuestion", back_populates="cards")
```

Register in `opla-backend/app/models/__init__.py` — add this import at the bottom:

```python
from app.models.analytics import SavedQuestion, AnalyticsDashboard, DashboardCard
```

### B.2 — Pydantic Schemas

#### File: `opla-backend/app/api/schemas/analytics.py`

```python
"""Schemas for the analytics module."""
from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ── Source discovery ──────────────────────────────────────────

class AnalyticsSourceField(BaseModel):
    field_identifier: str
    field_key: str
    label: Optional[str] = None
    field_type: Optional[str] = None

class AnalyticsSource(BaseModel):
    dataset_id: UUID
    form_id: UUID
    dataset_name: str
    dataset_slug: str
    form_title: str
    project_id: Optional[UUID] = None
    project_name: Optional[str] = None
    fields: list[AnalyticsSourceField] = []
    record_count: int = 0


# ── Query execution ──────────────────────────────────────────

class AggregateSpec(BaseModel):
    """Single aggregate: { field: "amount", fn: "sum", alias: "total_amount" }"""
    field: str
    fn: str = Field(..., pattern="^(count|sum|avg|min|max|count_distinct)$")
    alias: Optional[str] = None

class OrderSpec(BaseModel):
    field: str
    direction: str = Field("asc", pattern="^(asc|desc)$")

class AnalyticsQueryRequest(BaseModel):
    """
    The frontend sends this.  The backend translates it into safe,
    parameterized SQL via SQLAlchemy Core.
    """
    dataset_id: UUID
    # Columns to SELECT (empty = all fields)
    select_fields: list[str] = []
    # react-querybuilder JSON rule tree
    filters: Optional[dict[str, Any]] = None
    # GROUP BY field keys
    group_by: list[str] = []
    # Aggregations
    aggregates: list[AggregateSpec] = []
    # ORDER BY
    order_by: list[OrderSpec] = []
    # Pagination
    limit: int = Field(500, ge=1, le=10000)
    offset: int = Field(0, ge=0)

class AnalyticsQueryResponse(BaseModel):
    columns: list[dict[str, Any]]  # [{ key, label, type }]
    rows: list[dict[str, Any]]
    total_count: int
    truncated: bool = False


# ── Saved questions ──────────────────────────────────────────

class SavedQuestionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    source_config: dict[str, Any]
    query_config: dict[str, Any]
    viz_type: str = Field("table", pattern="^(table|chart|spreadsheet|pivot)$")
    viz_config: Optional[dict[str, Any]] = None
    cache_ttl_seconds: Optional[int] = None

class SavedQuestionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    source_config: Optional[dict[str, Any]] = None
    query_config: Optional[dict[str, Any]] = None
    viz_type: Optional[str] = Field(None, pattern="^(table|chart|spreadsheet|pivot)$")
    viz_config: Optional[dict[str, Any]] = None
    cache_ttl_seconds: Optional[int] = None
    is_archived: Optional[bool] = None

class SavedQuestionOut(BaseModel):
    id: UUID
    org_id: UUID
    project_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    source_config: dict[str, Any]
    query_config: dict[str, Any]
    viz_type: str
    viz_config: Optional[dict[str, Any]] = None
    cache_ttl_seconds: Optional[int] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Dashboards ───────────────────────────────────────────────

class DashboardCardCreate(BaseModel):
    question_id: UUID
    position: dict[str, Any]  # { x, y, w, h }
    viz_override: Optional[dict[str, Any]] = None

class DashboardCardOut(BaseModel):
    id: UUID
    question_id: UUID
    position: dict[str, Any]
    viz_override: Optional[dict[str, Any]] = None
    question: Optional[SavedQuestionOut] = None

    class Config:
        from_attributes = True

class AnalyticsDashboardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    project_id: Optional[UUID] = None
    layout_config: list[dict[str, Any]] = []
    cards: list[DashboardCardCreate] = []

class AnalyticsDashboardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    layout_config: Optional[list[dict[str, Any]]] = None
    cards: Optional[list[DashboardCardCreate]] = None
    is_archived: Optional[bool] = None

class AnalyticsDashboardOut(BaseModel):
    id: UUID
    org_id: UUID
    project_id: Optional[UUID] = None
    created_by: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    layout_config: list[dict[str, Any]]
    cards: list[DashboardCardOut] = []
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

### B.3 — Analytics Service (Query Engine)

#### File: `opla-backend/app/services/analytics_service.py`

This is the core of the system. It translates the frontend's query spec into safe, parameterized SQL via SQLAlchemy Core.

```python
"""
Analytics query engine.

Translates AnalyticsQueryRequest into parameterized SQL using SQLAlchemy Core.
NEVER concatenates user input into SQL strings.
"""
from __future__ import annotations
import uuid
from typing import Any, Optional

from sqlalchemy import text, func, select, column, literal_column, and_, or_, cast, String, Float, Integer
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.models.form_dataset import FormDataset, FormDatasetField, FormDatasetFieldStatus
from app.models.submission import Submission
from app.models.analytics import SavedQuestion, AnalyticsDashboard, DashboardCard


# ── Allowed aggregate functions (whitelist) ──────────────────
ALLOWED_AGG_FNS = {
    "count":          func.count,
    "sum":            lambda col: func.sum(cast(col, Float)),
    "avg":            lambda col: func.avg(cast(col, Float)),
    "min":            func.min,
    "max":            func.max,
    "count_distinct": lambda col: func.count(col.distinct()),
}


class AnalyticsService:
    """Stateless service — all methods are @staticmethod."""

    # ── Source Discovery ─────────────────────────────────────

    @staticmethod
    def list_sources(db: Session, org_id: uuid.UUID) -> list[dict]:
        """
        Return all datasets in this org that have at least one ACTIVE field
        and at least one submission.  Each source includes its field list
        and record count.
        """
        datasets = (
            db.query(FormDataset)
            .join(FormDataset.form)
            .filter(
                FormDataset.status == "active",
                FormDataset.form.has(project__has={"org_id": org_id} if False else True),
            )
            .all()
        )

        # More reliable: query via direct join
        from app.models.form import Form
        from app.models.project import Project

        datasets = (
            db.query(FormDataset)
            .join(Form, Form.id == FormDataset.form_id)
            .join(Project, Project.id == Form.project_id)
            .filter(
                Project.org_id == org_id,
                FormDataset.status == "active",
            )
            .all()
        )

        sources = []
        for ds in datasets:
            record_count = (
                db.query(func.count(Submission.id))
                .filter(Submission.form_id == ds.form_id)
                .scalar() or 0
            )

            active_fields = [
                {
                    "field_identifier": f.field_identifier,
                    "field_key": f.field_key,
                    "label": f.label,
                    "field_type": f.field_type,
                }
                for f in (ds.fields or [])
                if f.status == FormDatasetFieldStatus.ACTIVE
            ]

            sources.append({
                "dataset_id": ds.id,
                "form_id": ds.form_id,
                "dataset_name": ds.name,
                "dataset_slug": ds.slug,
                "form_title": ds.form.title if ds.form else ds.name,
                "project_id": ds.form.project_id if ds.form else None,
                "project_name": ds.form.project.name if ds.form and ds.form.project else None,
                "fields": active_fields,
                "record_count": record_count,
            })

        return sources

    # ── Query Execution ──────────────────────────────────────

    @staticmethod
    def execute_query(
        db: Session,
        org_id: uuid.UUID,
        dataset_id: uuid.UUID,
        select_fields: list[str],
        filters: Optional[dict] = None,
        group_by: list[str] | None = None,
        aggregates: list[dict] | None = None,
        order_by: list[dict] | None = None,
        limit: int = 500,
        offset: int = 0,
    ) -> dict:
        """
        Build and execute a dynamic query over a dataset's submissions.

        Submissions store form responses in `data` (JSONB).  We use
        Postgres JSONB operators to extract fields:
            submissions.data ->> 'field_key'

        Security:
        - dataset_id is validated to belong to the org
        - field keys are validated against form_dataset_fields
        - aggregate functions are whitelisted
        - all values are parameterized (no string concat)
        """
        from app.models.form import Form
        from app.models.project import Project

        # ── Validate dataset belongs to org ──
        dataset = (
            db.query(FormDataset)
            .join(Form, Form.id == FormDataset.form_id)
            .join(Project, Project.id == Form.project_id)
            .filter(
                FormDataset.id == dataset_id,
                Project.org_id == org_id,
                FormDataset.status == "active",
            )
            .first()
        )
        if not dataset:
            raise ValueError("DATASET_NOT_FOUND")

        # ── Build allowed field map ──
        allowed_fields: dict[str, FormDatasetField] = {
            f.field_key: f
            for f in (dataset.fields or [])
            if f.status == FormDatasetFieldStatus.ACTIVE
        }

        # Always allowed meta-columns
        META_COLUMNS = {
            "_submission_id": Submission.id,
            "_submitted_at": Submission.created_at,
            "_user_id": Submission.user_id,
            "_form_version": Submission.form_version_number,
        }

        def _resolve_column(key: str):
            """Return a SQLAlchemy column expression for a field key."""
            if key in META_COLUMNS:
                return META_COLUMNS[key]
            if key not in allowed_fields:
                raise ValueError(f"FIELD_NOT_ALLOWED:{key}")
            # JSONB extraction: data ->> 'field_key'
            return Submission.data[key].as_string().label(key)

        # ── SELECT clause ──
        columns = []
        if aggregates:
            # Group-by columns first
            for gk in (group_by or []):
                columns.append(_resolve_column(gk))
            # Then aggregate expressions
            for agg in aggregates:
                fn_name = agg["fn"]
                if fn_name not in ALLOWED_AGG_FNS:
                    raise ValueError(f"AGG_NOT_ALLOWED:{fn_name}")
                field_col = _resolve_column(agg["field"])
                agg_fn = ALLOWED_AGG_FNS[fn_name]
                alias = agg.get("alias") or f"{fn_name}_{agg['field']}"
                columns.append(agg_fn(field_col).label(alias))
        elif select_fields:
            for key in select_fields:
                columns.append(_resolve_column(key))
        else:
            # Default: all active fields + meta columns
            columns.append(Submission.id.label("_submission_id"))
            columns.append(Submission.created_at.label("_submitted_at"))
            for key in allowed_fields:
                columns.append(Submission.data[key].as_string().label(key))

        # ── Base query ──
        query = select(*columns).where(Submission.form_id == dataset.form_id)

        # ── WHERE clause (from react-querybuilder JSON) ──
        if filters:
            where_clause = AnalyticsService._build_where(filters, allowed_fields)
            if where_clause is not None:
                query = query.where(where_clause)

        # ── GROUP BY ──
        if group_by:
            for gk in group_by:
                query = query.group_by(_resolve_column(gk))

        # ── ORDER BY ──
        if order_by:
            for spec in order_by:
                col = _resolve_column(spec["field"])
                if spec.get("direction", "asc") == "desc":
                    col = col.desc()
                query = query.order_by(col)

        # ── Count total (before pagination) ──
        from sqlalchemy import func as sa_func
        count_query = select(sa_func.count()).select_from(query.subquery())
        total_count = db.execute(count_query).scalar() or 0

        # ── Pagination ──
        query = query.limit(limit).offset(offset)

        # ── Execute ──
        result = db.execute(query)
        rows = [dict(row._mapping) for row in result]

        # Serialise UUIDs and datetimes to strings
        for row in rows:
            for k, v in row.items():
                if isinstance(v, uuid.UUID):
                    row[k] = str(v)
                elif hasattr(v, "isoformat"):
                    row[k] = v.isoformat()

        # ── Column metadata ──
        col_meta = []
        if aggregates:
            for gk in (group_by or []):
                f = allowed_fields.get(gk)
                col_meta.append({"key": gk, "label": f.label if f else gk, "type": f.field_type if f else "text"})
            for agg in aggregates:
                alias = agg.get("alias") or f"{agg['fn']}_{agg['field']}"
                col_meta.append({"key": alias, "label": alias, "type": "number"})
        elif select_fields:
            for key in select_fields:
                if key in META_COLUMNS:
                    col_meta.append({"key": key, "label": key, "type": "meta"})
                else:
                    f = allowed_fields[key]
                    col_meta.append({"key": key, "label": f.label or key, "type": f.field_type or "text"})
        else:
            col_meta.append({"key": "_submission_id", "label": "ID", "type": "uuid"})
            col_meta.append({"key": "_submitted_at", "label": "Submitted", "type": "datetime"})
            for key, f in allowed_fields.items():
                col_meta.append({"key": key, "label": f.label or key, "type": f.field_type or "text"})

        return {
            "columns": col_meta,
            "rows": rows,
            "total_count": total_count,
            "truncated": total_count > (offset + limit),
        }

    # ── Filter tree → SQLAlchemy WHERE ───────────────────────

    @staticmethod
    def _build_where(rule_group: dict, allowed_fields: dict):
        """
        Recursively translate react-querybuilder's JSON rule tree
        into a SQLAlchemy BooleanClause.

        Shape:
        {
          "combinator": "and" | "or",
          "rules": [
            { "field": "age", "operator": ">=", "value": "18" },
            { "combinator": "or", "rules": [...] }
          ]
        }
        """
        combinator = rule_group.get("combinator", "and")
        rules = rule_group.get("rules", [])

        clauses = []
        for rule in rules:
            if "combinator" in rule:
                # Nested group — recurse
                sub = AnalyticsService._build_where(rule, allowed_fields)
                if sub is not None:
                    clauses.append(sub)
            elif "field" in rule and "operator" in rule:
                field_key = rule["field"]
                if field_key not in allowed_fields:
                    continue  # skip unknown fields silently
                col = Submission.data[field_key].as_string()
                op = rule["operator"]
                val = rule.get("value")

                clause = AnalyticsService._apply_operator(col, op, val)
                if clause is not None:
                    clauses.append(clause)

        if not clauses:
            return None
        if combinator == "or":
            return or_(*clauses)
        return and_(*clauses)

    @staticmethod
    def _apply_operator(col, op: str, val):
        """Map a query-builder operator to a SQLAlchemy expression."""
        if op == "=" or op == "equal":
            return col == val
        elif op == "!=" or op == "notEqual":
            return col != val
        elif op == ">" or op == "greaterThan":
            return cast(col, Float) > float(val)
        elif op == "<" or op == "lessThan":
            return cast(col, Float) < float(val)
        elif op == ">=" or op == "greaterThanOrEqual":
            return cast(col, Float) >= float(val)
        elif op == "<=" or op == "lessThanOrEqual":
            return cast(col, Float) <= float(val)
        elif op == "contains":
            return col.ilike(f"%{val}%")
        elif op == "beginsWith":
            return col.ilike(f"{val}%")
        elif op == "endsWith":
            return col.ilike(f"%{val}")
        elif op == "null" or op == "isEmpty":
            return col.is_(None)
        elif op == "notNull" or op == "isNotEmpty":
            return col.isnot(None)
        elif op == "between":
            if isinstance(val, str):
                parts = val.split(",")
                if len(parts) == 2:
                    return and_(cast(col, Float) >= float(parts[0].strip()), cast(col, Float) <= float(parts[1].strip()))
            return None
        elif op == "in":
            if isinstance(val, str):
                vals = [v.strip() for v in val.split(",")]
            elif isinstance(val, list):
                vals = val
            else:
                return None
            return col.in_(vals)
        elif op == "notIn":
            if isinstance(val, str):
                vals = [v.strip() for v in val.split(",")]
            elif isinstance(val, list):
                vals = val
            else:
                return None
            return col.notin_(vals)
        return None

    # ── CRUD: Saved Questions ────────────────────────────────

    @staticmethod
    def create_question(db: Session, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> SavedQuestion:
        q = SavedQuestion(
            org_id=org_id,
            created_by=user_id,
            **data,
        )
        db.add(q)
        db.commit()
        db.refresh(q)
        return q

    @staticmethod
    def get_question(db: Session, question_id: uuid.UUID) -> Optional[SavedQuestion]:
        return db.query(SavedQuestion).filter(SavedQuestion.id == question_id).first()

    @staticmethod
    def list_questions(db: Session, org_id: uuid.UUID, project_id: Optional[uuid.UUID] = None) -> list[SavedQuestion]:
        q = db.query(SavedQuestion).filter(
            SavedQuestion.org_id == org_id,
            SavedQuestion.is_archived == False,
        )
        if project_id:
            q = q.filter(SavedQuestion.project_id == project_id)
        return q.order_by(SavedQuestion.updated_at.desc()).all()

    @staticmethod
    def update_question(db: Session, question: SavedQuestion, data: dict) -> SavedQuestion:
        for key, value in data.items():
            if value is not None:
                setattr(question, key, value)
        db.commit()
        db.refresh(question)
        return question

    @staticmethod
    def delete_question(db: Session, question: SavedQuestion) -> None:
        db.delete(question)
        db.commit()

    # ── CRUD: Dashboards ─────────────────────────────────────

    @staticmethod
    def create_dashboard(db: Session, org_id: uuid.UUID, user_id: uuid.UUID, data: dict) -> AnalyticsDashboard:
        cards_data = data.pop("cards", [])
        dash = AnalyticsDashboard(org_id=org_id, created_by=user_id, **data)
        db.add(dash)
        db.flush()

        for card_data in cards_data:
            card = DashboardCard(dashboard_id=dash.id, **card_data)
            db.add(card)

        db.commit()
        db.refresh(dash)
        return dash

    @staticmethod
    def get_dashboard(db: Session, dashboard_id: uuid.UUID) -> Optional[AnalyticsDashboard]:
        return db.query(AnalyticsDashboard).filter(AnalyticsDashboard.id == dashboard_id).first()

    @staticmethod
    def list_dashboards(db: Session, org_id: uuid.UUID, project_id: Optional[uuid.UUID] = None) -> list[AnalyticsDashboard]:
        q = db.query(AnalyticsDashboard).filter(
            AnalyticsDashboard.org_id == org_id,
            AnalyticsDashboard.is_archived == False,
        )
        if project_id:
            q = q.filter(AnalyticsDashboard.project_id == project_id)
        return q.order_by(AnalyticsDashboard.updated_at.desc()).all()

    @staticmethod
    def update_dashboard(db: Session, dash: AnalyticsDashboard, data: dict) -> AnalyticsDashboard:
        cards_data = data.pop("cards", None)
        for key, value in data.items():
            if value is not None:
                setattr(dash, key, value)

        if cards_data is not None:
            # Replace all cards
            db.query(DashboardCard).filter(DashboardCard.dashboard_id == dash.id).delete()
            for card_data in cards_data:
                card = DashboardCard(dashboard_id=dash.id, **card_data)
                db.add(card)

        db.commit()
        db.refresh(dash)
        return dash

    @staticmethod
    def delete_dashboard(db: Session, dash: AnalyticsDashboard) -> None:
        db.delete(dash)
        db.commit()
```

### B.4 — API Routes

#### File: `opla-backend/app/api/routes/analytics.py`

```python
"""Analytics API — sources, query execution, saved questions, dashboards."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from app.api.dependencies import get_current_user, get_db
from app.api.schemas.analytics import (
    AnalyticsSource,
    AnalyticsQueryRequest,
    AnalyticsQueryResponse,
    SavedQuestionCreate,
    SavedQuestionUpdate,
    SavedQuestionOut,
    AnalyticsDashboardCreate,
    AnalyticsDashboardUpdate,
    AnalyticsDashboardOut,
)
from app.services.analytics_service import AnalyticsService
from app.models.user import User

router = APIRouter(prefix="/organizations/{org_id}/analytics", tags=["analytics"])


# ── Data Sources ─────────────────────────────────────────────

@router.get("/sources", response_model=list[AnalyticsSource])
def list_analytics_sources(
    org_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all datasets available for analytics in this org."""
    return AnalyticsService.list_sources(db, org_id)


# ── Query Execution ──────────────────────────────────────────

@router.post("/query", response_model=AnalyticsQueryResponse)
def run_analytics_query(
    org_id: uuid.UUID,
    body: AnalyticsQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute an ad-hoc analytics query against a dataset.
    Returns columns + rows suitable for table, chart, spreadsheet, or pivot.
    """
    try:
        result = AnalyticsService.execute_query(
            db=db,
            org_id=org_id,
            dataset_id=body.dataset_id,
            select_fields=body.select_fields,
            filters=body.filters,
            group_by=body.group_by,
            aggregates=[a.model_dump() for a in body.aggregates],
            order_by=[o.model_dump() for o in body.order_by],
            limit=body.limit,
            offset=body.offset,
        )
        return result
    except ValueError as exc:
        msg = str(exc)
        if msg == "DATASET_NOT_FOUND":
            raise HTTPException(status_code=404, detail="Dataset not found in this organization")
        if msg.startswith("FIELD_NOT_ALLOWED"):
            raise HTTPException(status_code=400, detail=f"Field not allowed: {msg.split(':')[1]}")
        if msg.startswith("AGG_NOT_ALLOWED"):
            raise HTTPException(status_code=400, detail=f"Aggregate not allowed: {msg.split(':')[1]}")
        raise HTTPException(status_code=400, detail=str(exc))


# ── Saved Questions CRUD ─────────────────────────────────────

@router.post("/questions", response_model=SavedQuestionOut, status_code=status.HTTP_201_CREATED)
def create_saved_question(
    org_id: uuid.UUID,
    body: SavedQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService.create_question(db, org_id, current_user.id, body.model_dump())


@router.get("/questions", response_model=list[SavedQuestionOut])
def list_saved_questions(
    org_id: uuid.UUID,
    project_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService.list_questions(db, org_id, project_id)


@router.get("/questions/{question_id}", response_model=SavedQuestionOut)
def get_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = AnalyticsService.get_question(db, question_id)
    if not q or q.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@router.patch("/questions/{question_id}", response_model=SavedQuestionOut)
def update_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    body: SavedQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = AnalyticsService.get_question(db, question_id)
    if not q or q.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    return AnalyticsService.update_question(db, q, body.model_dump(exclude_unset=True))


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_question(
    org_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = AnalyticsService.get_question(db, question_id)
    if not q or q.org_id != org_id:
        raise HTTPException(status_code=404, detail="Question not found")
    AnalyticsService.delete_question(db, q)


# ── Dashboards CRUD ──────────────────────────────────────────

@router.post("/dashboards", response_model=AnalyticsDashboardOut, status_code=status.HTTP_201_CREATED)
def create_dashboard(
    org_id: uuid.UUID,
    body: AnalyticsDashboardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService.create_dashboard(db, org_id, current_user.id, body.model_dump())


@router.get("/dashboards", response_model=list[AnalyticsDashboardOut])
def list_dashboards(
    org_id: uuid.UUID,
    project_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return AnalyticsService.list_dashboards(db, org_id, project_id)


@router.get("/dashboards/{dashboard_id}", response_model=AnalyticsDashboardOut)
def get_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = AnalyticsService.get_dashboard(db, dashboard_id)
    if not d or d.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return d


@router.patch("/dashboards/{dashboard_id}", response_model=AnalyticsDashboardOut)
def update_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    body: AnalyticsDashboardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = AnalyticsService.get_dashboard(db, dashboard_id)
    if not d or d.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return AnalyticsService.update_dashboard(db, d, body.model_dump(exclude_unset=True))


@router.delete("/dashboards/{dashboard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dashboard(
    org_id: uuid.UUID,
    dashboard_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    d = AnalyticsService.get_dashboard(db, dashboard_id)
    if not d or d.org_id != org_id:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    AnalyticsService.delete_dashboard(db, d)
```

### B.5 — Register the Router

In `opla-backend/app/main.py`, add:

```python
from app.api.routes import analytics
# ... after existing include_router calls:
app.include_router(analytics.router, prefix=settings.API_V1_STR)
```

### Verification (Phase B)

```powershell
# 1. Start the backend
cd opla-backend
python -m uvicorn app.main:app --reload --port 8000

# 2. Open API docs — the analytics routes should appear
# Browse: http://localhost:8000/api/docs
# Look for tag: "analytics"
# Expected routes:
#   GET  /api/v1/organizations/{org_id}/analytics/sources
#   POST /api/v1/organizations/{org_id}/analytics/query
#   POST /api/v1/organizations/{org_id}/analytics/questions
#   GET  /api/v1/organizations/{org_id}/analytics/questions
#   GET  /api/v1/organizations/{org_id}/analytics/questions/{question_id}
#   PATCH /api/v1/organizations/{org_id}/analytics/questions/{question_id}
#   DELETE /api/v1/organizations/{org_id}/analytics/questions/{question_id}
#   POST /api/v1/organizations/{org_id}/analytics/dashboards
#   GET  /api/v1/organizations/{org_id}/analytics/dashboards
#   GET  /api/v1/organizations/{org_id}/analytics/dashboards/{dashboard_id}
#   PATCH /api/v1/organizations/{org_id}/analytics/dashboards/{dashboard_id}
#   DELETE /api/v1/organizations/{org_id}/analytics/dashboards/{dashboard_id}

# 3. Smoke test: list sources (use a real org_id and auth token)
# curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/organizations/<org_id>/analytics/sources
```

---

## 5. Phase C — Frontend: Analytics Hub Page

The Analytics Hub is the entry point. When a user clicks "Analytics" in the sidebar, they see a launcher with available tools and their saved work.

### C.1 — Add API Client Methods

#### File: `opla-frontend/apps/studio/src/lib/api.ts`

Add to the existing `apiClient` file — append a new `analyticsAPI` namespace:

```typescript
// ── Analytics API ───────────────────────────────────────────
export const analyticsAPI = {
  // Sources
  listSources: (orgId: string) =>
    apiClient.get(`/organizations/${orgId}/analytics/sources`),

  // Query
  runQuery: (orgId: string, body: {
    dataset_id: string;
    select_fields?: string[];
    filters?: Record<string, unknown>;
    group_by?: string[];
    aggregates?: { field: string; fn: string; alias?: string }[];
    order_by?: { field: string; direction?: string }[];
    limit?: number;
    offset?: number;
  }) => apiClient.post(`/organizations/${orgId}/analytics/query`, body),

  // Saved questions
  createQuestion: (orgId: string, data: Record<string, unknown>) =>
    apiClient.post(`/organizations/${orgId}/analytics/questions`, data),
  listQuestions: (orgId: string, projectId?: string) =>
    apiClient.get(`/organizations/${orgId}/analytics/questions`, { params: projectId ? { project_id: projectId } : {} }),
  getQuestion: (orgId: string, questionId: string) =>
    apiClient.get(`/organizations/${orgId}/analytics/questions/${questionId}`),
  updateQuestion: (orgId: string, questionId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/organizations/${orgId}/analytics/questions/${questionId}`, data),
  deleteQuestion: (orgId: string, questionId: string) =>
    apiClient.delete(`/organizations/${orgId}/analytics/questions/${questionId}`),

  // Dashboards
  createDashboard: (orgId: string, data: Record<string, unknown>) =>
    apiClient.post(`/organizations/${orgId}/analytics/dashboards`, data),
  listDashboards: (orgId: string, projectId?: string) =>
    apiClient.get(`/organizations/${orgId}/analytics/dashboards`, { params: projectId ? { project_id: projectId } : {} }),
  getDashboard: (orgId: string, dashboardId: string) =>
    apiClient.get(`/organizations/${orgId}/analytics/dashboards/${dashboardId}`),
  updateDashboard: (orgId: string, dashboardId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/organizations/${orgId}/analytics/dashboards/${dashboardId}`, data),
  deleteDashboard: (orgId: string, dashboardId: string) =>
    apiClient.delete(`/organizations/${orgId}/analytics/dashboards/${dashboardId}`),
};
```

### C.2 — TypeScript Types

#### File: `opla-frontend/apps/studio/src/components/analytics/types.ts`

```typescript
// ── Analytics types shared across all analytics components ──

export interface AnalyticsSourceField {
  field_identifier: string;
  field_key: string;
  label: string | null;
  field_type: string | null;
}

export interface AnalyticsSource {
  dataset_id: string;
  form_id: string;
  dataset_name: string;
  dataset_slug: string;
  form_title: string;
  project_id: string | null;
  project_name: string | null;
  fields: AnalyticsSourceField[];
  record_count: number;
}

export interface QueryColumn {
  key: string;
  label: string;
  type: string;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  total_count: number;
  truncated: boolean;
}

export type VizType = 'table' | 'chart' | 'spreadsheet' | 'pivot';

export interface SavedQuestion {
  id: string;
  org_id: string;
  project_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  source_config: Record<string, unknown>;
  query_config: Record<string, unknown>;
  viz_type: VizType;
  viz_config: Record<string, unknown> | null;
  cache_ttl_seconds: number | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardCard {
  id: string;
  question_id: string;
  position: { x: number; y: number; w: number; h: number };
  viz_override: Record<string, unknown> | null;
  question?: SavedQuestion;
}

export interface AnalyticsDashboard {
  id: string;
  org_id: string;
  project_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  layout_config: Record<string, unknown>[];
  cards: DashboardCard[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// Chart configuration
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'funnel' | 'heatmap' | 'treemap';

export interface ChartConfig {
  chartType: ChartType;
  xAxis?: string;       // field key
  yAxis?: string[];     // field keys (can have multiple series)
  colorField?: string;  // field key for color grouping
  title?: string;
  showLegend?: boolean;
  stacked?: boolean;
}
```

### C.3 — Analytics Hub Component

#### File: `opla-frontend/apps/studio/src/components/analytics/AnalyticsHub.tsx`

This is the landing page component. It displays:
1. A **tools launcher** — four cards the user can click to open a tool
2. A **saved questions** list — previously saved work
3. A **dashboards** list — saved dashboard layouts

```tsx
import React, { useState, useEffect, Suspense } from 'react';
import { BarChart3, Table2, FileSpreadsheet, PivotTableIcon, LayoutDashboard, Plus, Search, Clock, Loader2 } from 'lucide-react';
import { analyticsAPI } from '../../lib/api';
import type { AnalyticsSource, SavedQuestion, AnalyticsDashboard, VizType } from './types';

// Lazy-load the heavy tool components
const DataExplorer = React.lazy(() => import('./DataExplorer'));
const ChartBuilder = React.lazy(() => import('./ChartBuilder'));
const AnalyticsSpreadsheet = React.lazy(() => import('./AnalyticsSpreadsheet'));
const AnalyticsPivot = React.lazy(() => import('./AnalyticsPivot'));
const DashboardCanvas = React.lazy(() => import('./DashboardCanvas'));

interface AnalyticsHubProps {
  orgId: string;
  projectId?: string;
}

type ActiveTool = null | 'explorer' | 'chart' | 'spreadsheet' | 'pivot' | 'dashboard';

const TOOLS: { key: ActiveTool; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    key: 'explorer',
    label: 'Data Explorer',
    description: 'Query any dataset with filters, grouping, and aggregation. View results as a table.',
    icon: <Table2 className="w-7 h-7" />,
    color: 'from-sky-500/20 to-sky-500/5 border-sky-500/30',
  },
  {
    key: 'chart',
    label: 'Chart Builder',
    description: 'Build bar, line, pie, scatter, area, and more charts from your data.',
    icon: <BarChart3 className="w-7 h-7" />,
    color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  },
  {
    key: 'spreadsheet',
    label: 'Spreadsheet',
    description: 'Open data in a full Excel-like environment. Add formulas, format cells, export.',
    icon: <FileSpreadsheet className="w-7 h-7" />,
    color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30',
  },
  {
    key: 'pivot',
    label: 'Pivot Table',
    description: 'Drag-and-drop cross-tab analysis. Group, aggregate, and drill down interactively.',
    icon: <LayoutDashboard className="w-7 h-7" />,
    color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
  },
];

export default function AnalyticsHub({ orgId, projectId }: AnalyticsHubProps) {
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [sources, setSources] = useState<AnalyticsSource[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([]);
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
  const [selectedSource, setSelectedSource] = useState<AnalyticsSource | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<SavedQuestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [orgId, projectId]);

  async function loadData() {
    setLoading(true);
    try {
      const [sourcesRes, questionsRes, dashboardsRes] = await Promise.all([
        analyticsAPI.listSources(orgId),
        analyticsAPI.listQuestions(orgId, projectId),
        analyticsAPI.listDashboards(orgId, projectId),
      ]);
      setSources(sourcesRes.data);
      setSavedQuestions(questionsRes.data);
      setDashboards(dashboardsRes.data);
    } catch (err) {
      console.error('Failed to load analytics data', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenTool(tool: ActiveTool) {
    setActiveTool(tool);
    setEditingQuestion(null);
  }

  function handleOpenSavedQuestion(question: SavedQuestion) {
    setEditingQuestion(question);
    setActiveTool(question.viz_type === 'table' ? 'explorer' :
                   question.viz_type === 'chart' ? 'chart' :
                   question.viz_type === 'spreadsheet' ? 'spreadsheet' : 'pivot');
  }

  function handleBack() {
    setActiveTool(null);
    setEditingQuestion(null);
    setSelectedSource(null);
    loadData(); // Refresh lists after potential saves
  }

  // ── Active tool view ──
  if (activeTool) {
    return (
      <Suspense fallback={
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--text-secondary))]" />
        </div>
      }>
        {activeTool === 'explorer' && (
          <DataExplorer
            orgId={orgId}
            sources={sources}
            initialSource={selectedSource}
            editingQuestion={editingQuestion}
            onBack={handleBack}
          />
        )}
        {activeTool === 'chart' && (
          <ChartBuilder
            orgId={orgId}
            sources={sources}
            initialSource={selectedSource}
            editingQuestion={editingQuestion}
            onBack={handleBack}
          />
        )}
        {activeTool === 'spreadsheet' && (
          <AnalyticsSpreadsheet
            orgId={orgId}
            sources={sources}
            initialSource={selectedSource}
            editingQuestion={editingQuestion}
            onBack={handleBack}
          />
        )}
        {activeTool === 'pivot' && (
          <AnalyticsPivot
            orgId={orgId}
            sources={sources}
            initialSource={selectedSource}
            editingQuestion={editingQuestion}
            onBack={handleBack}
          />
        )}
        {activeTool === 'dashboard' && (
          <DashboardCanvas
            orgId={orgId}
            savedQuestions={savedQuestions}
            dashboards={dashboards}
            onBack={handleBack}
          />
        )}
      </Suspense>
    );
  }

  // ── Hub landing view ──
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-end gap-6">
        <div>
          <h2 className="text-3xl font-bold mb-2">Analytics</h2>
          <p className="text-[hsl(var(--text-secondary))]">
            Explore your data, build visualizations, and compose dashboards.
          </p>
        </div>
        <button
          onClick={() => setActiveTool('dashboard')}
          className="flex items-center gap-2 rounded-xl bg-[hsl(var(--accent))] text-white px-4 py-2.5 text-sm font-medium hover:opacity-90 transition"
        >
          <LayoutDashboard className="w-4 h-4" />
          Open Dashboards
        </button>
      </div>

      {/* Tools Launcher */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Create New</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS.map(tool => (
            <button
              key={tool.key}
              onClick={() => handleOpenTool(tool.key)}
              className={`text-left rounded-2xl border bg-gradient-to-br ${tool.color} p-6 hover:scale-[1.02] transition-transform`}
            >
              <div className="mb-3">{tool.icon}</div>
              <h4 className="font-semibold mb-1">{tool.label}</h4>
              <p className="text-sm text-[hsl(var(--text-secondary))] leading-relaxed">
                {tool.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Data Sources */}
      {sources.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Data Sources ({sources.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sources.map(src => (
              <div
                key={src.dataset_id}
                className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4"
              >
                <p className="font-medium truncate">{src.form_title}</p>
                <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
                  {src.fields.length} fields &middot; {src.record_count.toLocaleString()} records
                </p>
                {src.project_name && (
                  <p className="text-xs text-[hsl(var(--text-secondary))] mt-1 truncate">
                    {src.project_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Questions */}
      {savedQuestions.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Saved Questions ({savedQuestions.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedQuestions.map(q => (
              <button
                key={q.id}
                onClick={() => handleOpenSavedQuestion(q)}
                className="text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 hover:border-[hsl(var(--accent))] transition"
              >
                <p className="font-medium truncate">{q.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]">
                    {q.viz_type}
                  </span>
                  <span className="text-xs text-[hsl(var(--text-secondary))]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(q.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboards */}
      {dashboards.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Dashboards ({dashboards.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboards.map(d => (
              <button
                key={d.id}
                onClick={() => setActiveTool('dashboard')}
                className="text-left rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface))] p-4 hover:border-[hsl(var(--accent))] transition"
              >
                <p className="font-medium truncate">{d.title}</p>
                <p className="text-sm text-[hsl(var(--text-secondary))] mt-1">
                  {d.cards.length} cards
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && sources.length === 0 && (
        <div className="card border-dashed border-2 text-center py-16">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--text-secondary))]" />
          <h3 className="text-lg font-bold mb-2">No Data Sources Yet</h3>
          <p className="text-[hsl(var(--text-secondary))] max-w-md mx-auto">
            Publish a form and collect submissions to start analyzing your data.
            Each published form automatically becomes an analytics data source.
          </p>
        </div>
      )}
    </div>
  );
}
```

### C.4 — Wire Into Dashboard.tsx

Replace the existing placeholder analytics tab in `Dashboard.tsx`:

Find the block:
```tsx
{activeTab === 'analysis' && (
    <div className="space-y-8">
        <div>
            <h2 className="text-3xl font-bold mb-2">Analytics</h2>
            ...
        </div>
        <div className="card border-dashed border-2">
            ...
        </div>
    </div>
)}
```

Replace with:
```tsx
{activeTab === 'analysis' && currentOrg && (
    <AnalyticsHub orgId={currentOrg.id} projectId={currentProject?.id} />
)}
```

Add the import at the top of `Dashboard.tsx`:
```tsx
import AnalyticsHub from '../components/analytics/AnalyticsHub';
```

### Verification (Phase C)

1. Start frontend: `cd opla-frontend/apps/studio && npm run dev`
2. Login, select an org
3. Click **Analytics** in sidebar
4. Should see the 4 tool cards (Data Explorer, Chart Builder, Spreadsheet, Pivot Table)
5. If you have published forms with submissions, data sources should appear
6. Clicking a tool card should show a loading spinner (components not built yet — that's fine)

---

## 6. Phase D — Data Explorer (Query Builder + Table)

This is the core analysis tool: pick a dataset, optionally filter/group/aggregate, see results in AG Grid.

### File: `opla-frontend/apps/studio/src/components/analytics/DataExplorer.tsx`

Required structure:

```
┌─────────────────────────────────────────────────┐
│ ← Back   Data Explorer           [ Save ]       │
├─────────────────────────────────────────────────┤
│ Source: [Dropdown - select dataset]              │
│                                                  │
│ ┌─── Query Builder (react-querybuilder) ──────┐ │
│ │  + Add Rule    + Add Group                   │ │
│ │  [field ▼] [operator ▼] [value___]          │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Group By: [ field chips ]                        │
│ Aggregates: [ SUM(amount), COUNT(*) chips ]      │
│ Order By: [ field ▼ ASC/DESC ]                   │
│                                                  │
│ [ Run Query ]                                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─── AG Grid ──────────────────────────────┐   │
│  │  Column A  │  Column B  │  Column C  │   │   │
│  │  data...   │  data...   │  data...   │   │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  Showing 500 of 12,345 records                   │
└─────────────────────────────────────────────────┘
```

**Implementation instructions for the agent:**

1. **Data source dropdown** — Render `sources` as a `<select>`. On change, populate the query builder's `fields` config from `source.fields`.

2. **Query builder** — Use `react-querybuilder` component:
   ```tsx
   import { QueryBuilder, formatQuery } from 'react-querybuilder';
   
   const fields = selectedSource.fields.map(f => ({
     name: f.field_key,
     label: f.label || f.field_key,
     inputType: f.field_type === 'number_input' ? 'number' : 'text',
   }));
   
   <QueryBuilder
     fields={fields}
     query={query}
     onQueryChange={setQuery}
   />
   ```
   When sending to the backend, convert with `formatQuery(query, 'json_without_ids')`.

3. **Group By** — Multi-select dropdown of field keys. When populated, the user must also add at least one aggregate.

4. **Aggregates** — Repeatable rows: `[field dropdown] [function: count|sum|avg|min|max] [alias input]`

5. **Order By** — Repeatable rows: `[field dropdown] [asc/desc toggle]`

6. **Run Query button** — Calls `analyticsAPI.runQuery(orgId, { dataset_id, select_fields, filters, group_by, aggregates, order_by, limit })`.

7. **AG Grid** — Render results:
   ```tsx
   import { AgGridReact } from 'ag-grid-react';
   import 'ag-grid-community/styles/ag-grid.css';
   import 'ag-grid-community/styles/ag-theme-alpine.css';
   
   const columnDefs = result.columns.map(col => ({
     field: col.key,
     headerName: col.label,
     sortable: true,
     filter: true,
     resizable: true,
   }));
   
   <div className="ag-theme-alpine-dark" style={{ height: 500 }}>
     <AgGridReact
       columnDefs={columnDefs}
       rowData={result.rows}
       pagination={true}
       paginationPageSize={50}
     />
   </div>
   ```

8. **Save** — Opens a modal: title, description, then calls `analyticsAPI.createQuestion(orgId, { title, description, source_config: { dataset_id }, query_config: { filters, group_by, aggregates, order_by, limit }, viz_type: 'table' })`. If `editingQuestion` is set, call `updateQuestion` instead.

9. **Props interface:**
   ```tsx
   interface DataExplorerProps {
     orgId: string;
     sources: AnalyticsSource[];
     initialSource: AnalyticsSource | null;
     editingQuestion: SavedQuestion | null;
     onBack: () => void;
   }
   ```

10. **If `editingQuestion` is provided**, pre-populate everything from `editingQuestion.source_config` and `editingQuestion.query_config` and auto-run the query.

### Verification (Phase D)

```
✅ Can select a data source from dropdown
✅ Fields from the selected dataset populate the query builder
✅ Can add filter rules (field + operator + value)
✅ Can add nested groups (AND/OR)
✅ Can specify group-by fields
✅ Can add aggregates (sum, count, avg, min, max, count_distinct)
✅ Run Query returns data and renders in AG Grid
✅ AG Grid shows correct column headers from field labels
✅ Pagination works in AG Grid (50 per page)
✅ "Showing X of Y records" status bar works
✅ Save button creates a saved question via API
✅ Opening a saved question pre-populates all fields and auto-runs
✅ Empty dataset shows a clear "no records" message
✅ Query with no filters returns all records (up to limit)
✅ Invalid filter values show user-friendly error (not 500)
```

---

## 7. Phase E — Chart Builder

Same structure as Data Explorer, but below the query section, instead of AG Grid, render an ECharts chart.

### File: `opla-frontend/apps/studio/src/components/analytics/ChartBuilder.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ ← Back   Chart Builder            [ Save ]      │
├─────────────────────────────────────────────────┤
│ Source: [Dropdown]                                │
│ Query Builder (same as Data Explorer)             │
│ [ Run Query ]                                     │
├─────────────────────────────────────────────────┤
│ Chart Type: [Bar] [Line] [Pie] [Scatter] [Area] │
│              [Funnel] [Heatmap] [Treemap]        │
│                                                   │
│ X-Axis: [field dropdown]                          │
│ Y-Axis: [field multi-select]                      │
│ Color:  [field dropdown]  (optional)              │
│ ☐ Stacked   ☐ Show Legend                        │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─── ECharts ─────────────────────────────────┐ │
│  │                                              │ │
│  │            [CHART RENDERED HERE]             │ │
│  │                                              │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Implementation instructions:**

1. **Same props** as DataExplorer (orgId, sources, initialSource, editingQuestion, onBack).

2. **Chart type selector** — Row of buttons/tabs for each chart type. Use icons from `lucide-react` or simple text.

3. **Axis configuration** — Dropdowns populated from `result.columns` after query runs.

4. **ECharts rendering:**
   ```tsx
   import ReactECharts from 'echarts-for-react';
   
   function buildChartOption(result: QueryResult, config: ChartConfig): EChartsOption {
     const { chartType, xAxis, yAxis, stacked, showLegend } = config;
     const categories = result.rows.map(r => String(r[xAxis!]));
     
     if (chartType === 'bar' || chartType === 'line' || chartType === 'area') {
       return {
         tooltip: { trigger: 'axis' },
         legend: showLegend ? {} : undefined,
         xAxis: { type: 'category', data: categories },
         yAxis: { type: 'value' },
         series: (yAxis || []).map(yKey => ({
           name: yKey,
           type: chartType === 'area' ? 'line' : chartType,
           data: result.rows.map(r => Number(r[yKey]) || 0),
           stack: stacked ? 'total' : undefined,
           areaStyle: chartType === 'area' ? {} : undefined,
         })),
       };
     }
     
     if (chartType === 'pie') {
       return {
         tooltip: { trigger: 'item' },
         legend: showLegend ? {} : undefined,
         series: [{
           type: 'pie',
           radius: '60%',
           data: result.rows.map(r => ({
             name: String(r[xAxis!]),
             value: Number(r[(yAxis || [])[0]]) || 0,
           })),
         }],
       };
     }
     
     // ... handle scatter, funnel, heatmap, treemap similarly
   }
   
   <ReactECharts
     option={chartOption}
     style={{ height: 500, width: '100%' }}
     notMerge={true}
   />
   ```

5. **Save** — Same save flow as DataExplorer, but `viz_type: 'chart'` and `viz_config` stores the chart config (chartType, xAxis, yAxis, etc.).

### Verification (Phase E)

```
✅ All 8 chart types render without errors
✅ Changing chart type re-renders immediately
✅ X-axis dropdown populated from query result columns
✅ Y-axis multi-select allows multiple series
✅ Stacked toggle works for bar/line/area
✅ Pie chart renders correctly with name/value pairs
✅ Scatter plot renders with x/y coordinates
✅ Chart responds to window resize
✅ Save persists chart config + query config
✅ Loading a saved chart question restores chart type and axes
✅ Empty data shows "Run a query first" message, not a broken chart
```

---

## 8. Phase F — Spreadsheet View (Syncfusion)

### File: `opla-frontend/apps/studio/src/components/analytics/AnalyticsSpreadsheet.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ ← Back   Spreadsheet              [ Save ]      │
├─────────────────────────────────────────────────┤
│ Source: [Dropdown]                                │
│ [ Load Data ]                                     │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌─── Syncfusion Spreadsheet ──────────────────┐ │
│  │  Formula Bar: =SUM(B2:B100)                  │ │
│  │ ┌────┬────────┬─────────┬────────────┐       │ │
│  │ │  A │   B    │    C    │     D      │       │ │
│  │ ├────┼────────┤─────────┤────────────┤       │ │
│  │ │ 1 │ Name  │ Amount │ Category  │       │ │
│  │ │ 2 │ ...   │ ...    │ ...       │       │ │
│  │ └────┴────────┴─────────┴────────────┘       │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Implementation instructions:**

1. **Same props pattern** as the other tools.

2. **Data loading** — On "Load Data", run a query with no filters (all records, limit 10000), then feed to Spreadsheet.

3. **Syncfusion Spreadsheet:**
   ```tsx
   import { SpreadsheetComponent, SheetsDirective, SheetDirective,
            RangesDirective, RangeDirective, ColumnsDirective,
            ColumnDirective } from '@syncfusion/ej2-react-spreadsheet';
   import '@syncfusion/ej2/styles/tailwind.css';
   
   const spreadsheetRef = useRef<SpreadsheetComponent>(null);
   
   // Convert query result to array of objects
   const data = result.rows.map(row => {
     const obj: Record<string, unknown> = {};
     result.columns.forEach(col => {
       obj[col.label] = row[col.key];
     });
     return obj;
   });
   
   <SpreadsheetComponent
     ref={spreadsheetRef}
     allowOpen={true}
     allowSave={true}
     showFormulaBar={true}
     showRibbon={true}
     showSheetTabs={false}
     height="600px"
     openUrl=""
     saveUrl=""
   >
     <SheetsDirective>
       <SheetDirective name="Query Results">
         <RangesDirective>
           <RangeDirective dataSource={data} />
         </RangesDirective>
       </SheetDirective>
     </SheetsDirective>
   </SpreadsheetComponent>
   ```

4. **Save state** — Use `spreadsheetRef.current?.saveAsJson()` to serialize the full spreadsheet state (formulas, formatting, cell edits) into JSON. Store in `viz_config`.

5. **Restore state** — If `editingQuestion.viz_config.spreadsheetState` exists, use `spreadsheetRef.current?.openFromJson({ file: savedState })` to restore.

6. **CSS Integration** — Import `@syncfusion/ej2/styles/tailwind.css` once. Wrap in `.e-dark` class if dark theme is active:
   ```tsx
   const theme = document.documentElement.getAttribute('data-theme');
   <div className={theme === 'dark' ? 'e-dark' : ''}>
     <SpreadsheetComponent ... />
   </div>
   ```

### Verification (Phase F)

```
✅ Data loads into spreadsheet with correct column headers
✅ All cells are editable
✅ Formula bar works (type =SUM(B2:B10) and get result)
✅ Cell formatting works (bold, italic, number format)
✅ Column resize/reorder works
✅ Sorting within spreadsheet works
✅ Filtering within spreadsheet works
✅ Copy/paste between cells works
✅ Save serializes spreadsheet state to JSON
✅ Loading a saved spreadsheet question restores all edits/formulas
✅ Dark mode: spreadsheet respects theme
✅ Large dataset (1000+ rows) loads without freezing
✅ Ctrl+Z (undo) works
```

---

## 9. Phase G — Pivot Table (Syncfusion)

### File: `opla-frontend/apps/studio/src/components/analytics/AnalyticsPivot.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ ← Back   Pivot Table              [ Save ]      │
├─────────────────────────────────────────────────┤
│ Source: [Dropdown]                                │
│ [ Load Data ]                                     │
├─────────────────────────────────────────────────┤
│ ┌───────────┬───────────────────────────────────┐│
│ │ Field List│  Pivot Table                       ││
│ │           │  ┌─────────────────────────┐      ││
│ │ Drag to:  │  │     2024     │  2025    │      ││
│ │ - Rows    │  │ Sum │ Count │Sum│Count│      ││
│ │ - Columns │  ├─────┼───────┤───┤─────┤      ││
│ │ - Values  │  │ ... │  ...  │...│ ... │      ││
│ │ - Filters │  └─────────────────────────┘      ││
│ └───────────┴───────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

**Implementation instructions:**

1. **Same props pattern.**

2. **Data loading** — Same as Spreadsheet: run query for all records, then feed to Pivot.

3. **Syncfusion Pivot Table:**
   ```tsx
   import { PivotViewComponent, Inject, FieldList,
            CalculatedField, ConditionalFormatting,
            GroupingBar, VirtualScroll, PDFExport,
            ExcelExport } from '@syncfusion/ej2-react-pivotview';
   import '@syncfusion/ej2/styles/tailwind.css';
   
   const pivotRef = useRef<PivotViewComponent>(null);
   
   // Flatten submission data into plain objects
   const pivotData = result.rows.map(row => {
     const obj: Record<string, unknown> = {};
     result.columns.forEach(col => {
       let val = row[col.key];
       // Try to parse numbers for aggregation
       if (col.type === 'number_input' || col.type === 'number') {
         val = Number(val) || 0;
       }
       obj[col.key] = val;
     });
     return obj;
   });
   
   // Initial pivot config — user can drag-and-drop to customize
   const dataSourceSettings = {
     dataSource: pivotData,
     expandAll: false,
     enableSorting: true,
     rows: [],     // user drags fields here
     columns: [],  // user drags fields here
     values: [],   // user drags fields here
     filters: [],  // user drags fields here
   };
   
   // If restoring from saved question, use saved config:
   // dataSourceSettings.rows = editingQuestion.viz_config.pivotRows || []
   // dataSourceSettings.columns = editingQuestion.viz_config.pivotColumns || []
   // etc.
   
   <PivotViewComponent
     ref={pivotRef}
     dataSourceSettings={dataSourceSettings}
     showFieldList={true}
     showGroupingBar={true}
     allowCalculatedField={true}
     allowConditionalFormatting={true}
     enableVirtualization={true}
     allowExcelExport={true}
     allowPdfExport={true}
     height="600px"
     width="100%"
   >
     <Inject services={[FieldList, CalculatedField, ConditionalFormatting,
                         GroupingBar, VirtualScroll, PDFExport, ExcelExport]} />
   </PivotViewComponent>
   ```

4. **Save state** — Read `pivotRef.current?.dataSourceSettings` which contains the user's row/column/value/filter arrangement. Store in `viz_config`:
   ```tsx
   const pivotState = pivotRef.current?.dataSourceSettings;
   // Save: { pivotRows, pivotColumns, pivotValues, pivotFilters }
   ```

5. **Restore state** — When opening a saved question, populate `dataSourceSettings` from `viz_config`.

### Verification (Phase G)

```
✅ Data loads into pivot view with all fields in the field list
✅ Drag-and-drop: can drag fields to Rows area
✅ Drag-and-drop: can drag fields to Columns area
✅ Drag-and-drop: can drag fields to Values area (auto-picks Sum/Count)
✅ Drag-and-drop: can drag fields to Filters area
✅ Value aggregation types work: Sum, Count, Average, Min, Max
✅ Grouping bar shows current field arrangement
✅ Show/hide field list panel works
✅ Calculated field: can create a custom calculated measure
✅ Conditional formatting: can highlight cells based on value
✅ Export to Excel works
✅ Export to PDF works
✅ Save persists the pivot configuration
✅ Loading a saved pivot question restores row/column/value/filter arrangement
✅ Large dataset: virtual scrolling keeps performance acceptable
✅ Dark mode theming applies
```

---

## 10. Phase H — Dashboard Canvas

### File: `opla-frontend/apps/studio/src/components/analytics/DashboardCanvas.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────┐
│ ← Back   Dashboard: "Sales Overview"   [ Save ] │
│           [+ Add Card]                           │
├─────────────────────────────────────────────────┤
│ ┌─────────────────┬──────────────────────────┐  │
│ │  Saved Question │  Saved Question          │  │
│ │  (table)        │  (bar chart)             │  │
│ │                 │                          │  │
│ ├─────────────────┴──────────────────────────┤  │
│ │  Saved Question (pie chart)                │  │
│ │                                            │  │
│ └────────────────────────────────────────────┘  │
│                                                  │
│  [Cards are draggable and resizable]             │
└─────────────────────────────────────────────────┘
```

**Implementation instructions:**

1. **react-grid-layout:**
   ```tsx
   import GridLayout from 'react-grid-layout';
   import 'react-grid-layout/css/styles.css';
   import 'react-resizable/css/styles.css';
   
   // Layout items from dashboard.cards
   const layout = dashboard.cards.map(card => ({
     i: card.id,
     x: card.position.x,
     y: card.position.y,
     w: card.position.w,
     h: card.position.h,
     minW: 2,
     minH: 2,
   }));
   
   <GridLayout
     className="layout"
     layout={layout}
     cols={12}
     rowHeight={80}
     width={1200}
     onLayoutChange={handleLayoutChange}
     draggableHandle=".drag-handle"
   >
     {dashboard.cards.map(card => (
       <div key={card.id}>
         <DashboardCardRenderer card={card} orgId={orgId} />
       </div>
     ))}
   </GridLayout>
   ```

2. **DashboardCardRenderer** — Sub-component that:
   - Fetches the saved question's data (runs the query)
   - Renders the appropriate viz based on `card.question.viz_type`:
     - `table` → mini AG Grid
     - `chart` → ECharts
     - `spreadsheet` → static table (spreadsheets are too heavy for cards)
     - `pivot` → static summary table
   - Shows a drag handle, title bar, and remove button

3. **Add Card** — Opens a modal showing all saved questions. User picks one, it gets added to the grid at position `{x:0, y:Infinity, w:4, h:4}` (snaps to next available row).

4. **Save** — Serializes the grid layout + card list and calls `analyticsAPI.updateDashboard(orgId, dashboardId, { layout_config, cards })`.

5. **Props:**
   ```tsx
   interface DashboardCanvasProps {
     orgId: string;
     savedQuestions: SavedQuestion[];
     dashboards: AnalyticsDashboard[];
     onBack: () => void;
   }
   ```

6. Allow creating new dashboards (title + description prompt) or opening existing ones.

### Verification (Phase H)

```
✅ Can create a new dashboard with title
✅ Can add a saved question as a card
✅ Card renders the correct visualization (table/chart)
✅ Cards are draggable within the grid
✅ Cards are resizable (drag corner)
✅ Grid snaps to 12-column layout
✅ Can remove a card from the dashboard
✅ Save persists layout positions
✅ Loading a saved dashboard restores all cards in correct positions
✅ Each card independently fetches and renders its data
✅ Dashboard with 6+ cards doesn't freeze the browser
✅ Can switch between multiple dashboards
```

---

## 11. Phase I — Save, Load, Share

### Save Flow (all tools)

Every tool component (DataExplorer, ChartBuilder, Spreadsheet, Pivot) must implement the same save pattern:

```tsx
async function handleSave() {
  const payload = {
    title: questionTitle,
    description: questionDescription,
    source_config: { dataset_id: selectedSource.dataset_id },
    query_config: {
      filters: formatQuery(query, 'json_without_ids'),
      group_by: groupBy,
      aggregates: aggregates,
      order_by: orderBy,
      limit: limit,
    },
    viz_type: 'table',  // or 'chart', 'spreadsheet', 'pivot'
    viz_config: vizConfig,  // chart config, spreadsheet JSON, pivot field arrangement
  };

  if (editingQuestion) {
    await analyticsAPI.updateQuestion(orgId, editingQuestion.id, payload);
  } else {
    await analyticsAPI.createQuestion(orgId, payload);
  }
  onBack();
}
```

### Save Dialog Component

#### File: `opla-frontend/apps/studio/src/components/analytics/SaveQuestionDialog.tsx`

Reusable modal with:
- Title input (required)
- Description textarea (optional)
- Save / Cancel buttons

All four tool components use this same dialog.

### Verification (Phase I)

```
✅ Save dialog appears with title + description fields
✅ Title is required — cannot save empty
✅ Creating new question → appears in saved questions list on hub
✅ Editing existing question → updates in place (same ID)
✅ All viz_types save and restore correctly:
   ✅ table: filters, group_by, aggregates, order_by
   ✅ chart: chart type, axes, colors, stacked flag
   ✅ spreadsheet: full cell state, formulas, formatting
   ✅ pivot: row/column/value/filter field arrangement
✅ Deleting a question removes it from the list
✅ Archived questions don't appear in the list
```

---

## 12. Verification Checklist

### Backend Smoke Tests

Run these after Phase B is complete:

```powershell
cd opla-backend

# Test file: test_analytics_api.py
python -m pytest test_analytics_api.py -v
```

Create `opla-backend/test_analytics_api.py`:

```python
"""
Smoke tests for the analytics API.

Run: python -m pytest test_analytics_api.py -v
Or:  python -m unittest test_analytics_api -v
"""
import unittest
import uuid
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestAnalyticsSourcesEndpoint(unittest.TestCase):
    """Verify /analytics/sources returns without 500."""

    def test_sources_requires_auth(self):
        org_id = str(uuid.uuid4())
        r = client.get(f"/api/v1/organizations/{org_id}/analytics/sources")
        self.assertIn(r.status_code, [401, 403])

    def test_query_requires_auth(self):
        org_id = str(uuid.uuid4())
        r = client.post(f"/api/v1/organizations/{org_id}/analytics/query", json={
            "dataset_id": str(uuid.uuid4()),
        })
        self.assertIn(r.status_code, [401, 403, 422])


class TestAnalyticsQueryValidation(unittest.TestCase):
    """Verify input validation on the query endpoint."""

    def test_query_rejects_invalid_agg_fn(self):
        """Backend must reject aggregate functions not in the whitelist."""
        # This tests the schema validation, not the actual query execution
        org_id = str(uuid.uuid4())
        r = client.post(
            f"/api/v1/organizations/{org_id}/analytics/query",
            json={
                "dataset_id": str(uuid.uuid4()),
                "aggregates": [{"field": "amount", "fn": "DROP TABLE--"}],
            },
            headers={"Authorization": "Bearer fake"},
        )
        # Should be 401 (auth) or 422 (validation) — never 200
        self.assertIn(r.status_code, [401, 403, 422])


if __name__ == "__main__":
    unittest.main()
```

### Full End-to-End Verification

After all phases are complete, walk through this scenario:

```
1. Start backend:  cd opla-backend && python -m uvicorn app.main:app --reload
2. Start frontend: cd opla-frontend/apps/studio && npm run dev
3. Login with existing credentials
4. Navigate to a project with a published form that has submissions
5. Click "Analytics" in sidebar

── Hub ──
✅ See 4 tool cards
✅ See data sources listed with field counts and record counts
✅ See saved questions (empty initially)
✅ See dashboards (empty initially)

── Data Explorer ──
6. Click "Data Explorer"
✅ Source dropdown lists available datasets
7. Select a dataset
✅ Query builder populates with dataset fields
8. Add a filter rule (e.g., status = "completed")
9. Click "Run Query"
✅ AG Grid shows filtered results
10. Add Group By + Aggregate (e.g., group by category, sum of amount)
11. Run Query again
✅ Grid shows aggregated results
12. Click Save, enter title "Sales by Category"
✅ Question saved, returned to hub
✅ "Sales by Category" appears in saved questions list

── Chart Builder ──
13. Click "Chart Builder"
14. Select same dataset, run same query
15. Select "Bar" chart type, set X=category, Y=total_amount
✅ Bar chart renders
16. Switch to "Pie"
✅ Pie chart renders
17. Save as "Sales Pie Chart"

── Spreadsheet ──
18. Click "Spreadsheet"
19. Select dataset, click "Load Data"
✅ All submission data appears in spreadsheet cells
20. Type =SUM(B2:B100) in a cell
✅ Formula calculates correctly
21. Save as "Sales Spreadsheet"

── Pivot Table ──
22. Click "Pivot Table"
23. Select dataset, click "Load Data"
✅ All fields appear in field list panel
24. Drag "category" to Rows, drag "amount" to Values
✅ Pivot table shows sum of amount per category
25. Drag "month" to Columns
✅ Cross-tab shows categories × months
26. Save as "Sales Pivot"

── Dashboard ──
27. Click "Open Dashboards"
28. Create new dashboard "Sales Overview"
29. Add "Sales by Category" card
30. Add "Sales Pie Chart" card
31. Drag cards to rearrange
32. Resize a card
33. Save dashboard
✅ Dashboard persists layout
34. Refresh page, reopen dashboard
✅ All cards restored in correct positions with data
```

---

## 13. File Inventory

### Backend Files to Create

| File | Purpose |
|---|---|
| `alembic/versions/014_analytics.py` | Migration: saved_questions, analytics_dashboards, dashboard_cards |
| `app/models/analytics.py` | SavedQuestion, AnalyticsDashboard, DashboardCard models |
| `app/api/schemas/analytics.py` | Pydantic schemas for all analytics endpoints |
| `app/services/analytics_service.py` | Query engine, source discovery, CRUD |
| `app/api/routes/analytics.py` | FastAPI router with all analytics endpoints |
| `test_analytics_api.py` | Smoke tests |

### Backend Files to Modify

| File | Change |
|---|---|
| `app/models/__init__.py` | Add `from app.models.analytics import ...` |
| `app/main.py` | Add `app.include_router(analytics.router, ...)` |

### Frontend Files to Create

| File | Purpose |
|---|---|
| `src/components/analytics/types.ts` | Shared TypeScript types |
| `src/components/analytics/AnalyticsHub.tsx` | Hub landing page with tool launcher |
| `src/components/analytics/DataExplorer.tsx` | Query builder + AG Grid |
| `src/components/analytics/ChartBuilder.tsx` | Query builder + ECharts |
| `src/components/analytics/AnalyticsSpreadsheet.tsx` | Syncfusion Spreadsheet wrapper |
| `src/components/analytics/AnalyticsPivot.tsx` | Syncfusion Pivot Table wrapper |
| `src/components/analytics/DashboardCanvas.tsx` | react-grid-layout dashboard |
| `src/components/analytics/SaveQuestionDialog.tsx` | Reusable save modal |

### Frontend Files to Modify

| File | Change |
|---|---|
| `src/lib/api.ts` | Add `analyticsAPI` namespace |
| `src/pages/Dashboard.tsx` | Replace analytics tab placeholder with `<AnalyticsHub>` |
| `src/main.tsx` | Add Syncfusion license registration |

### NPM Packages to Install

```
react-querybuilder
echarts
echarts-for-react
ag-grid-community
ag-grid-react
react-grid-layout
@tanstack/react-query
@syncfusion/ej2-base
@syncfusion/ej2-react-base
@syncfusion/ej2-react-spreadsheet
@syncfusion/ej2-react-pivotview
@syncfusion/ej2
@types/react-grid-layout (dev)
```

---

## Implementation Order

```
Phase A  →  Migration + verify tables exist
Phase B  →  Models + Schemas + Service + Routes + register router + verify API docs
Phase C  →  types.ts + AnalyticsHub + api.ts additions + wire into Dashboard.tsx + verify hub renders
Phase D  →  DataExplorer + verify query + save flow
Phase E  →  ChartBuilder + verify all chart types
Phase F  →  AnalyticsSpreadsheet + verify formulas + save/restore
Phase G  →  AnalyticsPivot + verify drag-and-drop + save/restore
Phase H  →  DashboardCanvas + verify grid + card rendering
Phase I  →  SaveQuestionDialog + full save/load/edit round-trip
Final   →  Run full end-to-end verification checklist
```

Each phase must pass its verification section before moving to the next.
