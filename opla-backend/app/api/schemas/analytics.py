from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AnalyticsSourceField(BaseModel):
    field_identifier: str
    field_key: str
    label: str | None = None
    field_type: str | None = None


class AnalyticsSource(BaseModel):
    dataset_id: UUID
    form_id: UUID
    dataset_name: str
    dataset_slug: str
    form_title: str
    project_id: UUID | None = None
    project_name: str | None = None
    fields: list[AnalyticsSourceField] = Field(default_factory=list)
    record_count: int = 0


class AggregateSpec(BaseModel):
    field: str
    fn: str = Field(..., pattern="^(count|sum|avg|min|max|count_distinct)$")
    alias: str | None = None


class OrderSpec(BaseModel):
    field: str
    direction: str = Field("asc", pattern="^(asc|desc)$")


class AnalyticsQueryRequest(BaseModel):
    dataset_id: UUID
    select_fields: list[str] = Field(default_factory=list)
    filters: dict[str, Any] | None = None
    group_by: list[str] = Field(default_factory=list)
    aggregates: list[AggregateSpec] = Field(default_factory=list)
    order_by: list[OrderSpec] = Field(default_factory=list)
    limit: int = Field(500, ge=1, le=10000)
    offset: int = Field(0, ge=0)


class AnalyticsQueryResponse(BaseModel):
    columns: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    total_count: int
    truncated: bool = False


class SavedQuestionCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    project_id: UUID | None = None
    source_config: dict[str, Any]
    query_config: dict[str, Any]
    viz_type: str = Field("table", pattern="^(table|chart|spreadsheet|pivot)$")
    viz_config: dict[str, Any] | None = None
    cache_ttl_seconds: int | None = None


class SavedQuestionUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    source_config: dict[str, Any] | None = None
    query_config: dict[str, Any] | None = None
    viz_type: str | None = Field(None, pattern="^(table|chart|spreadsheet|pivot)$")
    viz_config: dict[str, Any] | None = None
    cache_ttl_seconds: int | None = None
    is_archived: bool | None = None


class SavedQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    project_id: UUID | None = None
    created_by: UUID | None = None
    title: str
    description: str | None = None
    source_config: dict[str, Any]
    query_config: dict[str, Any]
    viz_type: str
    viz_config: dict[str, Any] | None = None
    cache_ttl_seconds: int | None = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class DashboardCardCreate(BaseModel):
    question_id: UUID
    position: dict[str, Any]
    viz_override: dict[str, Any] | None = None


class DashboardCardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    question_id: UUID
    position: dict[str, Any]
    viz_override: dict[str, Any] | None = None
    question: SavedQuestionOut | None = None


class AnalyticsDashboardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    project_id: UUID | None = None
    layout_config: list[dict[str, Any]] = Field(default_factory=list)
    cards: list[DashboardCardCreate] = Field(default_factory=list)


class AnalyticsDashboardUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    layout_config: list[dict[str, Any]] | None = None
    cards: list[DashboardCardCreate] | None = None
    is_archived: bool | None = None


class AnalyticsDashboardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_id: UUID
    project_id: UUID | None = None
    created_by: UUID | None = None
    title: str
    description: str | None = None
    layout_config: list[dict[str, Any]]
    cards: list[DashboardCardOut] = Field(default_factory=list)
    is_archived: bool
    created_at: datetime
    updated_at: datetime
