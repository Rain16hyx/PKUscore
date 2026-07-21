import unittest

from pkuscore import calculate_record, parse_portal_html, score_to_gpa


class CalculationTests(unittest.TestCase):
    def test_formula_boundaries(self):
        self.assertEqual(score_to_gpa(59), 0)
        self.assertEqual(score_to_gpa(60), 1)
        self.assertEqual(score_to_gpa(100), 4)

    def test_weighted_gpa_excludes_pass_fail(self):
        result = calculate_record([{"name": "测试学期", "courses": [
            {"name": "甲", "credits": 2, "scheme": "percentage", "score": 100},
            {"name": "乙", "credits": 1, "scheme": "percentage", "score": 60},
            {"name": "丙", "credits": 3, "scheme": "pass_fail", "score": "P"},
        ]}])
        self.assertAlmostEqual(result["overall_gpa"], 3.0)
        self.assertEqual(result["gpa_credits"], 3)
        self.assertEqual(result["total_credits"], 6)

    def test_invalid_score_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "0 到 100"):
            calculate_record([{"courses": [{"name": "甲", "credits": 2, "score": 101}]}])

    def test_in_progress_course_is_excluded_from_gpa(self):
        result = calculate_record([{"name": "测试学期", "courses": [
            {"name": "已结课", "credits": 2, "scheme": "percentage", "score": 100},
            {"name": "未结课", "credits": 4, "scheme": "percentage", "score": "IP"},
        ]}])
        semester = result["semesters"][0]
        self.assertEqual(result["overall_gpa"], 4)
        self.assertEqual(result["gpa_credits"], 2)
        self.assertEqual(result["total_credits"], 6)
        self.assertEqual(semester["courses"][1]["display"], "IP")
        self.assertFalse(semester["courses"][1]["included"])


class ImportTests(unittest.TestCase):
    SAMPLE = """
    <div class="semester-block">
      <div><div class="layout-vertical-up">25-26学年度2学期</div></div>
      <div class="course-row"><div class="layout-row">
        <div class="layout-row-left"><div class="layout-vertical-up">2</div></div>
        <div class="layout-row-middle">
          <div class="layout-vertical-up"><span><span class="course-badge"></span>测试课程</span></div>
          <div class="layout-vertical-down">专业必修</div>
          <div><p><b>成绩记录方式：</b><span>百分制</span></p>
          <p><b>教师信息：</b><span>123-张老师$院系$教授</span></p></div>
        </div>
        <div class="layout-row-right"><div class="layout-vertical-up">88.5</div></div>
      </div></div>
    </div>
    """

    def test_portal_html_import(self):
        semesters = parse_portal_html(self.SAMPLE)
        self.assertEqual(semesters[0]["name"], "25-26学年度2学期")
        course = semesters[0]["courses"][0]
        self.assertEqual(course["name"], "测试课程")
        self.assertEqual(course["teacher"], "张老师")
        self.assertEqual(course["score"], 88.5)

    def test_portal_html_import_accepts_ip(self):
        source = self.SAMPLE.replace("88.5", "IP")
        course = parse_portal_html(source)[0]["courses"][0]
        self.assertEqual(course["scheme"], "in_progress")
        self.assertEqual(course["score"], "IP")


if __name__ == "__main__":
    unittest.main()
