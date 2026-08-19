from __future__ import annotations

import json
import unittest
from pathlib import Path

from app.analytics_domain.parse import parse_legacy_question, parse_query, query_to_engine_args

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = (
    ROOT
    / "opla-frontend"
    / "packages"
    / "analytics-domain"
    / "test"
    / "fixtures"
    / "legacy-saved-questions"
)


def load(name: str) -> object:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


class AnalyticsDomainParseTests(unittest.TestCase):
    def test_rejects_walker(self) -> None:
        parsed = parse_legacy_question(load("walker.json"))
        self.assertFalse(parsed.ok)
        self.assertEqual(parsed.code, "walker_not_supported")

    def test_rejects_markdown(self) -> None:
        parsed = parse_legacy_question(load("markdown.json"))
        self.assertFalse(parsed.ok)
        self.assertEqual(parsed.code, "markdown_not_a_question")

    def test_rejects_mixed_rows_and_summary(self) -> None:
        parsed = parse_legacy_question(load("mixed-rows-summary.json"))
        self.assertFalse(parsed.ok)
        self.assertEqual(parsed.code, "unparseable_query")

    def test_upgrades_v1_chart_and_maps_to_engine_args(self) -> None:
        parsed = parse_legacy_question(load("v1-chart.json"))
        self.assertTrue(parsed.ok)
        query = parsed.value["query"]
        self.assertEqual(query["version"], 2)
        self.assertEqual(query["kind"], "summary")
        self.assertEqual(query["measures"][0]["fn"], "count_rows")
        args = query_to_engine_args(query)
        self.assertEqual(str(args["dataset_id"]), query["table"])
        self.assertEqual(args["group_by"], ["district"])
        self.assertEqual(args["aggregates"][0]["fn"], "count")
        self.assertEqual(args["aggregates"][0]["alias"], "count")
        self.assertEqual(args["aggregates"][0]["field"], "_submission_id")

    def test_parse_query_rejects_mixed_select_and_measures(self) -> None:
        table = "33333333-3333-4333-8333-333333333333"
        parsed = parse_query(
            {
                "version": 2,
                "kind": "rows",
                "table": table,
                "select": [{"kind": "field", "field": "district"}],
                "measures": [{"kind": "measure", "fn": "count_rows", "alias": "visits"}],
                "orderBy": [],
                "limit": 500,
                "offset": 0,
            },
            table,
        )
        self.assertFalse(parsed.ok)
        self.assertEqual(parsed.code, "unparseable_query")


if __name__ == "__main__":
    unittest.main()
