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
      status: apiStatusToUi(todo.status),
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
    const day = Number(date.split("-")[2]);
    if (!day) return null;
    return {
      apiId: event.id,
      d: day,
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

  window.opsRadarCreateCalendarEvent = async function ({ title, day, color }) {
    const created = await request("/calendar/", {
      method: "POST",
      body: JSON.stringify({
        title,
        event_date: `2026-05-${String(day).padStart(2, "0")}`,
        event_type: calendarTypeFromColor(color),
      }),
    });
    return created.event;
  };

  window.opsRadarApi = {
    request,
    reload: () => Promise.allSettled([
      loadDashboardFromAPI(),
      loadTodosFromAPI(),
      loadIssuesFromAPI(),
      loadCalendarFromAPI(),
    ]),
  };

  function patchTodoActions() {
    if (typeof approveTodo === "function") {
      const original = approveTodo;
      window.approveTodo = approveTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try { await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ status: uiStatusToApi("approved") }) }); }
          catch (error) { console.warn("Todo approve API failed", error); }
        }
        original(id);
      };
    }

    if (typeof rejectTodo === "function") {
      const original = rejectTodo;
      window.rejectTodo = rejectTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try { await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ status: uiStatusToApi("rejected") }) }); }
          catch (error) { console.warn("Todo reject API failed", error); }
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
          catch (error) { console.warn("Todo done API failed", error); }
        }
        original(id);
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
        } catch (error) {
          console.warn("Todo create API failed", error);
        }
        original();
      };
    }
  }

  function patchCalendarActions() {
    if (typeof deleteCalTag === "function") {
      const original = deleteCalTag;
      window.deleteCalTag = deleteCalTag = async function (day, index) {
        const tag = window.G?.calEvents?.find((x) => x.d === day)?.tags[index];
        if (tag?.apiId) {
          try { await request(`/calendar/${tag.apiId}`, { method: "DELETE" }); }
          catch (error) { console.warn("Calendar delete API failed", error); }
        }
        original(day, index);
      };
    }
  }

  window.addEventListener("load", () => {
    patchTodoActions();
    patchCreateActions();
    patchCalendarActions();
    window.opsRadarApi.reload().then((results) => {
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length) console.warn("Some OpsRadar API loads failed", rejected);
    });
  });
})();
