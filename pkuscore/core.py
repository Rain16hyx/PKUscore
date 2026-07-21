"""GPA calculation and input normalization for PKUscore."""

from __future__ import annotations

from typing import Any


def score_to_gpa(score: float) -> float:
    """Convert a percentage score with Peking University's formula."""
    if not 0 <= score <= 100:
        raise ValueError("百分制成绩必须在 0 到 100 之间")
    if score < 60:
        return 0.0
    return 4 - 3 * (100 - score) ** 2 / 1600


def _number(value: Any, field: str, *, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field}必须是数字") from exc
    if not minimum <= number <= maximum:
        raise ValueError(f"{field}必须在 {minimum:g} 到 {maximum:g} 之间")
    return number


def _course(raw: dict[str, Any]) -> dict[str, Any]:
    scheme = raw.get("scheme", "percentage")
    if str(raw.get("score", "")).strip().upper() == "IP":
        scheme = "in_progress"
    if scheme not in {"percentage", "pass_fail", "in_progress"}:
        raise ValueError("计分制只能是百分制、合格制或进行中")
    credits = _number(raw.get("credits", 0), "学分", minimum=0, maximum=30)
    result = {
        "id": str(raw.get("id", "")),
        "name": str(raw.get("name", "")).strip() or "未命名课程",
        "category": str(raw.get("category", "")).strip(),
        "teacher": str(raw.get("teacher", "")).strip(),
        "credits": credits,
        "scheme": scheme,
        "score": raw.get("score", ""),
    }
    if scheme == "in_progress":
        result.update(score="IP", gpa=None, display="IP", included=False)
    elif scheme == "pass_fail":
        score = str(raw.get("score", "P")).strip().upper()
        score = {"合格": "P", "通过": "P", "不合格": "F", "未通过": "F"}.get(score, score)
        if score not in {"P", "F"}:
            raise ValueError(f"《{result['name']}》的合格制成绩应为 P 或 F")
        result.update(score=score, gpa=None, display=score, included=False)
    else:
        score = _number(raw.get("score"), f"《{result['name']}》的成绩", minimum=0, maximum=100)
        gpa = score_to_gpa(score)
        result.update(score=score, gpa=round(gpa, 4), display="F" if score < 60 else f"{gpa:.2f}", included=credits > 0)
    return result


def calculate_record(raw_semesters: list[dict[str, Any]]) -> dict[str, Any]:
    """Normalize a complete record and calculate semester and overall GPA."""
    semesters = []
    total_points = total_credits = 0.0
    for raw_semester in raw_semesters:
        courses = [_course(item) for item in raw_semester.get("courses", [])]
        credits = sum(c["credits"] for c in courses if c["included"])
        points = sum(c["credits"] * c["gpa"] for c in courses if c["included"])
        semester_gpa = points / credits if credits else None
        semesters.append({
            "id": str(raw_semester.get("id", "")),
            "name": str(raw_semester.get("name", "")).strip() or "未命名学期",
            "courses": courses,
            "gpa": round(semester_gpa, 4) if semester_gpa is not None else None,
            "gpa_credits": round(credits, 2),
            "total_credits": round(sum(c["credits"] for c in courses), 2),
        })
        total_points += points
        total_credits += credits
    overall = total_points / total_credits if total_credits else None
    return {
        "semesters": semesters,
        "overall_gpa": round(overall, 4) if overall is not None else None,
        "gpa_credits": round(total_credits, 2),
        "total_credits": round(sum(s["total_credits"] for s in semesters), 2),
    }
