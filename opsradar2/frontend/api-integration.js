(function () {
  const API = window.OPSRADAR_API_BASE || "http://127.0.0.1:8000/api/v1";
  const idMap = new Map();
  let nextUiId = 100000;

  function uiId(kind, apiId) {
    const key = `${kind}:${apiId}`;
    if (!idMap.has(key)) idMap.set(key, nextUiId++);
    return idMap.get(key);
  }

  async function request(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.status === 204 ? null : res.json();
  }

  function replaceArray(target, values) {
    if (!Array.isArray(target)) return;
    target.length = 0;
    target.push(...values);
  }

  function apiStatusToUi(status) {
    return {
      pending: "pending",
      approved: "approved",
      in_progress: "approved",
      completed: "done",
      done: "done",
      rejected: "rejected",
      blocked: "approved",
    }[status] || "pending";
  }

  function uiStatusToApi(status) {
    return {
      pending: "pending",
      approved: "in_progress",
      done: "completed",
      rejected: "rejected",
    }[status] || status;
  }

  function normalizeTodo(todo) {
    return {
      id: uiId("todo", todo.id),
      apiId: todo.id,
      title: todo.title || "Untitled",
      src: todo.document_id || null,
      srcChunk: todo.source_chunk_id || null,
      assignee: todo.assignee || null,
      priority: todo.priority || "medium",
      confidence: todo.confidence == null ? null : Number(todo.confidence),
      status: todo.approval_status === "rejected" ? "rejected" : apiStatusToUi(todo.status),
      type: todo.source || "manual",
      chunk: null,
      grounds: [todo.source === "ai" ? "DB AI analysis result" : "DB saved Todo"],
      risk: "",
    };
  }

  function normalizeIssue(issue) {
    const status = issue.status || "open";
    const source = issue.source || "manual";
    return {
      id: uiId("issue", issue.id),
      apiId: issue.id,
      type: status === "resolved" ? "resolved" : source === "ai" ? "candidate" : "confirmed",
      severity: issue.risk_level || "medium",
      status,
      confidence: issue.confidence == null ? null : Number(issue.confidence),
      title: issue.title || "Untitled issue",
      src: issue.document_id || null,
      assignee: issue.assignee || null,
      days: 0,
      desc: issue.description || issue.title || "",
      chunk: "",
      history: [],
      domino: [],
      dominoFinal: "",
      suggestTodo: issue.title ? `${issue.title} follow-up` : null,
      suggestAssignee: issue.assignee || null,
      suggestPriority: issue.risk_level === "high" ? "high" : "medium",
    };
  }

  function calendarClass(type) {
    return {
      deadline: "ct-danger",
      absence: "ct-gray",
      meeting: "ct-success",
      milestone: "ct-info",
    }[type] || "ct-info";
  }

  function calendarTypeFromColor(color) {
    return {
      "ct-danger": "deadline",
      "ct-gray": "absence",
      "ct-success": "meeting",
      "ct-info": "milestone",
    }[color] || "milestone";
  }

  function normalizeCalendarEvent(event) {
    const date = String(event.event_date || "");
    const [year, month, day] = date.split("-").map(Number);
    if (!day) return null;
    return {
      apiId: event.id,
      d: day,
      y: year,
      m: month - 1,
      tags: [{
        apiId: event.id,
        t: event.person ? `${event.person} ${event.title}` : event.title,
        c: calendarClass(event.event_type),
      }],
    };
  }

  function mergeCalendarEvents(events) {
    if (!window.G) return;
    const byDay = new Map();
    events.map(normalizeCalendarEvent).filter(Boolean).forEach((event) => {
      const existing = byDay.get(event.d);
      if (existing) existing.tags.push(...event.tags);
      else byDay.set(event.d, event);
    });
    G.calEvents = Array.from(byDay.values());
  }

  async function loadDashboardFromAPI() {
    const data = await request("/dashboard/summary");
    const rateEl = document.getElementById("db-todo-rate");
    const barEl = document.getElementById("db-todo-bar");
    const blockedEl = document.getElementById("db-blocked");
    const pendingEl = document.getElementById("pendingCount");
    if (rateEl) rateEl.textContent = `${data.done_todos || 0} / ${data.total_todos || 0}`;
    if (barEl) barEl.style.width = `${data.todo_completion_rate || 0}%`;
    if (blockedEl) blockedEl.textContent = `${data.blocked_count || 0} items`;
    if (pendingEl) pendingEl.textContent = data.pending_todos || 0;
  }

  async function loadTodosFromAPI() {
    if (typeof todos === "undefined") return;
    const data = await request("/todos");
    replaceArray(todos, (data.todos || []).map(normalizeTodo));
    if (typeof renderTodos === "function") renderTodos();
    if (typeof updateTodoCounts === "function") updateTodoCounts();
  }

  async function loadIssuesFromAPI() {
    if (typeof issues === "undefined") return;
    const data = await request("/issues");
    replaceArray(issues, (data.issues || []).map(normalizeIssue));
    if (typeof renderIssues === "function") renderIssues();
  }

  async function loadCalendarFromAPI() {
    const data = await request("/calendar");
    mergeCalendarEvents(data.events || []);
    if (typeof renderCalendar === "function") renderCalendar();
  }

  function normalizeReport(report) {
    const type = report.period === "monthly" ? "monthly" : "weekly";
    return {
      id: report.id,
      apiId: report.id,
      type,
      title: type === "monthly" ? "월간 운영 보고서" : "주간 운영 보고서",
      period: `${report.start_date || "-"} ~ ${report.end_date || "-"}`,
      createdAt: report.created_at,
      author: "OpsRadar",
      status: "draft",
      issues: 0,
      doneTodos: 0,
      pendingTodos: 0,
      sections: {
        completed: [report.content || "저장된 보고서 본문이 없습니다."],
        inProgress: [],
        technical: [],
        risk: [],
        retrospective: [],
        nextPlan: [],
      },
      docs: ["DB 저장 보고서"],
      html: report.content || "",
    };
  }

  async function loadReportsFromAPI() {
    if (typeof persistReports !== "function") return;
    const data = await request("/reports");
    const reports = (data.reports || []).map(normalizeReport);
    persistReports(reports);
    if (window.G) G.savedReports = reports;
    if (typeof renderReportList === "function") renderReportList();
  }

  window.opsRadarCreateCalendarEvent = async function ({ title, day, month, year, color }) {
    const target = new Date(
      year ?? window.G?.currentCalYear ?? 2026,
      month ?? window.G?.currentCalMonth ?? 4,
      day,
    );
    const created = await request("/calendar/", {
      method: "POST",
      body: JSON.stringify({
        title,
        event_date: [
          target.getFullYear(),
          String(target.getMonth() + 1).padStart(2, "0"),
          String(target.getDate()).padStart(2, "0"),
        ].join("-"),
        event_type: calendarTypeFromColor(color),
      }),
    });
    return created.event;
  };

  window.opsRadarApi = {
    request,
    loadTodos: loadTodosFromAPI,
    loadIssues: loadIssuesFromAPI,
    loadCalendar: loadCalendarFromAPI,
    loadReports: loadReportsFromAPI,
    reload: () => Promise.allSettled([
      loadDashboardFromAPI(),
      loadTodosFromAPI(),
      loadIssuesFromAPI(),
      loadCalendarFromAPI(),
      loadReportsFromAPI(),
    ]),
  };

  function patchTodoActions() {
    if (typeof approveTodo === "function") {
      const original = approveTodo;
      window.approveTodo = approveTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try { await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ status: uiStatusToApi("approved") }) }); }
          catch (error) { console.warn("Todo approve API failed", error); showToast("Todo 저장에 실패했습니다.", "warn"); return; }
        }
        original(id);
      };
    }

    if (typeof rejectTodo === "function") {
      const original = rejectTodo;
      window.rejectTodo = rejectTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try { await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ approval_status: "rejected" }) }); }
          catch (error) { console.warn("Todo reject API failed", error); showToast("Todo 저장에 실패했습니다.", "warn"); return; }
        }
        original(id);
      };
    }

    if (typeof doneTodo === "function") {
      const original = doneTodo;
      window.doneTodo = doneTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try { await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ status: uiStatusToApi("done") }) }); }
          catch (error) { console.warn("Todo done API failed", error); showToast("Todo 저장에 실패했습니다.", "warn"); return; }
        }
        original(id);
      };
    }

    if (typeof undoTodo === "function") {
      const original = undoTodo;
      window.undoTodo = undoTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "pending", approval_status: "approved" }),
            });
          } catch (error) {
            console.warn("Todo undo API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
      };
    }

    if (typeof bulkApprove === "function") {
      const original = bulkApprove;
      window.bulkApprove = bulkApprove = async function () {
        const checkedIds = Object.keys(window.G?.todoChecked || {})
          .filter((id) => G.todoChecked[id])
          .map(Number);
        let pending = typeof todos === "undefined"
          ? []
          : todos.filter((todo) => todo.status === "pending" && checkedIds.includes(todo.id));
        if (!pending.length && typeof todos !== "undefined") {
          pending = todos.filter((todo) => todo.status === "pending");
        }
        try {
          await Promise.all(
            pending
              .filter((todo) => todo.apiId)
              .map((todo) => request(`/todos/${todo.apiId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "in_progress", approval_status: "approved" }),
              })),
          );
        } catch (error) {
          console.warn("Todo bulk approve API failed", error);
          showToast("Todo 일괄 저장에 실패했습니다.", "warn");
          return;
        }
        original();
      };
    }

    if (typeof saveEdit === "function") {
      const original = saveEdit;
      window.saveEdit = saveEdit = async function () {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === window.G?.editTargetId);
        if (todo?.apiId) {
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({
                title: document.getElementById("editTitle")?.value?.trim(),
                assignee: document.getElementById("editAssignee")?.value || null,
              }),
            });
          } catch (error) {
            console.warn("Todo edit API failed", error);
            showToast("Todo 수정에 실패했습니다.", "warn");
            return;
          }
        }
        original();
      };
    }
  }

  function patchCreateActions() {
    if (typeof saveManual === "function") {
      const original = saveManual;
      window.saveManual = saveManual = async function () {
        const titleEl = document.getElementById("manualTitle");
        const title = titleEl?.value?.trim();
        if (!title) return original();
        try {
          await request("/todos", {
            method: "POST",
            body: JSON.stringify({
              title,
              assignee: document.getElementById("manualAssignee")?.value || null,
              priority: document.getElementById("manualPriority")?.value || "medium",
              source: "manual",
              status: "pending",
            }),
          });
          original();
          await loadTodosFromAPI();
        } catch (error) {
          console.warn("Todo create API failed", error);
          showToast("Todo 등록에 실패했습니다.", "warn");
        }
      };
    }
  }

  function patchCalendarActions() {
    if (typeof addCalTag === "function") {
      const originalAdd = addCalTag;
      window.addCalTag = addCalTag = async function () {
        const day = window.G?.selectedCalDay;
        const title = document.getElementById("calModalInput")?.value?.trim();
        if (!title || !day) return originalAdd();
        try {
          await window.opsRadarCreateCalendarEvent({
            title,
            day,
            year: window.G?.currentCalYear,
            month: window.G?.currentCalMonth,
            color: typeof calSelectedColor === "undefined" ? "ct-info" : calSelectedColor,
          });
          originalAdd();
          await loadCalendarFromAPI();
        } catch (error) {
          console.warn("Calendar create API failed", error);
          showToast("캘린더 등록에 실패했습니다.", "warn");
        }
      };
    }

    if (typeof deleteCalTag === "function") {
      const original = deleteCalTag;
      window.deleteCalTag = deleteCalTag = async function (day, index) {
        const tag = window.G?.calEvents?.find((x) => x.d === day)?.tags[index];
        if (tag?.apiId) {
          try { await request(`/calendar/${tag.apiId}`, { method: "DELETE" }); }
          catch (error) { console.warn("Calendar delete API failed", error); showToast("캘린더 삭제에 실패했습니다.", "warn"); return; }
        }
        original(day, index);
      };
    }

    if (typeof doRegisterCalEvent === "function") {
      const originalRegister = doRegisterCalEvent;
      window.doRegisterCalEvent = doRegisterCalEvent = async function (button, person, date, type, impact, day) {
        if (!day) return originalRegister(button, person, date, type, impact, day);
        try {
          await window.opsRadarCreateCalendarEvent({
            title: person ? `${person} ${type}` : type,
            day,
            year: window.G?.currentCalYear,
            month: window.G?.currentCalMonth,
            color: type === "부재" ? "ct-gray" : "ct-info",
          });
          originalRegister(button, person, date, type, impact, day);
          await loadCalendarFromAPI();
        } catch (error) {
          console.warn("Chat calendar create API failed", error);
          showToast("캘린더 등록에 실패했습니다.", "warn");
        }
      };
    }
  }

  function patchReportActions() {
    if (typeof saveReport !== "function") return;
    const original = saveReport;
    window.saveReport = saveReport = async function (report) {
      const draft = report || window.G?.currentReportDraft || {};
      const period = draft.type === "monthly" ? "monthly" : "weekly";
      const editor = document.getElementById("reportEditor") || document.querySelector('#s-reports [contenteditable="true"]');
      const content = editor?.innerHTML || draft.html || "";
      try {
        let reportId = draft.apiId;
        if (!reportId) {
          const generated = await request("/reports/generate", {
            method: "POST",
            body: JSON.stringify({ period }),
          });
          reportId = generated.report_id;
        }
        await request(`/reports/${reportId}`, {
          method: "PATCH",
          body: JSON.stringify({ content }),
        });
        const saved = original({ ...draft, id: reportId, apiId: reportId, html: content });
        await loadReportsFromAPI();
        return saved;
      } catch (error) {
        console.warn("Report save API failed", error);
        showToast("보고서 저장에 실패했습니다.", "warn");
        return null;
      }
    };
  }

  function initialize() {
    patchTodoActions();
    window.opsRadarApi.reload().then((results) => {
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length) console.warn("Some OpsRadar API loads failed", rejected);
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
