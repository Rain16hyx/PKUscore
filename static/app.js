"use strict";

const STORAGE_KEY = "pkscore-record-v1";
const THEME_KEY = "pkscore-theme";
const IMPORT_KEY = "pkscore-portal-import-v1";
const state = { semesters: loadRecord(), calculation: null };
const $ = (selector, root = document) => root.querySelector(selector);
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

function loadRecord() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function saveRecord() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.semesters));
}

function loadImportRecord() {
  try {
    const value = JSON.parse(localStorage.getItem(IMPORT_KEY));
    return {
      courseIds: Array.isArray(value?.courseIds) ? value.courseIds : [],
      semesterIds: Array.isArray(value?.semesterIds) ? value.semesterIds : [],
    };
  } catch { return {courseIds: [], semesterIds: []}; }
}

function removePreviousImport() {
  const record = loadImportRecord();
  const trackedCourses = new Set(record.courseIds);
  const trackedSemesters = new Set(record.semesterIds);
  const hasTracking = trackedCourses.size > 0 || trackedSemesters.size > 0;
  const legacyPortalId = id => /^[0-9a-f]{32}$/i.test(String(id || ""));

  state.semesters = state.semesters
    .map(semester => ({
      ...semester,
      courses: semester.courses.filter(course => {
        if (trackedCourses.has(course.id) || course.source === "portal") return false;
        return hasTracking || !legacyPortalId(course.id);
      }),
    }))
    .filter(semester => {
      if (semester.courses.length > 0) return true;
      if (trackedSemesters.has(semester.id) || semester.source === "portal") return false;
      return hasTracking || !legacyPortalId(semester.id);
    });
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"})[char]);
}

async function api(path, data) {
  const response = await fetch(path, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)});
  const result = await response.json().catch(() => ({error:"服务器返回了无法识别的内容"}));
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
}

function displayNumber(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function courseColor(course) {
  if (course.scheme === "in_progress") return "#d7e3e7";
  if (course.scheme === "pass_fail") return course.score === "P" ? "#addbc2" : "#e4a3a0";
  // 常见成绩集中在 70–100 分，因此在这一区间设置更密集的色阶。
  const stops = [
    [0,   [204, 91, 88]],
    [60,  [232, 116, 91]],
    [70,  [244, 148, 98]],
    [75,  [247, 199, 104]],
    [80,  [242, 229, 111]],
    [85,  [216, 239, 113]],
    [90,  [181, 232, 108]],
    [95,  [143, 218, 104]],
    [100, [105, 198, 96]],
  ];
  const score = Math.max(0, Math.min(100, Number(course.score)));
  const upperIndex = stops.findIndex(([boundary]) => score <= boundary);
  if (upperIndex <= 0) return `rgb(${stops[0][1].join(", ")})`;
  const [lowScore, lowColor] = stops[upperIndex - 1];
  const [highScore, highColor] = stops[upperIndex];
  const ratio = (score - lowScore) / (highScore - lowScore);
  const color = lowColor.map((channel, index) => Math.round(channel + (highColor[index] - channel) * ratio));
  return `rgb(${color.join(", ")})`;
}

function render() {
  const list = $("#semesterList");
  $("#emptyState").classList.toggle("hidden", state.semesters.length > 0);
  $(".add-semester-button").classList.toggle("hidden", state.semesters.length === 0);
  list.innerHTML = state.semesters.map(semester => `
    <section class="semester" data-semester-id="${esc(semester.id)}">
      <header class="semester-head">
        <div class="semester-title">
          <input aria-label="学期名称" maxlength="50" data-field="semester-name" value="${esc(semester.name)}">
          <div class="semester-meta" data-role="semester-meta">${semester.courses.length} 门课程</div>
        </div>
        <div class="semester-gpa"><span>学期 GPA</span><strong data-role="semester-gpa">—</strong></div>
        <button class="more-button" data-action="delete-semester" title="删除学期" aria-label="删除学期">×</button>
      </header>
      <div class="course-grid">
        ${semester.courses.map(course => courseTemplate(semester.id, course)).join("")}
        <button class="add-course" data-action="add-course"><span>＋</span>添加课程</button>
      </div>
    </section>`).join("");
  calculate();
}

function courseTemplate(semesterId, course) {
  const schemeLabel = {percentage: "百分制", pass_fail: "合格制", in_progress: "进行中"}[course.scheme] || "百分制";
  const rawScore = course.scheme === "in_progress" ? "IP" : course.score;
  return `<article class="course-card" tabindex="0" role="button" aria-label="编辑 ${esc(course.name)}" data-action="edit-course" data-course-id="${esc(course.id)}" data-semester-id="${esc(semesterId)}">
    <div class="credit-block"><strong>${Number(course.credits).toLocaleString("zh-CN")}</strong><span>学分</span></div>
    <div class="course-info"><h3>${esc(course.name)}</h3><p>${esc([course.category, course.teacher, schemeLabel].filter(Boolean).join(" · "))}</p></div>
    <div class="score-block"><strong class="score">${esc(rawScore)}</strong><span>绩点 <b data-role="course-gpa">—</b></span></div>
  </article>`;
}

let calculationToken = 0;
async function calculate() {
  const token = ++calculationToken;
  try {
    const result = await api("/api/calculate", {semesters: state.semesters});
    if (token !== calculationToken) return;
    state.calculation = result;
    $("#overallGpa").textContent = displayNumber(result.overall_gpa);
    $("#overallMeta").textContent = result.gpa_credits ? `${result.gpa_credits} 计绩学分 · ${result.total_credits} 总学分` : "暂无计入课程";
    for (const semester of result.semesters) {
      const section = document.querySelector(`[data-semester-id="${CSS.escape(semester.id)}"].semester`);
      if (!section) continue;
      $("[data-role=semester-gpa]", section).textContent = displayNumber(semester.gpa);
      $("[data-role=semester-meta]", section).textContent = `${semester.courses.length} 门课程 · ${semester.gpa_credits} 计绩学分 / ${semester.total_credits} 总学分`;
      for (const course of semester.courses) {
        const card = section.querySelector(`[data-course-id="${CSS.escape(course.id)}"]`);
        if (!card) continue;
        card.style.setProperty("--course-color", courseColor(course));
        $("[data-role=course-gpa]", card).textContent = course.display;
      }
    }
  } catch (error) { toast(error.message, true); }
}

function addSemester() {
  const index = state.semesters.length + 1;
  state.semesters.push({id:uid(), name:`第 ${index} 学期`, courses:[]});
  saveRecord(); render();
  const inputs = document.querySelectorAll('[data-field="semester-name"]');
  inputs[inputs.length - 1]?.select();
}

function openCourseDialog(semesterId, courseId = "") {
  const form = $("#courseForm");
  form.reset();
  form.elements.semesterId.value = semesterId;
  form.elements.courseId.value = courseId;
  const semester = state.semesters.find(item => item.id === semesterId);
  const course = semester?.courses.find(item => item.id === courseId);
  $("#courseDialogTitle").textContent = course ? "编辑课程" : "添加课程";
  $("#deleteCourse").classList.toggle("hidden", !course);
  if (course) {
    for (const field of ["name", "category", "teacher", "credits", "scheme"]) form.elements[field].value = course[field];
    if (course.scheme === "pass_fail") form.elements.pfScore.value = course.score;
    else if (course.scheme === "percentage") form.elements.score.value = course.score;
  }
  toggleScoreField();
  $("#courseDialog").showModal();
  setTimeout(() => form.elements.name.focus(), 0);
}

function toggleScoreField() {
  const scheme = $("#courseForm").elements.scheme.value;
  $("#scoreField").classList.toggle("hidden", scheme !== "percentage");
  $("#pfField").classList.toggle("hidden", scheme !== "pass_fail");
  $("#courseForm").elements.score.required = scheme === "percentage";
}

function saveCourse(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const semester = state.semesters.find(item => item.id === form.elements.semesterId.value);
  if (!semester) return;
  const scheme = form.elements.scheme.value;
  const data = {
    id: form.elements.courseId.value || uid(), name:form.elements.name.value.trim(),
    category:form.elements.category.value.trim(), teacher:form.elements.teacher.value.trim(),
    credits:Number(form.elements.credits.value), scheme,
    score: scheme === "pass_fail" ? form.elements.pfScore.value : (scheme === "in_progress" ? "IP" : Number(form.elements.score.value))
  };
  const index = semester.courses.findIndex(item => item.id === data.id);
  if (index >= 0) semester.courses[index] = data; else semester.courses.push(data);
  saveRecord(); $("#courseDialog").close(); render(); toast(index >= 0 ? "课程已更新" : "课程已添加");
}

function deleteSemester(id) {
  const semester = state.semesters.find(item => item.id === id);
  if (!semester || !confirm(`删除“${semester.name}”及其中 ${semester.courses.length} 门课程？此操作无法撤销。`)) return;
  state.semesters = state.semesters.filter(item => item.id !== id);
  saveRecord(); render(); toast("学期已删除");
}

function deleteCourse() {
  const form = $("#courseForm");
  const semester = state.semesters.find(item => item.id === form.elements.semesterId.value);
  const course = semester?.courses.find(item => item.id === form.elements.courseId.value);
  if (!course || !confirm(`删除课程“${course.name}”？此操作无法撤销。`)) return;
  semester.courses = semester.courses.filter(item => item.id !== course.id);
  saveRecord(); $("#courseDialog").close(); render(); toast("课程已删除");
}

async function runImport(event) {
  event.preventDefault();
  const source = $("#htmlSource").value.trim();
  if (!source) { $("#importError").textContent = "请先粘贴 HTML 源码。"; return; }
  const button = $("#runImport");
  button.disabled = true; button.textContent = "正在识别…"; $("#importError").textContent = "";
  try {
    const result = await api("/api/import", {html:source});
    removePreviousImport();
    const importedCourseIds = [];
    const createdSemesterIds = [];
    for (const incoming of result.semesters) {
      const existing = state.semesters.find(item => item.name === incoming.name);
      importedCourseIds.push(...incoming.courses.map(course => course.id));
      if (existing) {
        existing.courses.push(...incoming.courses);
      } else {
        state.semesters.push(incoming);
        createdSemesterIds.push(incoming.id);
      }
    }
    localStorage.setItem(IMPORT_KEY, JSON.stringify({courseIds: importedCourseIds, semesterIds: createdSemesterIds}));
    saveRecord(); $("#importDialog").close(); $("#htmlSource").value = ""; render();
    toast(`成功导入 ${result.semesters.length} 个学期、${result.count} 门课程`);
  } catch (error) { $("#importError").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "识别并导入"; }
}

let toastTimer;
function toast(message, isError = false) {
  const node = $("#toast"); node.textContent = message; node.style.background = isError ? "var(--danger)" : "var(--text)"; node.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("show"), 2800);
}

function openImport() { $("#importError").textContent = ""; $("#importDialog").showModal(); }

document.addEventListener("click", event => {
  const close = event.target.closest("[data-close]");
  if (close) { document.getElementById(close.dataset.close).close(); return; }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "add-semester") addSemester();
  if (action === "add-course") openCourseDialog(target.closest(".semester").dataset.semesterId);
  if (action === "edit-course") openCourseDialog(target.dataset.semesterId, target.dataset.courseId);
  if (action === "delete-semester") deleteSemester(target.closest(".semester").dataset.semesterId);
});
document.addEventListener("keydown", event => {
  const card = event.target.closest?.('[data-action="edit-course"]');
  if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openCourseDialog(card.dataset.semesterId, card.dataset.courseId); }
});
document.addEventListener("change", event => {
  if (event.target.matches('[data-field="semester-name"]')) {
    const semester = state.semesters.find(item => item.id === event.target.closest(".semester").dataset.semesterId);
    if (semester) { semester.name = event.target.value.trim() || "未命名学期"; event.target.value = semester.name; saveRecord(); }
  }
});
$("#courseForm").addEventListener("submit", saveCourse);
$("#deleteCourse").addEventListener("click", deleteCourse);
$("#courseForm").elements.scheme.addEventListener("change", toggleScoreField);
$("#importForm").addEventListener("submit", runImport);
$("#importButton").addEventListener("click", openImport);
$("#emptyImport").addEventListener("click", openImport);
$("#themeButton").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme);
});

const savedTheme = localStorage.getItem(THEME_KEY);
document.documentElement.dataset.theme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
render();
