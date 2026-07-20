"""Parser for the grade page HTML copied from the PKU Treehole portal."""

from __future__ import annotations

from html.parser import HTMLParser
from typing import Iterable
from uuid import uuid4


class Node:
    def __init__(self, tag: str = "root", attrs: dict[str, str] | None = None):
        self.tag, self.attrs = tag, attrs or {}
        self.children: list[Node] = []
        self.parts: list[str] = []

    @property
    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())

    def walk(self) -> Iterable[Node]:
        yield self
        for child in self.children:
            yield from child.walk()

    def first(self, class_name: str) -> Node | None:
        return next((node for node in self.walk() if class_name in node.classes), None)


class TreeParser(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, dict(attrs)))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data):
        if data.strip():
            for node in self.stack:
                node.parts.append(data)


def _direct_course_rows(block: Node) -> list[Node]:
    return [node for node in block.children if "course-row" in node.classes]


def _teacher(raw: str) -> str:
    names = []
    for teacher in raw.split(","):
        head = teacher.strip().split("$", 1)[0]
        names.append(head.split("-", 1)[-1])
    return "、".join(name for name in names if name)


def parse_portal_html(source: str) -> list[dict]:
    if not isinstance(source, str) or "semester-block" not in source:
        raise ValueError("未找到成绩数据，请确认复制的是成绩查询页中包含 semester-block 的 HTML")
    parser = TreeParser()
    parser.feed(source)
    semesters = []
    blocks = [node for node in parser.root.walk() if "semester-block" in node.classes]
    for block in blocks:
        rows = _direct_course_rows(block)
        if not rows:
            continue
        header = next((child for child in block.children if "course-row" not in child.classes), None)
        name_node = header.first("layout-vertical-up") if header else None
        name = name_node.text() if name_node else f"第 {len(semesters) + 1} 学期"
        courses = []
        for row in rows:
            left = row.first("layout-row-left")
            middle = row.first("layout-row-middle")
            right = row.first("layout-row-right")
            if not (left and middle and right):
                continue
            credit_node = left.first("layout-vertical-up")
            grade_node = right.first("layout-vertical-up")
            title_node = middle.first("layout-vertical-up")
            category_node = middle.first("layout-vertical-down")
            if not (credit_node and grade_node and title_node):
                continue
            details = {}
            for p in (node for node in middle.walk() if node.tag == "p"):
                label = next((n.text().rstrip("：:") for n in p.children if n.tag == "b"), "")
                value = next((n.text() for n in p.children if n.tag == "span"), "")
                if label:
                    details[label] = value
            record_method = details.get("成绩记录方式", "")
            grade = grade_node.text()
            is_pf = record_method == "合格制" or grade in {"合格", "不合格", "P", "F"}
            try:
                credits = float(credit_node.text())
                score = ({"合格": "P", "不合格": "F"}.get(grade, grade) if is_pf else float(grade))
            except ValueError as exc:
                raise ValueError(f"无法识别《{title_node.text()}》的学分或成绩") from exc
            courses.append({
                "id": uuid4().hex,
                "name": title_node.text(),
                "category": category_node.text() if category_node else details.get("课程体系", ""),
                "teacher": _teacher(details.get("教师信息", "")),
                "credits": credits,
                "scheme": "pass_fail" if is_pf else "percentage",
                "score": score,
            })
        semesters.append({"id": uuid4().hex, "name": name, "courses": courses})
    if not semesters:
        raise ValueError("识别到了页面结构，但没有找到课程；请复制完整的成绩查询页 HTML")
    return semesters
