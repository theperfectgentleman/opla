from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

FIXTURE_CODES = (
    "unparseable",
    "unparseable_query",
    "walker_not_supported",
    "markdown_not_a_question",
    "missing_project",
    "viz_query_mismatch",
    "empty",
)


@dataclass(frozen=True)
class ParseOk:
    ok: bool = True
    value: Any = None


@dataclass(frozen=True)
class ParseErr:
    ok: bool = False
    error: str = ""
    code: str = "unparseable"


ParseResult = ParseOk | ParseErr


def ok(value: Any) -> ParseOk:
    return ParseOk(value=value)


def fail(code: str, error: str) -> ParseErr:
    return ParseErr(code=code, error=error)


def _is_record(value: Any) -> bool:
    return isinstance(value, dict)


def _uuid(raw: Any, label: str) -> ParseResult:
    if not isinstance(raw, str) or not raw.strip():
        return fail("unparseable", f"{label} is required")
    try:
        return ok(str(UUID(raw.strip())))
    except ValueError:
        return fail("unparseable", f"{label} is not a uuid")


def _non_empty_str(raw: Any, label: str) -> ParseResult:
    if not isinstance(raw, str) or not raw.strip():
        return fail("empty", f"{label} is empty")
    return ok(raw.strip())


def parse_query(raw: Any, table_id: str | None = None) -> ParseResult:
    if not _is_record(raw):
        return fail("unparseable_query", "query is not an object")
    if "select" in raw and any(key in raw for key in ("measures", "groupBy", "group_by")):
        return fail("unparseable_query", "rows select cannot mix with summary measures")
    if raw.get("version") == 2:
        return _parse_query_v2(raw, table_id)
    if table_id is None:
        return fail("unparseable_query", "table id is required to upgrade v1")
    return upgrade_query_config_v1(raw, table_id)


def _parse_query_v2(raw: dict[str, Any], table_id: str | None) -> ParseResult:
    table_raw = raw.get("table", table_id)
    table = _uuid(table_raw, "table")
    if not table.ok:
        return table
    limit = raw.get("limit", 500)
    if not isinstance(limit, int) or limit < 1 or limit > 10000:
        return fail("unparseable", "limit must be an integer from 1 to 10000")
    order_by = _parse_order_list(raw.get("orderBy", raw.get("order_by")))
    if not order_by.ok:
        return order_by
    where = _parse_filters(raw.get("where"))
    if not where.ok:
        return where

    kind = raw.get("kind")
    if kind == "rows":
        select = raw.get("select")
        if not isinstance(select, list) or not select:
            return fail("unparseable_query", "rows query needs select")
        query: dict[str, Any] = {
            "version": 2,
            "kind": "rows",
            "table": table.value,
            "select": select,
            "orderBy": order_by.value,
            "limit": limit,
            "offset": raw.get("offset", 0) if isinstance(raw.get("offset", 0), int) else 0,
        }
        if where.value:
            query["where"] = where.value
        return ok(query)

    if kind == "summary":
        measures = raw.get("measures")
        if not isinstance(measures, list) or not measures:
            return fail("unparseable_query", "summary query needs measures")
        query = {
            "version": 2,
            "kind": "summary",
            "table": table.value,
            "dimensions": raw.get("dimensions") or [],
            "measures": measures,
            "orderBy": order_by.value,
            "limit": limit,
        }
        if where.value:
            query["where"] = where.value
        return ok(query)

    return fail("unparseable_query", "query.kind must be rows or summary")


def upgrade_query_config_v1(raw: dict[str, Any], table_id: str) -> ParseResult:
    group_by = raw.get("group_by") or raw.get("groupBy") or []
    aggregates = raw.get("aggregates") or raw.get("measures") or []
    select_fields = raw.get("select_fields") or raw.get("select") or []
    where = _parse_filters(raw.get("filters") or raw.get("where"))
    if not where.ok:
        return where
    order_by = _parse_order_list(raw.get("order_by") or raw.get("orderBy"))
    if not order_by.ok:
        return order_by
    limit = raw.get("limit", 500)
    if not isinstance(limit, int) or limit < 1 or limit > 10000:
        return fail("unparseable", "limit must be an integer from 1 to 10000")

    has_groups = isinstance(group_by, list) and len(group_by) > 0
    has_aggregates = isinstance(aggregates, list) and len(aggregates) > 0
    if has_groups or has_aggregates:
        measures = []
        for index, item in enumerate(aggregates if isinstance(aggregates, list) else []):
            if not _is_record(item):
                return fail("unparseable_query", "aggregate is not an object")
            fn = item.get("fn")
            alias = item.get("alias") or f"{fn}_{index}"
            if fn in ("count", "count_rows"):
                measures.append({"kind": "measure", "fn": "count_rows", "alias": alias})
            elif fn in ("count_distinct", "sum", "avg", "min", "max"):
                field = item.get("field")
                if not isinstance(field, str) or not field:
                    return fail("unparseable_query", "aggregate is missing field")
                measures.append({"kind": "measure", "fn": fn, "field": field, "alias": alias})
            else:
                return fail("unparseable_query", f"unsupported aggregate {fn}")
        if not measures:
            return fail("empty", "aggregates is empty")
        dimensions = []
        for item in group_by if isinstance(group_by, list) else []:
            if isinstance(item, str):
                dimensions.append({"kind": "field", "field": item})
            elif _is_record(item) and item.get("field"):
                dim: dict[str, Any] = {"kind": "field", "field": item["field"]}
                if item.get("bucket"):
                    dim = {"kind": "time", "field": item["field"], "bucket": item["bucket"]}
                dimensions.append(dim)
        query: dict[str, Any] = {
            "version": 2,
            "kind": "summary",
            "table": table_id,
            "dimensions": dimensions,
            "measures": measures,
            "orderBy": order_by.value,
            "limit": limit,
        }
        if where.value:
            query["where"] = where.value
        return ok(query)

    if not isinstance(select_fields, list) or not select_fields:
        return fail("empty", "select_fields is empty")
    select = []
    for item in select_fields:
        if isinstance(item, str):
            select.append({"kind": "field", "field": item})
        elif _is_record(item) and item.get("field"):
            select.append({"kind": "field", "field": item["field"]})
        else:
            return fail("unparseable_query", "select item is invalid")
    query = {
        "version": 2,
        "kind": "rows",
        "table": table_id,
        "select": select,
        "orderBy": order_by.value,
        "limit": limit,
        "offset": raw.get("offset", 0) if isinstance(raw.get("offset", 0), int) else 0,
    }
    if where.value:
        query["where"] = where.value
    return ok(query)


def _parse_order_list(raw: Any) -> ParseResult:
    if raw is None:
        return ok([])
    if not isinstance(raw, list):
        return fail("unparseable_query", "order_by must be an array")
    orders = []
    for item in raw:
        if not _is_record(item) or not isinstance(item.get("field"), str):
            return fail("unparseable_query", "order_by item is invalid")
        orders.append({"field": item["field"], "direction": "desc" if item.get("direction") == "desc" else "asc"})
    return ok(orders)


def _parse_filters(raw: Any) -> ParseResult:
    if raw is None or raw == {}:
        return ok(None)
    if not _is_record(raw):
        return fail("unparseable_query", "filters are not an object")
    rules = raw.get("rules")
    if not isinstance(rules, list):
        if raw.get("kind"):
            return ok(raw)
        return fail("unparseable_query", "filters.rules must be an array")
    if not rules:
        return ok(None)
    return ok(raw)


def parse_legacy_question(payload: Any) -> ParseResult:
    if not _is_record(payload):
        return fail("unparseable", "question is not an object")
    viz_type = payload.get("viz_type")
    if viz_type == "walker":
        return fail("walker_not_supported", "Walker is a scratchpad, not a saved viz")
    if viz_type == "markdown":
        return fail("markdown_not_a_question", "markdown is a board tile, not a question")

    question_id = _uuid(payload.get("id"), "question id")
    if not question_id.ok:
        return question_id
    project_raw = payload.get("project_id", payload.get("projectId"))
    if not isinstance(project_raw, str):
        return fail("missing_project", "saved questions need a project")
    project_id = _uuid(project_raw, "project id")
    if not project_id.ok:
        return project_id
    title = _non_empty_str(payload.get("title"), "title")
    if not title.ok:
        return title

    query_obj = payload.get("query")
    if _is_record(query_obj) and query_obj.get("version") == 2:
        query = parse_query(query_obj, query_obj.get("table"))
        if not query.ok:
            return query
        viz = payload.get("viz") if _is_record(payload.get("viz")) else None
        if viz is None:
            return fail("unparseable", "viz is required")
        return ok(
            {
                "id": question_id.value,
                "projectId": project_id.value,
                "title": title.value,
                "query": query.value,
                "viz": viz,
            }
        )

    source = payload.get("source_config") or payload.get("source")
    if not _is_record(source):
        return fail("unparseable", "source_config is not an object")
    table = _uuid(source.get("dataset_id") or source.get("table") or source.get("table_id"), "dataset_id")
    if not table.ok:
        return table
    query = parse_query(payload.get("query_config") or payload.get("query"), table.value)
    if not query.ok:
        return query
    viz = upgrade_viz_config(viz_type, payload.get("viz_config") or payload.get("viz"), query.value)
    if not viz.ok:
        return viz
    return ok(
        {
            "id": question_id.value,
            "projectId": project_id.value,
            "title": title.value,
            "query": query.value,
            "viz": viz.value,
        }
    )


def upgrade_viz_config(viz_type: Any, viz_config: Any, query: dict[str, Any]) -> ParseResult:
    if viz_type == "walker":
        return fail("walker_not_supported", "Walker is a scratchpad, not a saved viz")
    if viz_type == "markdown":
        return fail("markdown_not_a_question", "markdown is a board tile, not a question")
    if viz_type == "goal":
        return fail("unparseable", "goal is not a viz on the question contract")
    config = viz_config if _is_record(viz_config) else {}

    if viz_type == "kpi":
        if query.get("kind") != "summary":
            return fail("viz_query_mismatch", "kpi needs a summary query")
        return ok({"kind": "kpi", "value": query["measures"][0]["alias"]})

    if viz_type == "chart":
        mark = config.get("chart_type") or config.get("mark") or "bar"
        if mark == "column":
            mark = "bar"
        if query.get("kind") != "summary":
            return fail("viz_query_mismatch", "bar, line, and pie charts need a summary")
        x = config.get("category_field") or config.get("x")
        if not x:
            dims = query.get("dimensions") or []
            if not dims:
                return fail("viz_query_mismatch", "chart needs a dimension")
            x = dims[0]["field"]
        y = config.get("y") or config.get("metric_alias") or query["measures"][0]["alias"]
        viz: dict[str, Any] = {"kind": "chart", "mark": mark, "x": x, "y": y}
        series = config.get("series_field") or config.get("series")
        if series:
            viz["series"] = series
        return ok(viz)

    if viz_type == "map":
        point = config.get("point") or config.get("location")
        if not isinstance(point, str):
            return fail("unparseable", "map viz needs a point field")
        return ok({"kind": "map", "point": point})

    if query.get("kind") == "rows":
        columns = [item["field"] if item.get("kind") == "field" else item.get("alias") for item in query.get("select") or []]
    else:
        columns = [item["field"] for item in query.get("dimensions") or []] + [
            item["alias"] for item in query.get("measures") or []
        ]
    if not columns:
        return fail("empty", "table columns is empty")
    return ok({"kind": "table", "columns": columns})


def query_to_engine_args(query: dict[str, Any]) -> dict[str, Any]:
    """Map Query v2 onto the existing execute_query kwargs."""
    table = UUID(str(query["table"]))
    filters = query.get("where")
    order_by = list(query.get("orderBy") or [])
    limit = int(query.get("limit") or 500)
    if query["kind"] == "rows":
        select_fields = []
        for item in query.get("select") or []:
            if item.get("kind") == "field":
                select_fields.append(item["field"])
            else:
                select_fields.append(item["alias"])
        return {
            "dataset_id": table,
            "select_fields": select_fields,
            "filters": filters,
            "group_by": [],
            "aggregates": [],
            "order_by": order_by,
            "limit": limit,
            "offset": int(query.get("offset") or 0),
            "calculated_fields": [],
        }

    group_by: list[Any] = []
    for dim in query.get("dimensions") or []:
        if dim.get("kind") == "time":
            group_by.append({"field": dim["field"], "bucket": dim["bucket"]})
        else:
            group_by.append(dim["field"])
    aggregates = []
    for measure in query.get("measures") or []:
        fn = measure.get("fn")
        alias = measure.get("alias")
        if fn == "count_rows":
            aggregates.append({"field": "_submission_id", "fn": "count", "alias": alias})
        else:
            aggregates.append({"field": measure["field"], "fn": fn, "alias": alias})
    return {
        "dataset_id": table,
        "select_fields": [],
        "filters": filters,
        "group_by": group_by,
        "aggregates": aggregates,
        "order_by": order_by,
        "limit": limit,
        "offset": 0,
        "calculated_fields": [],
    }
