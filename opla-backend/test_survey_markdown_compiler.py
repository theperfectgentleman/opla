"""Unit tests for survey markdown → FormBlueprint compiler."""

from __future__ import annotations

import unittest

from app.services.survey_markdown_compiler import (
    SurveyMarkdownCompileError,
    compile_survey_markdown,
)

SAMPLE_MARKDOWN = """
# School Experience Survey

## routing: Routing & Identity
Goal: Initial branching

### respondent_type. Respondent Type
- type: radio
- required: true
- options:
  - Student | student | -> students
  - Parent/Guardian | parent | -> parents
  - Staff Member | staff | -> staff

## students: Student Experience
Goal: Student path

### grade_level. Grade Level
- type: dropdown
- required: true
- options:
  - 9th | 9th
  - 10th | 10th
  - 11th | 11th
  - 12th | 12th

### extracurricular. Extracurricular Participation
- type: yes_no
- required: true

### interests. Specific Interests
- type: checkbox
- required: false
- options:
  - Debate | debate
  - Football | football
  - Coding Club | coding_club

### satisfaction. Program Satisfaction
- type: rating
- required: false
- min: 1
- max: 5
- min_label: Very Dissatisfied
- max_label: Very Satisfied

## parents: Parent Feedback

### facility_notes. Facility notes
- type: textarea
- required: false
- maxLength: 500

## staff: Staff Admin

### years_experience. Experience Level
- type: number
- required: true
- min: 0
- max: 50

### enroll_date. Future Enrollment Date
- type: date
- required: false

### contact_email. Contact Email
- type: email
- required: false

### contact_phone. Contact Phone
- type: phone
- required: false

### matrix_q. Facility Rating Matrix
- type: matrix
""".strip()


class SurveyMarkdownCompilerTests(unittest.TestCase):
    def test_compiles_sample_survey(self):
        result = compile_survey_markdown(SAMPLE_MARKDOWN)
        self.assertEqual(result.title, "School Experience Survey")
        self.assertEqual(len(result.blueprint["ui"]), 4)

        routing = result.blueprint["ui"][0]
        self.assertEqual(routing["id"], "routing")
        self.assertEqual(routing["children"][0]["type"], "radio_group")
        opts = routing["children"][0]["options"]
        self.assertEqual(opts[0]["value"], "student")
        self.assertEqual(opts[0]["skip_to"], "students")
        self.assertEqual(opts[1]["skip_to"], "parents")

        students = result.blueprint["ui"][1]
        binds = [c["bind"] for c in students["children"]]
        self.assertIn("grade_level", binds)
        self.assertIn("satisfaction", binds)

        rating = next(c for c in students["children"] if c["bind"] == "satisfaction")
        self.assertEqual(rating["type"], "rating_scale")
        self.assertEqual(rating["min"], 1)
        self.assertEqual(rating["max"], 5)
        self.assertEqual(rating["min_label"], "Very Dissatisfied")

        schema_keys = {s["key"] for s in result.blueprint["schema"]}
        self.assertIn("respondent_type", schema_keys)
        self.assertIn("interests", schema_keys)
        interest_schema = next(s for s in result.blueprint["schema"] if s["key"] == "interests")
        self.assertEqual(interest_schema["type"], "array")

        self.assertTrue(any("matrix" in w.lower() for w in result.warnings))
        self.assertEqual(result.blueprint["rules"], [])
        self.assertEqual(result.blueprint["logic"], [])

    def test_missing_title_raises(self):
        with self.assertRaises(SurveyMarkdownCompileError) as ctx:
            compile_survey_markdown("## only_section: Sec\n### q. Q\n- type: text\n")
        self.assertIn("title", str(ctx.exception).lower())

    def test_missing_type_raises_with_line(self):
        md = "# T\n## s: S\n### q. Question?\n- required: true\n"
        with self.assertRaises(SurveyMarkdownCompileError) as ctx:
            compile_survey_markdown(md)
        self.assertIsNotNone(ctx.exception.line)
        self.assertIn("type", str(ctx.exception).lower())

    def test_radio_without_options_raises(self):
        md = "# T\n## s: S\n### q. Question?\n- type: radio\n- required: true\n"
        with self.assertRaises(SurveyMarkdownCompileError) as ctx:
            compile_survey_markdown(md)
        self.assertIn("options", str(ctx.exception).lower())

    def test_bad_option_line_raises(self):
        md = "# T\n## s: S\n### q. Question?\n- type: radio\n- options:\n  - |||\n"
        with self.assertRaises(SurveyMarkdownCompileError):
            compile_survey_markdown(md)

    def test_empty_markdown_raises(self):
        with self.assertRaises(SurveyMarkdownCompileError):
            compile_survey_markdown("   ")


if __name__ == "__main__":
    unittest.main()
