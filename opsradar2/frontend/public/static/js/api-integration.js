(function () {
  const API = window.OPSRADAR_API_BASE || "/api/v1";
  const idMap = new Map();
  let nextUiId = 100000;

  function uiId(kind, apiId) {
    const key = `${kind}:${apiId}`;
    if (!idMap.has(key)) idMap.set(key, nextUiId++);
    return idMap.get(key);
  }

  function getAccessToken() {
    let token = localStorage.getItem("access_token");
    if (!token) {
      try {
        const sess = JSON.parse(localStorage.getItem("opsradar_session") || "null");
        token = sess?.access_token || sess?.token || null;
      } catch (_) {}
    }
    if (!token) token = localStorage.getItem("token") || null;
    if (!token) {
      try { token = JSON.parse(localStorage.getItem("auth") || "null")?.token || null; } catch (_) {}
    }
    return token;
  }

  async function fetchApi(path, options = {}) {
    const token = getAccessToken();
    const headers = options.body instanceof FormData
      ? { ...(options.headers || {}) }
      : { "Content-Type": "application/json", ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestOptions = { ...options, headers };
    let res;
    try {
      res = await fetch(`${API}${path}`, requestOptions);
    } catch (networkError) {
      const fallbackApi = API.replace("//localhost:8002", "//127.0.0.1:8002");
      if (fallbackApi === API) throw networkError;
      try {
        res = await fetch(`${fallbackApi}${path}`, requestOptions);
      } catch (_) {
        throw new Error("운영 API 서버에 연결할 수 없습니다. 백엔드(8002) 상태를 확인하세요.");
      }
    }
    return res;
  }

  async function errorDetail(res) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body.detail || body.message || detail;
    } catch (_) {}
    return res.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : detail;
  }

  async function request(path, options = {}) {
    const res = await fetchApi(path, options);
    if (!res.ok) {
      throw new Error(await errorDetail(res));
    }
    return res.status === 204 ? null : res.json();
  }

  function filenameFromDisposition(disposition, fallbackName) {
    const encoded = String(disposition || "").match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = String(disposition || "").match(/filename="?([^";]+)"?/i)?.[1];
    try {
      return decodeURIComponent(encoded || plain || fallbackName);
    } catch (_) {
      return plain || fallbackName;
    }
  }

  async function downloadDocument(documentId, fallbackName = "source-document") {
    if (!documentId) throw new Error("다운로드할 문서 정보가 없습니다.");
    const res = await fetchApi(`/documents/${encodeURIComponent(documentId)}/download`, {
      headers: { Accept: "application/octet-stream" },
    });
    if (!res.ok) throw new Error(await errorDetail(res));

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFromDisposition(res.headers.get("content-disposition"), fallbackName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

  function cleanTodoApiTitle(title) {
    return String(title || "").replace(/^\s*\[[^\]]+\]\s*/, "").trim() || "Untitled";
  }

  function briefTodoApiDescription(description, title) {
    const raw = String(description || "").replace(/\s+/g, " ").trim();
    const base = raw || `${title} 관련 업무 진행 및 결과 확인`;
    return base.length > 72 ? `${base.slice(0, 69)}...` : base;
  }

  function normalizeTodo(todo) {
    const title = cleanTodoApiTitle(todo.title);
    const rawDesc = String(todo.description || "").replace(/\s+/g, " ").trim();
    return {
      id: uiId("todo", todo.id),
      apiId: todo.id,
      title,
      description: rawDesc,
      descriptionPreview: briefTodoApiDescription(todo.description, title),
      src: todo.document_id || null,
      sourceFileName: todo.source_file_name || null,
      srcChunk: todo.source_chunk_id || null,
      assignee: todo.assignee || null,
      priority: todo.priority || "medium",
      confidence: todo.confidence == null ? null : Number(todo.confidence),
      dueDate: todo.due_at ? String(todo.due_at).slice(0, 10) : null,
      createdAt: todo.created_at || null,
      updatedAt: todo.updated_at || todo.created_at || null,
      status: todo.approval_status === "rejected" ? "rejected" : apiStatusToUi(todo.status),
      type: todo.source || "manual",
      chunk: null,
      grounds: [todo.source === "ai" ? "DB AI analysis result" : "DB saved Todo"],
      risk: "",
    };
  }

  function stripIssueTargetDate(value) {
    return String(value || "")
      .replace(/(?:목표\s*날짜|목표일|target\s*date)\s*[:：-]?\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function normalizeIssue(issue) {
    const status = issue.status || "open";
    const source = issue.source || "manual";
    return {
      id: uiId("issue", issue.id),
      apiId: issue.id,
      type: status === "resolved" ? "resolved" : issue.approval_status === "pending" || (source === "ai" && issue.approval_status !== "approved") ? "candidate" : "confirmed",
      severity: issue.risk_level || issue.severity || "medium",
      status,
      confidence: issue.confidence == null ? null : Number(issue.confidence),
      title: stripIssueTargetDate(issue.title) || "Untitled issue",
      src: issue.document_id || null,
      sourceFileName: issue.source_file_name || null,
      assignee: issue.assignee || null,
      dueDate: issue.due_at ? String(issue.due_at).slice(0, 10) : null,
      days: 0,
      desc: stripIssueTargetDate(issue.description || issue.title),
      chunk: "",
      history: [],
      domino: [],
      dominoFinal: issue.domino_impact || "",
      suggestTodo: issue.title ? `${issue.title} follow-up` : null,
      suggestAssignee: issue.assignee || null,
      suggestPriority: (issue.risk_level || issue.severity) === "high" ? "high" : "medium",
      approvalStatus: issue.approval_status || "approved",
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


  let members = [];

  const localToday = () => {
    const value = new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };


  function recommendTodoAssignee(todo) {
    if (todo.assignee || !members.length) return null;
    const text = `${todo.title || ""} ${todo.description || ""}`.toLowerCase();
    const named = members.find((member) => text.includes(String(member.name || "").toLowerCase()));
    if (named) return { name: named.name, reason: "제목에 담당자 이름이 언급됨" };

    // 역할/키워드만으로 특정 개인을 정하면 오배정이 된다. 이름이 원문에 있을 때만 추천한다.
    return null;
  }

  function applyTodoRecommendations() {
    if (typeof todos === "undefined") return;
    todos.forEach((todo) => {
      const recommendation = recommendTodoAssignee(todo);
      todo.recommendedAssignee = recommendation?.name || null;
      todo.recommendationReason = recommendation?.reason || null;
    });
    if (typeof renderTodos === "function") renderTodos();
    if (window.G?.selectedTodoId && typeof renderTodoDetail === "function") renderTodoDetail(window.G.selectedTodoId);
  }
  function activeAssigneeNames() {
    return members.filter((m) => (m.status || "active") === "active").map((m) => m.name).filter(Boolean);
  }

  function assigneeOptionHtml(selected = "") {
    const names = activeAssigneeNames();
    return [`<option value="">미지정</option>`]
      .concat(names.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`))
      .join("");
  }

  function ensureIssueAssigneeSelect() {
    const current = document.getElementById("issueAssignee");
    if (!current || current.tagName === "SELECT") return current;
    const select = document.createElement("select");
    select.id = current.id;
    select.className = current.className;
    select.style.cssText = current.style.cssText;
    current.replaceWith(select);
    return select;
  }

  function hydrateAssigneeControls() {
    const names = activeAssigneeNames();
    const fallback = "";
    ["manualAssignee", "editAssignee", "tcAssignee"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const selected = names.includes(el.value) ? el.value : fallback;
      el.innerHTML = assigneeOptionHtml(selected);
      el.value = selected;
    });
    const issueSelect = ensureIssueAssigneeSelect();
    if (issueSelect) {
      const selected = names.includes(issueSelect.value) ? issueSelect.value : fallback;
      issueSelect.innerHTML = assigneeOptionHtml(selected);
      issueSelect.value = selected;
    }
    document.querySelectorAll('[onclick*="담당자 A"]').forEach((el) => {
      const html = el.getAttribute("onclick");
      if (html) el.setAttribute("onclick", html.replaceAll("담당자 A", fallback));
      if (el.textContent.includes("담당자 A")) el.textContent = el.textContent.replaceAll("담당자 A", fallback);
    });
  }

  async function loadMembersFromAPI() {
    const data = await request("/members");
    members = Array.isArray(data.members) ? data.members : [];
    window.opsRadarMembers = members;
    hydrateAssigneeControls();
    renderMemberAdminPanel();
    applyTodoRecommendations();
    window.applyWorkflowRoleVisibility?.();
    window.refreshCalendarTeamFilter?.();
    window.renderTodos?.();
    window.syncTodoCalendar?.();
    return members;
  }

  function ensureMemberAdminPanel() {
    const content = document.querySelector("#s-settings .settings-content");
    if (!content) return null;
    let panel = document.getElementById("memberAdminPanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "memberAdminPanel";
    panel.className = "settings-panel";
    panel.innerHTML = `
      <div class="settings-card-inner">
        <div class="settings-panel-head">
          <div>
            <div class="settings-eyebrow">Members</div>
            <h3>담당자 관리</h3>
            <p class="settings-panel-sub">Todo와 Issue 배정에 사용할 실제 프로젝트 담당자를 관리합니다.</p>
          </div>
          <button type="button" class="tbtn" onclick="loadOpsRadarMembers()"><i class="ti ti-refresh"></i> 새로고침</button>
        </div>
        <div class="form-row" style="align-items:end;margin-bottom:12px">
          <div><div class="form-label">이름</div><input class="form-input" id="memberNewName" type="text" placeholder="예: 이성우"></div>
          <div><div class="form-label">이메일</div><input class="form-input" id="memberNewEmail" type="email" placeholder="name@opsradar.local"></div>
          <div><div class="form-label">역할</div><select class="form-input" id="memberNewRole"><option value="member">member</option><option value="admin">admin</option><option value="pm">pm</option></select></div>
          <button type="button" class="tbtn primary" onclick="createOpsRadarMember()"><i class="ti ti-plus"></i> 추가</button>
        </div>
        <div id="memberAdminList" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>`;
    const danger = content.querySelector(".danger-zone");
    if (danger) content.insertBefore(panel, danger); else content.appendChild(panel);
    return panel;
  }

  function renderMemberAdminPanel() {
    const panel = ensureMemberAdminPanel();
    if (!panel) return;
    const list = document.getElementById("memberAdminList");
    if (!list) return;
    if (!members.length) {
      list.innerHTML = '<div class="chat-context-empty">등록된 담당자가 없습니다.</div>';
      return;
    }
    list.innerHTML = members.map((member) => `
      <div style="display:grid;grid-template-columns:1.1fr 1.5fr .8fr .8fr auto;gap:6px;align-items:center;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px">
        <input class="form-input" id="member-name-${member.member_id}" value="${escapeHtml(member.name || "")}">
        <input class="form-input" id="member-email-${member.member_id}" value="${escapeHtml(member.email || "")}">
        <select class="form-input" id="member-role-${member.member_id}"><option value="member" ${(member.project_role || member.user_role) === "member" ? "selected" : ""}>member</option><option value="admin" ${(member.project_role || member.user_role) === "admin" ? "selected" : ""}>admin</option><option value="pm" ${(member.project_role || member.user_role) === "pm" ? "selected" : ""}>pm</option></select>
        <select class="form-input" id="member-status-${member.member_id}"><option value="active" ${member.status === "active" ? "selected" : ""}>active</option><option value="inactive" ${member.status === "inactive" ? "selected" : ""}>inactive</option></select>
        <div style="display:flex;gap:4px"><button type="button" class="tbtn" onclick="saveOpsRadarMember('${member.member_id}')"><i class="ti ti-device-floppy"></i></button><button type="button" class="tbtn" style="color:var(--danger)" onclick="deleteOpsRadarMember('${member.member_id}')"><i class="ti ti-trash"></i></button></div>
      </div>`).join("");
  }

  window.loadOpsRadarMembers = async function () {
    try { await loadMembersFromAPI(); }
    catch (error) { console.warn("Member load API failed", error); showToast("담당자 목록을 불러오지 못했습니다.", "warn"); }
  };

  window.createOpsRadarMember = async function () {
    const name = document.getElementById("memberNewName")?.value?.trim();
    const email = document.getElementById("memberNewEmail")?.value?.trim();
    const role = document.getElementById("memberNewRole")?.value || "member";
    if (!name) { showToast("이름을 입력하세요.", "warn"); return; }
    try {
      await request("/members", { method:"POST", body: JSON.stringify({ name, email, project_role: role, user_role: role }) });
      document.getElementById("memberNewName").value = "";
      document.getElementById("memberNewEmail").value = "";
      await loadMembersFromAPI();
      showToast("담당자를 추가했습니다.", "success");
    } catch (error) { console.warn("Member create API failed", error); showToast("담당자 추가에 실패했습니다.", "warn"); }
  };

  window.saveOpsRadarMember = async function (memberId) {
    try {
      await request(`/members/${memberId}`, {
        method:"PATCH",
        body: JSON.stringify({
          name: document.getElementById(`member-name-${memberId}`)?.value?.trim(),
          email: document.getElementById(`member-email-${memberId}`)?.value?.trim(),
          project_role: document.getElementById(`member-role-${memberId}`)?.value,
          user_role: document.getElementById(`member-role-${memberId}`)?.value,
          status: document.getElementById(`member-status-${memberId}`)?.value,
        }),
      });
      await loadMembersFromAPI();
      await window.opsRadarApi.reload();
      showToast("담당자를 수정했습니다.", "success");
    } catch (error) { console.warn("Member update API failed", error); showToast("담당자 수정에 실패했습니다.", "warn"); }
  };

  window.deleteOpsRadarMember = async function (memberId) {
    if (!confirm("이 담당자를 비활성화할까요?")) return;
    try {
      await request(`/members/${memberId}`, { method:"DELETE" });
      await loadMembersFromAPI();
      await window.opsRadarApi.reload();
      showToast("담당자를 비활성화했습니다.", "success");
    } catch (error) { console.warn("Member delete API failed", error); showToast("담당자 삭제에 실패했습니다.", "warn"); }
  };
  function isAbsenceRange(event) {
    return event?.event_type === "absence" && Boolean(event?.created_at);
  }

  function absenceRangeKey(event) {
    return [event.member_id || "", event.title || "", event.created_at || ""].join("|");
  }

  function shortCalendarDate(value) {
    const [, month, day] = String(value || "").split("-");
    return month && day ? `${Number(month)}/${Number(day)}` : "-";
  }

  function absenceRangeMeta(events) {
    const groups = new Map();
    events.filter(isAbsenceRange).forEach((event) => {
      const key = absenceRangeKey(event);
      const group = groups.get(key) || [];
      group.push(event);
      groups.set(key, group);
    });
    const metaById = new Map();
    groups.forEach((group, sourceType) => {
      if (group.length < 2) return;
      const sorted = [...group].sort((left, right) => String(left.event_date).localeCompare(String(right.event_date)));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      sorted.forEach((event, index) => {
        const date = new Date(`${event.event_date}T12:00:00`);
        metaById.set(event.id, {
          sourceType,
          startDate: first.event_date,
          endDate: last.event_date,
          isStart: index === 0,
          isEnd: index === sorted.length - 1,
          startsVisualSegment: index === 0 || date.getDay() === 1,
          endsVisualSegment: index === sorted.length - 1 || date.getDay() === 0,
        });
      });
    });
    return metaById;
  }

  function normalizeCalendarEvent(event, rangeMeta) {
    const date = String(event.event_date || "");
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return null;
    const range = rangeMeta?.get(event.id) || null;
    const rawEventTime = String(event.event_time || "").trim();
    const eventTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(rawEventTime) && rawEventTime !== "00:00"
      ? rawEventTime
      : "";
    const tagTitle = range && !range.isStart
      ? [eventTime, event.title].filter(Boolean).join(" ")
      : [event.person, eventTime, event.title].filter(Boolean).join(" ");
    const rangeClass = range
      ? ` absence-range absence-range-${range.startsVisualSegment ? "start" : range.endsVisualSegment ? "end" : "middle"}`
      : "";
    return {
      apiId: event.id,
      d: day,
      y: year,
      m: month - 1,
      tags: [{
        apiId: event.id,
        t: tagTitle,
        c: `${calendarClass(event.event_type)}${rangeClass}`,
        eventType: event.event_type,
        memberId: event.member_id || "",
        person: event.person || "",
        sourceType: event.source_type || "manual",
        isAbsenceRange: Boolean(range),
        rangeLabel: range
          ? `${[event.person, event.title].filter(Boolean).join(" ")} · ${shortCalendarDate(range.startDate)}~${shortCalendarDate(range.endDate)}`
          : "",
      }],
    };
  }

  function mergeCalendarEvents(events) {
    if (!window.G) return;
    const byDay = new Map();
    const rangeMeta = absenceRangeMeta(events);
    events.map((event) => normalizeCalendarEvent(event, rangeMeta)).filter(Boolean).forEach((event) => {
      const key = `${event.y}-${event.m}-${event.d}`;
      const existing = byDay.get(key);
      if (existing) existing.tags.push(...event.tags);
      else byDay.set(key, event);
    });
    window.G.calEvents = Array.from(byDay.values());
  }

  function normalizeReport(report) {
    const type = report.period === "monthly" ? "monthly" : "weekly";
    const parsedSections = typeof window.parseReportMarkdown === "function"
      ? window.parseReportMarkdown(report.content || "")
      : { completed: [report.content || "저장된 보고서 본문이 없습니다."], inProgress: [], technical: [], risk: [], retrospective: [], nextPlan: [] };
    const start = report.start_date || report.week_start || "-";
    return {
      id: report.id,
      apiId: report.id,
      type,
      title: type === "monthly" ? `${String(start).slice(0, 7)} 월간 운영 보고서` : `${start} 주간 운영 보고서`,
      period: `${report.start_date || report.week_start || "-"} ~ ${report.end_date || report.week_end || "-"}`,
      createdAt: report.created_at,
      author: "WorkRader",
      status: "draft",
      issues: 0,
      doneTodos: 0,
      pendingTodos: 0,
      sections: parsedSections,
      docs: ["DB 저장 보고서"],
      html: report.content || "",
    };
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
    const data = await request("/todos?limit=500");
    replaceArray(todos, (data.todos || []).map(normalizeTodo));
    applyTodoRecommendations();
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

  async function loadDocumentsFromAPI() {
    if (!window.G) return;
    const data = await request("/documents");
    const docs = data.documents || [];
    const existingIds = new Set((window.G.analysisHistory || []).map((h) => h.documentId).filter(Boolean));
    docs.forEach((doc) => {
      if (!existingIds.has(doc.document_id)) {
        (window.G.analysisHistory = window.G.analysisHistory || []).push({
          name: doc.file_name,
          type: "document",
          documentId: doc.document_id,
          date: doc.created_at ? new Date(doc.created_at).toLocaleDateString("ko-KR") : "-",
          todo: doc.pending_todo_count || 0,
          issue: doc.pending_issue_count || 0,
          blocked: doc.blocked_count || 0,
        });
      }
    });
    if (typeof renderHistory === "function") renderHistory();
  }

  window.deleteDocumentFromHistory = async function (documentId) {
    if (typeof window.deleteUploadedDocument === "function") {
      return window.deleteUploadedDocument(documentId);
    }
    if (!confirm("이 파일과 관련 분석 데이터를 삭제할까요?")) return;
    const password = prompt("관리자 비밀번호를 입력하세요.");
    if (!password) return;
    try {
      await request(`/documents/${documentId}`, { method: "DELETE", body: JSON.stringify({ password }) });
      if (window.G?.analysisHistory) {
        window.G.analysisHistory = window.G.analysisHistory.filter((h) => h.documentId !== documentId);
      }
      if (typeof renderHistory === "function") renderHistory();
      if (typeof showToast === "function") showToast("파일이 삭제되었습니다.", "success");
    } catch (error) {
      if (typeof showToast === "function") showToast(`삭제 실패: ${error.message}`, "warn");
    }
  };

  async function loadReportsFromAPI() {
    if (typeof persistReports !== "function") return;
    const data = await request("/reports");
    const reports = (data.reports || []).map(normalizeReport);
    persistReports(reports);
    if (window.G) window.G.savedReports = reports;
    if (typeof renderReportList === "function") renderReportList();
  }

  async function uploadDocument(file, options = {}) {
    const form = new FormData();
    form.append("file", file);
    if (options.projectId) form.append("project_id", options.projectId);
    if (options.docType) form.append("doc_type", options.docType);
    return request("/documents/upload", {
      method: "POST",
      body: form,
    });
  }

  async function getDocumentStatus(documentId) {
    return request(`/documents/${documentId}/status`);
  }

  async function getDocumentChunks(documentId) {
    return request(`/documents/${documentId}/chunks`);
  }

  async function waitForDocumentAnalysis(documentId, onStatus) {
    const terminal = new Set(["completed", "failed", "error"]);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await getDocumentStatus(documentId);
      if (typeof onStatus === "function") onStatus(status);
      if (terminal.has(status.analysis_status || status.status)) return status;
      await new Promise((resolve) => setTimeout(resolve, attempt < 5 ? 700 : 1500));
    }
    throw new Error("문서 분석 대기 시간이 초과되었습니다.");
  }

  async function createTodoFromChunk(documentId, chunkId, data) {
    return request(`/documents/${documentId}/chunks/${chunkId}/todos`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async function createIssueFromChunk(documentId, chunkId, data) {
    return request(`/documents/${documentId}/chunks/${chunkId}/issues`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  function byDocumentId(items, documentId) {
    return (items || []).filter((item) => item.document_id === documentId);
  }

  function firstChunkText(chunks) {
    const chunk = (chunks || [])[0];
    if (!chunk) return "저장된 chunk가 없습니다.";
    return String(chunk.content || "").slice(0, 420);
  }

  function prepareAnalysisTodoReview(documentId, docTodos) {
    if (!window.G) return;
    window.G.lastAnalysisDocumentId = documentId;
    window.G.analysisTodoChecked = {};
    window.G.analysisTodoReview = (docTodos || []).map((todo) => {
      const item = normalizeTodo(todo);
      const recommendation = recommendTodoAssignee(item);
      item.recommendedAssignee = recommendation?.name || null;
      item.recommendationReason = recommendation?.reason || null;
      window.G.analysisTodoChecked[String(item.apiId || item.id)] = true;
      return item;
    });
    if (typeof renderAnalysisTodoReview === "function") renderAnalysisTodoReview();
  }

  function prepareAnalysisRiskReview(documentId, docIssues) {
    if (!window.G) return;
    window.G.lastAnalysisDocumentId = documentId;
    window.G.analysisRiskChecked = {};
    window.G.analysisRiskReview = (docIssues || []).map((issue) => {
      const item = normalizeIssue(issue);
      item.dueDate = item.dueDate || localToday();
      window.G.analysisRiskChecked[String(item.apiId || item.id)] = true;
      return item;
    });
    if (typeof renderAnalysisRiskReview === "function") renderAnalysisRiskReview();
  }

  function renderRealDocumentResult({ file, documentId, chunks, todos: docTodos, issues: docIssues }) {
    const chunk = (chunks || [])[0];
    const chunkCount = chunks?.length || 0;
    const issueCount = docIssues?.length || 0;
    const todoCount = docTodos?.length || 0;
    const blockedCount = (docTodos || []).filter((todo) => todo.status === "blocked").length
      + (docIssues || []).filter((issue) => issue.status === "blocked").length;

    if (typeof setStepBar === "function") setStepBar(3);
    const resultFname = document.getElementById("resultFname");
    const rChunkMeta = document.getElementById("rChunkMeta");
    const rChunkContent = document.getElementById("rChunkContent");
    const rSrcDoc = document.getElementById("rSrcDoc");
    const rSrcRange = document.getElementById("rSrcRange");
    const rSrcReason = document.getElementById("rSrcReason");
    const resultSection = document.getElementById("resultSection");

    if (resultFname) resultFname.textContent = file.name;
    if (rChunkMeta) rChunkMeta.textContent = `${file.name} · ${chunkCount} chunks · document ${documentId.slice(0, 8)}`;
    if (rChunkContent) rChunkContent.textContent = firstChunkText(chunks);
    if (rSrcDoc) rSrcDoc.textContent = file.name;
    if (rSrcRange) rSrcRange.textContent = chunk ? `chunk #${chunk.chunk_index ?? 0}` : "-";
    if (rSrcReason) {
      rSrcReason.textContent = issueCount || todoCount
        ? "AI 분석 결과가 DB에 Todo/Issue로 저장되었습니다. 필요한 항목은 각 화면에서 승인하거나 수정할 수 있습니다."
        : "문서와 chunk는 DB에 저장되었습니다. AI가 항목을 추출하지 못한 경우 수동으로 Todo/Issue를 만들 수 있습니다.";
    }

    if (typeof countUp === "function") {
      countUp("rTodo", todoCount, 500);
      countUp("rIssue", issueCount, 500);
      countUp("rBlocked", blockedCount, 500);
    } else {
      const rTodo = document.getElementById("rTodo");
      const rIssue = document.getElementById("rIssue");
      const rBlocked = document.getElementById("rBlocked");
      if (rTodo) rTodo.textContent = todoCount;
      if (rIssue) rIssue.textContent = issueCount;
      if (rBlocked) rBlocked.textContent = blockedCount;
    }

    if (resultSection) resultSection.style.display = "block";
    if (window.G?.analysisHistory) {
      window.G.analysisHistory.unshift({
        name: file.name,
        type: "document",
        documentId,
        date: typeof formatOpsDate === "function" ? formatOpsDate("short") : new Date().toLocaleDateString("ko-KR"),
        todo: todoCount,
        issue: issueCount,
        blocked: blockedCount,
      });
    }
  }

  async function runRealDocumentAnalysis(files) {
    if (!files?.length) throw new Error("업로드할 파일이 없습니다.");
    const file = files[0];
    const upload = await uploadDocument(file);
    const documentId = upload.document_id;
    if (!documentId) throw new Error("백엔드에서 document_id를 받지 못했습니다.");

    await waitForDocumentAnalysis(documentId, (status) => {
      const progress = Number(status.progress || 0);
      if (typeof setFlow === "function") {
        if (progress < 40) setFlow(1, "active", "파일 저장 및 텍스트 추출 중", `진행률 ${progress}%`, "s-active");
        else setFlow(1, "done", "파일 저장 및 텍스트 추출 완료", "DB documents/document_chunks 저장", "s-done");
        if (progress >= 40 && progress < 80) setFlow(2, "active", "Todo/Issue 추출 중", `진행률 ${progress}%`, "s-active");
        else if (progress >= 80) setFlow(2, "done", "Todo/Issue 추출 완료", "DB todos/issues 반영", "s-done");
        if (progress >= 80 && progress < 100) setFlow(3, "active", "운영 요약 생성 중", `진행률 ${progress}%`, "s-active");
      }
    });

    if (typeof setFlow === "function") {
      setFlow(1, "done", "파일 저장 및 텍스트 추출 완료", "DB documents/document_chunks 저장", "s-done");
      setFlow(2, "done", "Todo/Issue 추출 완료", "DB todos/issues 반영", "s-done");
      setFlow(3, "done", "운영 요약 생성 완료", "분석 결과 저장 완료", "s-done");
    }

    const chunkData = await getDocumentChunks(documentId);
    const todoData = await request(`/documents/${documentId}/todos`);
    const issueData = await request(`/documents/${documentId}/issues`);
    const docTodos = todoData.todos || [];
    const docIssues = issueData.issues || [];
    prepareAnalysisTodoReview(documentId, docTodos);
    prepareAnalysisRiskReview(documentId, docIssues);

    renderRealDocumentResult({
      file,
      documentId,
      chunks: chunkData.chunks || [],
      todos: docTodos,
      issues: docIssues,
    });

    await window.opsRadarApi.reload();
    return { documentId, chunks: chunkData.chunks || [], todos: docTodos, issues: docIssues };
  }

  window.opsRadarCreateCalendarEvent = async function ({
    title,
    day,
    month,
    year,
    color,
    eventType,
    memberId,
    eventTime,
    endDate,
  }) {
    const target = new Date(
      year ?? window.G?.currentCalYear ?? new Date().getFullYear(),
      month ?? window.G?.currentCalMonth ?? new Date().getMonth(),
      day,
    );
    if(
      !Number.isInteger(target.getTime())
      || target.getFullYear() !== Number(year ?? window.G?.currentCalYear ?? target.getFullYear())
      || target.getMonth() !== Number(month ?? window.G?.currentCalMonth ?? target.getMonth())
      || target.getDate() !== Number(day)
    ){
      throw new Error("올바른 날짜를 지정하세요.");
    }
    const created = await request("/calendar/", {
      method: "POST",
      body: JSON.stringify({
        title,
        event_date: [
          target.getFullYear(),
          String(target.getMonth() + 1).padStart(2, "0"),
          String(target.getDate()).padStart(2, "0"),
        ].join("-"),
        event_type: eventType || calendarTypeFromColor(color),
        member_id: memberId || null,
        event_time: eventTime || null,
        end_date: endDate || null,
      }),
    });
    return created.event;
  };

  window.opsRadarApi = {
    request,
    downloadDocument,
    uploadDocument,
    getDocumentStatus,
    getDocumentChunks,
    createTodoFromChunk,
    createIssueFromChunk,
    runDocumentAnalysis: runRealDocumentAnalysis,
    loadTodos: loadTodosFromAPI,
    loadIssues: loadIssuesFromAPI,
    loadCalendar: loadCalendarFromAPI,
    loadReports: loadReportsFromAPI,
    loadMembers: loadMembersFromAPI,
    reload: () => Promise.allSettled([
      loadDashboardFromAPI(),
      loadTodosFromAPI(),
      loadIssuesFromAPI(),
      loadCalendarFromAPI(),
      loadReportsFromAPI(),
      loadMembersFromAPI(),
      loadDocumentsFromAPI(),
    ]),
  };

  function patchTodoActions() {
    const reloadTodos = async () => {
      if (typeof loadTodosFromAPI === "function") await loadTodosFromAPI();
    };

    if (typeof approveTodo === "function") {
      const original = approveTodo;
      window.approveTodo = approveTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        const assignee = todo?.assignee || todo?.recommendedAssignee || null;
        if (todo?.apiId) {
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: uiStatusToApi("approved"), approval_status: "approved", assignee }),
            });
          } catch (error) {
            console.warn("Todo approve API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
        await reloadTodos();
      };
    }

    if (typeof rejectTodo === "function") {
      const original = rejectTodo;
      window.rejectTodo = rejectTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "pending", approval_status: "rejected" }),
            });
          } catch (error) {
            console.warn("Todo reject API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
        await reloadTodos();
      };
    }

    if (typeof doneTodo === "function") {
      const original = doneTodo;
      window.doneTodo = doneTodo = async function (id) {
        const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === id);
        if (todo?.apiId) {
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: uiStatusToApi("done"), approval_status: "approved" }),
            });
          } catch (error) {
            console.warn("Todo done API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
        await reloadTodos();
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
            showToast("Todo 되돌리기 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
        if (todo) todo.assignee = null;
        await reloadTodos();
      };
    }
  }


  function patchBulkApproveAction() {
    if (typeof bulkApprove === "function") {
      const original = bulkApprove;
      window.bulkApprove = bulkApprove = async function () {
        const checkedIds = Object.keys(window.G?.todoChecked || {}).filter((id) => window.G.todoChecked[id]).map(Number);
        const targets = typeof todos === "undefined" ? [] : todos.filter((todo) => todo.status === "pending" && checkedIds.includes(todo.id));
        if (!targets.length) return original();
        try {
          await Promise.all(targets.filter((todo) => todo.apiId).map((todo) => request(`/todos/${todo.apiId}`, {
            method: "PATCH",
            body: JSON.stringify({
              status: uiStatusToApi("approved"),
              approval_status: "approved",
              assignee: todo.assignee || todo.recommendedAssignee || null,
            }),
          })));
          targets.forEach((todo) => {
            if (!todo.assignee && todo.recommendedAssignee) todo.assignee = todo.recommendedAssignee;
          });
          original();
          await loadTodosFromAPI();
        } catch (error) {
          console.warn("Todo checked approve API failed", error);
          showToast("체크항목 승인 저장에 실패했습니다.", "warn");
        }
      };
    }

    if (typeof bulkReject === "function") {
      const originalReject = bulkReject;
      window.bulkReject = bulkReject = async function () {
        const checkedIds = Object.keys(window.G?.todoChecked || {}).filter((id) => window.G.todoChecked[id]).map(Number);
        const targets = typeof todos === "undefined" ? [] : todos.filter((todo) => todo.status === "pending" && checkedIds.includes(todo.id));
        if (!targets.length) return originalReject();
        try {
          await Promise.all(targets.filter((todo) => todo.apiId).map((todo) => request(`/todos/${todo.apiId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "pending", approval_status: "rejected" }),
          })));
          originalReject();
          await loadTodosFromAPI();
        } catch (error) {
          console.warn("Todo checked reject API failed", error);
          showToast("체크항목 반려 저장에 실패했습니다.", "warn");
        }
      };
    }

    if (typeof bulkUndoApprove === "function") {
      const originalUndo = bulkUndoApprove;
      window.bulkUndoApprove = bulkUndoApprove = async function () {
        const checkedIds = Object.keys(window.G?.todoChecked || {}).filter((id) => window.G.todoChecked[id]).map(Number);
        const targets = typeof todos === "undefined" ? [] : todos.filter((todo) => todo.status === "approved" && checkedIds.includes(todo.id));
        if (!targets.length) return originalUndo();
        try {
          await Promise.all(targets.filter((todo) => todo.apiId).map((todo) => request(`/todos/${todo.apiId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "pending", approval_status: "pending", assignee: null }),
          })));
          originalUndo();
          await loadTodosFromAPI();
        } catch (error) {
          console.warn("Todo checked undo approve API failed", error);
          showToast("체크항목 되돌리기 저장에 실패했습니다.", "warn");
        }
      };
    }
  }
  function patchCreateActions() {
    if (typeof saveManual === "function") {
      const original = saveManual;
      window.saveManual = saveManual = async function () {
        const title = document.getElementById("manualTitle")?.value?.trim();
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


  function patchTodoEditAction() {
    if (typeof saveEdit !== "function") return;
    window.saveEdit = saveEdit = async function () {
      const todo = typeof todos === "undefined" ? null : todos.find((x) => x.id === window.G?.editTargetId);
      const title = document.getElementById("editTitle")?.value?.trim();
      const description = document.getElementById("editDescription")?.value?.trim() || "";
      const assignee = document.getElementById("editAssignee")?.value || null;
      const dueAt = document.getElementById("editDueDate")?.value || null;
      if (!todo || !title) return;
      if (todo.apiId) {
        try {
          await request(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ title, description, assignee, due_at: dueAt }) });
        } catch (error) {
          console.warn("Todo edit API failed", error);
          showToast("Todo 수정 저장에 실패했습니다.", "warn");
          return;
        }
      }
      todo.title = title;
      todo.description = description;
      todo.assignee = assignee;
      todo.dueDate = dueAt;
      closeModal("editModal");
      renderTodos();
      if (window.G?.selectedTodoId === window.G?.editTargetId) renderTodoDetail(window.G.editTargetId);
      await loadTodosFromAPI();
      showToast("수정되었습니다.", "success");
    };
  }
  function patchCalendarActions() {
    // deleteCalTag in app.js already handles DB deletion and reload.
    // Keep this hook as a no-op to avoid double DELETE requests.
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
    patchTodoEditAction();
    patchBulkApproveAction();
    patchCreateActions();
    patchCalendarActions();
    patchReportActions();
    patchDocumentAnalysis();
    window.opsRadarApi.reload().then((results) => {
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length) console.warn("Some WorkRader API loads failed", rejected);
    });
  }

  function patchDocumentAnalysis() {
    if (typeof startAnalysis !== "function") return;
    window.startAnalysis = startAnalysis = async function () {
      if (!window.G?.uploadedFiles?.length) {
        if (typeof showUploadError === "function") showUploadError("general");
        return;
      }
      if (typeof hideUploadError === "function") hideUploadError();
      if (typeof validateUploadedFiles === "function") {
        const validation = await validateUploadedFiles(window.G.uploadedFiles);
        if (!validation.ok) {
          if (typeof showUploadError === "function") showUploadError(validation.reason);
          return;
        }
      }

      const uploadSection = document.getElementById("uploadSection");
      const analysisSection = document.getElementById("analysisSection");
      const analysisGuide = document.getElementById("analysisGuide");
      const resultSection = document.getElementById("resultSection");
      const uploadedFname = document.getElementById("uploadedFname");
      const analysisBadge = document.getElementById("analysisBadge");
      const file = window.G.uploadedFiles[0];

      if (uploadSection) uploadSection.style.display = "none";
      if (analysisSection) analysisSection.style.display = "block";
      if (analysisGuide) analysisGuide.style.display = "none";
      if (resultSection) resultSection.style.display = "none";
      if (uploadedFname) uploadedFname.textContent = `AI가 업무 내용을 분석하고 있습니다... · ${file.name}`;
      if (analysisBadge) {
        analysisBadge.textContent = "분석 중...";
        analysisBadge.className = "badge b-accent";
      }
      if (typeof setStepBar === "function") setStepBar(2);

      try {
        await runRealDocumentAnalysis(window.G.uploadedFiles);
        if (analysisBadge) {
          analysisBadge.textContent = "완료";
          analysisBadge.className = "badge b-success";
        }
        if (typeof showToast === "function") showToast("분석 결과가 DB에 저장되었습니다.", "success");
        if (typeof addNotif === "function") addNotif(`"${file.name.slice(0, 20)}" 분석 완료. Todo와 이슈를 확인하세요.`, "success");
      } catch (error) {
        console.warn("Document upload/analysis failed", error);
        if (analysisBadge) {
          analysisBadge.textContent = "실패";
          analysisBadge.className = "badge b-danger";
        }
        if (typeof showToast === "function") showToast(`문서 분석에 실패했습니다. ${error.message || ""}`, "warn");
        if (uploadSection) uploadSection.style.display = "block";
      }
    };
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
