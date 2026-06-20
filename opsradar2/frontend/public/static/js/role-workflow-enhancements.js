(function () {
  const STORAGE = {
    extras: "workrader_todo_extra_assignees",
    rejection: "workrader_todo_rejection_reasons",
    approvals: "workrader_analysis_approvals",
    calendar: "workrader_calendar_preferences",
  };
  const read = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const session = () => read("opsradar_session", {});
  const user = () => session().user || {};
  const LEAD_ROLES = ["admin", "pm", "leader", "lead", "시스템 관리자", "운영총괄"];
  const currentMember = () => (window.opsRadarMembers || []).find((member) => (
    String(member.user_id || "") === String(user().id || user().user_id || "")
    || String(member.username || "") === String(user().username || "")
    || String(member.name || "") === String(user().name || "")
  ));
  const isLead = () => {
    const actor = user();
    const member = currentMember();
    if (member) {
      const roles = [member.project_role, member.role, member.user_role]
        .map((role) => String(role || "").toLowerCase());
      return roles.some((role) => LEAD_ROLES.includes(role));
    }
    if (actor.username === "hj" || actor.username === "admin") return true;
    return [actor.role, actor.project_role, actor.user_role]
      .map((role) => String(role || "").toLowerCase())
      .some((role) => LEAD_ROLES.includes(role));
  };
  const memberName = () => user().name || localStorage.getItem("opsradar_user_name") || "";
  const todoKey = (todo) => String(todo?.apiId || todo?.id || "");
  const issueKey = (issue) => String(issue?.apiId || issue?.id || "");
  const api = (path, options = {}) => window.opsRadarApi.request(path, options);
  const names = () => (window.opsRadarMembers || []).filter((item) => (item.status || "active") === "active").map((item) => item.name).filter(Boolean);
  const optionHtml = (selected) => names().map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");

  function extraAssignees(todo) {
    const all = read(STORAGE.extras, {});
    const values = all[todoKey(todo)] || [];
    return Array.from(new Set([todo?.assignee, ...values].filter(Boolean)));
  }

  function saveExtraAssignees(todo, values) {
    const clean = Array.from(new Set(values.filter(Boolean)));
    if (!clean.length) throw new Error("담당자는 최소 한 명이어야 합니다.");
    const all = read(STORAGE.extras, {});
    all[todoKey(todo)] = clean.slice(1);
    write(STORAGE.extras, all);
    return clean;
  }

  function ensureAssigneeEditor(containerId, todo) {
    const host = document.getElementById(containerId);
    if (!host) return;
    host.innerHTML = "";
    const values = extraAssignees(todo);
    (values.length ? values : [todo?.recommendedAssignee || names()[0] || ""]).forEach((value) => addAssigneeRow(containerId, value));
  }

  window.addAssigneeRow = function (containerId, selected = "") {
    const host = document.getElementById(containerId);
    if (!host) return;
    const row = document.createElement("div");
    row.className = "wr-assignee-row";
    row.innerHTML = `<select class="form-input">${optionHtml(selected)}</select><button type="button" class="tbtn wr-icon-btn" title="담당자 삭제"><i class="ti ti-trash"></i></button>`;
    row.querySelector("button").onclick = () => {
      if (host.querySelectorAll(".wr-assignee-row").length <= 1) return showToast("담당자는 최소 한 명이어야 합니다.", "warn");
      row.remove();
    };
    host.appendChild(row);
  };

  function assigneesFrom(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .wr-assignee-row select`)).map((item) => item.value).filter(Boolean);
  }

  function ensureTodoEditFields() {
    const select = document.getElementById("editAssignee");
    if (!select || document.getElementById("editAssigneeEditor")) return;
    const block = select.parentElement;
    block.innerHTML = `<div class="form-label">담당자</div><select id="editAssignee" hidden></select><div id="editAssigneeEditor" class="wr-assignee-editor"></div><button type="button" class="tbtn wr-add-assignee" onclick="addAssigneeRow('editAssigneeEditor')"><i class="ti ti-user-plus"></i> 담당자 추가</button>`;
    const priority = document.createElement("div");
    priority.style.marginTop = "10px";
    priority.innerHTML = `<div class="form-label">업무 중요도</div><select class="form-input" id="editPriority"><option value="high">높음</option><option value="medium">중간</option><option value="low">낮음</option></select>`;
    block.after(priority);
  }

  function ensureIssueTodoAssignees() {
    const select = document.getElementById("tcAssignee");
    if (!select || document.getElementById("tcAssigneeEditor")) return;
    const block = select.parentElement;
    block.innerHTML = `<div class="form-label">담당자</div><select id="tcAssignee" hidden></select><div id="tcAssigneeEditor" class="wr-assignee-editor"></div><button type="button" class="tbtn wr-add-assignee" onclick="addAssigneeRow('tcAssigneeEditor')"><i class="ti ti-user-plus"></i> 담당자 추가</button>`;
  }

  function ensureRejectionModal() {
    if (document.getElementById("todoRejectReasonModal")) return;
    const modal = document.createElement("div");
    modal.id = "todoRejectReasonModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal slide-up" style="width:min(480px,92vw)" onclick="event.stopPropagation()">
      <div class="modal-title">Todo 반려 사유</div><div class="modal-sub">검토자가 다시 확인할 수 있도록 반려 사유를 입력하세요.</div>
      <textarea id="todoRejectReasonInput" class="form-input" rows="4" placeholder="반려 사유를 입력하세요"></textarea>
      <div class="modal-actions"><button class="tbtn" onclick="closeModal('todoRejectReasonModal')">취소</button><button class="tbtn primary" onclick="confirmTodoRejection()">확인</button></div>
    </div>`;
    document.body.appendChild(modal);
  }

  window.rejectTodo = function (id) {
    ensureRejectionModal();
    G.rejectReasonTarget = id;
    document.getElementById("todoRejectReasonInput").value = "";
    openModal("todoRejectReasonModal");
  };

  window.confirmTodoRejection = async function () {
    const reason = document.getElementById("todoRejectReasonInput")?.value.trim();
    const todo = todos.find((item) => item.id === G.rejectReasonTarget);
    if (!todo || !reason) return showToast("반려 사유를 입력하세요.", "warn");
    try {
      if (todo.apiId) await api(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "rejected" }) });
      const reasons = read(STORAGE.rejection, {});
      reasons[todoKey(todo)] = { reason, at: new Date().toISOString(), reviewer: memberName() };
      write(STORAGE.rejection, reasons);
      todo.status = "rejected";
      closeModal("todoRejectReasonModal");
      await window.opsRadarApi.loadTodos();
      switchTodoTab("rejected");
      showToast("반려 사유와 함께 반려 처리했습니다.", "warn");
    } catch (error) { showToast(`반려 저장에 실패했습니다. ${error.message || ""}`, "warn"); }
  };

  window.showTodoRejectionReason = function (id) {
    const todo = todos.find((item) => item.id === id);
    const data = read(STORAGE.rejection, {})[todoKey(todo)];
    alert(data ? `반려 사유: ${data.reason}\n검토자: ${data.reviewer || "-"}\n처리일: ${String(data.at || "").slice(0, 10)}` : "저장된 반려 사유가 없습니다.");
  };

  function roleAction(todo) {
    if (!isLead()) return "";
    if (todo.status === "pending") return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-approve" onclick="approveTodo(${todo.id})">승인</div><div class="ab ab-edit" onclick="openEditModal(${todo.id})">수정</div><div class="ab ab-reject" onclick="rejectTodo(${todo.id})">반려</div></div>`;
    if (todo.status === "approved") return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-approve" onclick="doneTodo(${todo.id})">완료</div><div class="ab ab-edit" onclick="openEditModal(${todo.id})">수정</div><div class="ab ab-undo" onclick="undoTodo(${todo.id})">↩</div></div>`;
    if (todo.status === "done") return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="restoreDoneTodo(${todo.id})">진행Todo로 되돌리기</div><div class="ab ab-reject" onclick="deleteDoneTodo(${todo.id})">삭제</div></div>`;
    return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="undoTodo(${todo.id})">되돌리기</div><div class="ab ab-reject" onclick="deleteRejectedTodo(${todo.id})">삭제</div><div class="ab ab-edit" onclick="showTodoRejectionReason(${todo.id})">반려 사유</div></div>`;
  }

  window.actionB = actionB = roleAction;
  const baseGetFilteredTodos = window.getFilteredTodos || getFilteredTodos;
  window.getFilteredTodos = getFilteredTodos = function () {
    const items = baseGetFilteredTodos();
    if (isLead()) return items;
    const name = memberName();
    return items.filter((todo) => extraAssignees(todo).includes(name));
  };
  window.toggleTodoRow = function (event, id) {
    if (event?.target?.closest(".action-btns, input, button, select, textarea, a")) return;
    selectTodo(id);
  };

  const baseOpenEdit = window.openEditModal;
  window.openEditModal = openEditModal = function (id) {
    ensureTodoEditFields();
    baseOpenEdit(id);
    const todo = todos.find((item) => item.id === id);
    ensureAssigneeEditor("editAssigneeEditor", todo);
    const priority = document.getElementById("editPriority");
    if (priority) priority.value = todo?.priority || "medium";
  };

  const baseSaveEdit = window.saveEdit;
  window.saveEdit = saveEdit = async function () {
    const todo = todos.find((item) => item.id === G.editTargetId);
    const assignees = assigneesFrom("editAssigneeEditor");
    if (!assignees.length) return showToast("담당자는 최소 한 명이어야 합니다.", "warn");
    saveExtraAssignees(todo, assignees);
    const priority = document.getElementById("editPriority")?.value || "medium";
    const legacy = document.getElementById("editAssignee");
    if (legacy) legacy.value = assignees[0];
    const title = document.getElementById("editTitle")?.value.trim();
    const description = document.getElementById("editDescription")?.value.trim() || "";
    const dueAt = document.getElementById("editDueDate")?.value || null;
    try {
      if (todo?.apiId) await api(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ title, description, assignee: assignees[0], priority, due_at: dueAt }) });
      Object.assign(todo, { title, description, assignee: assignees[0], priority, dueDate: dueAt });
      closeModal("editModal");
      await window.opsRadarApi.loadTodos();
      showToast("Todo를 수정했습니다.", "success");
    } catch (error) {
      if (typeof baseSaveEdit === "function") return baseSaveEdit();
      showToast("Todo 수정에 실패했습니다.", "warn");
    }
  };

  const baseOpenTodoCreate = window.openTodoCreate;
  window.openTodoCreate = openTodoCreate = function (issueId) {
    ensureIssueTodoAssignees();
    baseOpenTodoCreate(issueId);
    const issue = issues.find((item) => String(item.id) === String(issueId));
    ensureAssigneeEditor("tcAssigneeEditor", { assignee: issue?.assignee || issue?.suggestAssignee || names()[0] });
  };
  window.openDashboardTodoCreate = window.openTodoCreate;

  const baseConfirmTodoCreate = window.confirmTodoCreate;
  window.confirmTodoCreate = confirmTodoCreate = async function () {
    const assignees = assigneesFrom("tcAssigneeEditor");
    if (!assignees.length) return showToast("담당자는 최소 한 명이어야 합니다.", "warn");
    const legacy = document.getElementById("tcAssignee");
    if (legacy) legacy.value = assignees[0];
    return baseConfirmTodoCreate();
  };

  function applyRoleVisibility() {
    const lead = isLead();
    document.body.classList.toggle("wr-team-member", !lead);
    document.querySelector(".app-session-control")?.remove();
    document.querySelector(".ops-role-switch")?.remove();
    const aiTab = document.getElementById("t-ai-cnt")?.closest(".tab");
    if (aiTab) aiTab.style.display = lead ? "" : "none";
    const candidateTab = document.querySelector("#s-issues .tabs .tab[onclick*=\"'candidate'\"]");
    if (candidateTab) candidateTab.style.display = "";
    if (!lead) Array.from(document.querySelectorAll("#s-issues .topbar .tbtn")).find((item) => item.textContent.includes("수동 등록"))?.remove();
    const memberPanel = document.getElementById("memberAdminPanel");
    if (memberPanel) memberPanel.style.display = lead ? "" : "none";
    const reflect = Array.from(document.querySelectorAll("#resultSection .tbtn")).find((item) => item.textContent.includes("Dashboard 반영"));
    reflect?.remove();
    switchDbRole(lead ? "pm" : "member");
    if (!lead && G.currentTodoTab === "ai") switchTodoTab("inprogress");
  }
  window.applyWorkflowRoleVisibility = applyRoleVisibility;

  function renderMemberDashboard() {
    const name = memberName();
    if (!name) return;
    const mine = todos.filter((todo) => extraAssignees(todo).includes(name));
    const progress = mine.filter((todo) => todo.status === "approved");
    const done = mine.filter((todo) => todo.status === "done");
    const rejected = mine.filter((todo) => todo.status === "rejected");
    const pending = mine.filter((todo) => todo.status === "pending");
    const highRisks = issues.filter((issue) => issue.type === "confirmed" && issue.severity === "high" && issue.status !== "resolved");
    const total = mine.length;
    const ratio = (count) => total ? `${Math.round((count / total) * 100)}%` : "0%";
    const root = document.getElementById("db-member-view");
    if (!root) return;
    root.innerHTML = `<section><div class="ops-panel"><div class="ops-panel-title">나의 Todo 실행 현황</div><div class="ops-stat-row">
      <div onclick="nav('todo');switchTodoTab('inprogress')" style="cursor:pointer"><span class="ops-stat-num blue">${progress.length}</span><span class="ops-stat-label">진행중</span></div>
      <div onclick="nav('todo');switchTodoTab('rejected')" style="cursor:pointer"><span class="ops-stat-num warn">${rejected.length}</span><span class="ops-stat-label">반려</span></div>
      <div onclick="nav('todo');switchTodoTab('ai')" style="cursor:pointer"><span class="ops-stat-num">${pending.length}</span><span class="ops-stat-label">승인대기</span></div>
      </div><div class="ops-progress-stack"><div style="width:${ratio(done)};background:var(--success)" title="완료"></div><div style="width:${ratio(progress)};background:var(--accent-blue)" title="진행중"></div><div style="width:${ratio(rejected)};background:var(--warning)" title="반려"></div></div></div></section>
      <section><div class="ops-section-heading"><div><i class="ti ti-alert-triangle"></i> 진행 이슈</div><button class="ops-link-btn" onclick="nav('issues')">전체 이슈 보기 <i class="ti ti-arrow-right"></i></button></div><div class="ops-risk-grid">${highRisks.slice(0,3).map((issue)=>`<article class="ops-risk-card"><div class="ops-risk-card-top"><h3>${escapeHtml(issue.title)}</h3><span class="badge b-danger">HIGH</span></div><p>${escapeHtml(issue.desc || '설명이 없습니다.')}</p><div class="ops-risk-meta"><span>${escapeHtml(issue.status)}</span><span>${escapeHtml(issue.assignee || '담당자 미지정')}</span></div><div class="ops-domino"><strong>도미노 영향</strong><span>${escapeHtml(issue.dominoFinal || '운영 영향 분석 대기')}</span></div><div class="ops-card-actions"><button onclick="openTodoCreate(${JSON.stringify(issue.id)})">대응 Todo 생성</button><button onclick="openDashboardIssue(${JSON.stringify(issue.id)})">상세 보기</button></div></article>`).join("") || '<article class="ops-risk-card"><div class="ops-risk-card-top"><h3>High Risk 이슈 없음</h3><span class="badge b-success">안정</span></div><p>현재 확정된 High Risk 이슈가 없습니다.</p><div class="ops-card-actions"><button onclick="nav(\'issues\')">이슈 로그 보기</button></div></article>'}</div></section>
      <section class="ops-bottom-grid"><div class="ops-panel"><div class="ops-panel-title">진행중 Todo</div><div class="ops-approval-list">${progress.sort((a,b)=>({high:0,medium:1,low:2}[a.priority]??3)-({high:0,medium:1,low:2}[b.priority]??3)).slice(0,4).map((todo)=>`<div class="ops-approval-item" onclick="nav('todo');switchTodoTab('inprogress');selectTodo(${todo.id})"><div><strong>${escapeHtml(cleanTodoTitle(todo.title))}</strong><span>${escapeHtml(briefTodoText(todo))}</span></div><i class="ti ti-arrow-right"></i></div>`).join("") || '<div class="ops-approval-item" onclick="nav(\'todo\');switchTodoTab(\'inprogress\')"><div><strong>진행중 Todo 없음</strong><span>진행 Todo가 생성되면 표시됩니다.</span></div><i class="ti ti-arrow-right"></i></div>'}</div><div class="ops-muted-line">승인 대기 <span>${pending.length}</span>건</div></div></section>`;
  }

  const baseRenderDashboard = window.renderDashboardLive;
  window.renderDashboardLive = async function () {
    if (baseRenderDashboard) await baseRenderDashboard();
    applyRoleVisibility();
    renderMemberDashboard();
  };

  const baseRenderIssues = window.renderIssues;
  window.renderIssues = renderIssues = function () {
    baseRenderIssues();
    if (!isLead()) {
      document.querySelectorAll("#issueList .tbtn").forEach((button) => button.remove());
      const actions = document.getElementById("issueDetailActions");
      if (actions) actions.style.display = "none";
    }
  };

  const baseRenderTodoDetail = window.renderTodoDetail;
  window.renderTodoDetail = renderTodoDetail = function (id) {
    baseRenderTodoDetail(id);
    const todo = todos.find((item) => item.id === id);
    const content = document.getElementById("todoDetailContent");
    if (!content || !todo) return;
    Array.from(content.querySelectorAll(".detail-section")).forEach((heading) => {
      if (heading.textContent.trim() === "AI 분석 근거") {
        let sibling = heading.nextElementSibling;
        while (sibling?.classList.contains("detail-item")) {
          const next = sibling.nextElementSibling;
          sibling.remove();
          sibling = next;
        }
        heading.remove();
      }
      if (heading.textContent.trim() === "AI 추천 담당자") {
        const item = heading.nextElementSibling;
        if (item) item.innerHTML = `<i class="ti ti-user-check"></i><strong>${escapeHtml(todo.recommendedAssignee || todo.assignee || "미지정")}</strong>`;
      }
    });
    const body = content.firstElementChild;
    if (body && !body.querySelector(".wr-todo-source")) {
      body.insertAdjacentHTML("beforeend", `<div class="wr-todo-source">출처: ${escapeHtml(todo.src || todo.type || "수동 등록")}</div>`);
    }
    if (!isLead()) content.lastElementChild?.remove();
  };
  const baseRenderIssueDetail = window.renderIssueDetail;
  window.renderIssueDetail = renderIssueDetail = function (id) {
    baseRenderIssueDetail(id);
    if (!isLead()) {
      const actions = document.getElementById("issueDetailActions");
      if (actions) actions.style.display = "none";
    }
  };
  const baseSwitchIssueTab = window.switchIssueTab;
  window.switchIssueTab = switchIssueTab = function (tab) {
    return baseSwitchIssueTab(tab);
  };

  function ensureApprovalCenter() {
    document.getElementById("nav-approvals")?.remove();
    document.getElementById("s-approvals")?.remove();
    if (document.getElementById("analysisApprovalCenter")) return;
    const content = document.querySelector("#s-analysis .content");
    if (!content) return;
    const section = document.createElement("section");
    section.id = "analysisApprovalCenter";
    section.className = "wr-analysis-approval";
    section.innerHTML = `<div class="wr-analysis-approval-head"><div><strong>분석 승인 관리</strong><span>팀원이 전송한 분석 결과와 관리자 분석 결과를 검토합니다.</span></div><div class="wr-approval-tabs"><button id="approvalPendingTab" class="tbtn primary" onclick="openApprovalCenter('pending')">승인 대기함 <b id="approvalNavCount">0</b></button><button id="approvalDoneTab" class="tbtn" onclick="openApprovalCenter('done')">승인 완료함</button></div></div><div id="approvalCenterList" class="wr-approval-list"></div>`;
    content.prepend(section);
    section.style.display = isLead() ? "" : "none";
  }

  function approvalRecords() { return read(STORAGE.approvals, []); }
  function saveApprovalRecords(items) { write(STORAGE.approvals, items); }

  async function refreshApprovalRecordsFromServer() {
    if (!isLead()) return approvalRecords();
    try {
      const response = await api("/documents");
      const current = approvalRecords();
      const byId = new Map(current.map((item) => [String(item.id), item]));
      (response.documents || []).filter((doc) => doc.analysis_status === "completed").forEach((doc) => {
        const id = String(doc.id || doc.document_id);
        const existing = byId.get(id) || {};
        const todoItems = todos.filter((todo) => String(todo.src || "") === id).map((todo) => ({ ...todo }));
        const riskItems = issues.filter((issue) => String(issue.src || "") === id).map((issue) => ({ ...issue }));
        const pendingCount = Number(doc.pending_todo_count || 0) + Number(doc.pending_issue_count || 0);
        byId.set(id, {
          ...existing,
          id,
          title: doc.file_name,
          analyst: doc.uploaded_by || existing.analyst || "업로더 미지정",
          date: doc.created_at || existing.date,
          status: existing.status === "draft" ? "draft" : pendingCount > 0 ? "pending" : "done",
          todoCount: Number(doc.pending_todo_count || 0),
          riskCount: Number(doc.pending_issue_count || 0),
          blockedCount: Number(doc.blocked_count || 0),
          sourceDocument: doc.file_name,
          todoItems,
          riskItems,
        });
      });
      const merged = Array.from(byId.values()).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      saveApprovalRecords(merged);
      return merged;
    } catch (error) {
      console.warn("Approval documents load failed", error);
      return approvalRecords();
    }
  }

  function captureAnalysisApproval(result) {
    const recordId = result.documentId || String(G.lastAnalysisDocumentId || Date.now());
    const records = approvalRecords().filter((item) => String(item.id) !== String(recordId));
    records.unshift({
      id: recordId,
      title: document.getElementById("resultFname")?.textContent || "운영 로그 분석",
      analyst: memberName(),
      date: new Date().toISOString(),
      status: isLead() ? "pending" : "draft",
      todoCount: result.todos?.length || 0,
      riskCount: result.issues?.length || 0,
      blockedCount: [...(result.todos || []), ...(result.issues || [])].filter((item) => item.status === "blocked").length,
      evidence: document.getElementById("rChunkContent")?.textContent || "",
      sourceDocument: document.getElementById("rSrcDoc")?.textContent || "",
      sourceRange: document.getElementById("rSrcRange")?.textContent || "",
      aiReason: document.getElementById("rSrcReason")?.textContent || "",
      todoItems: (G.analysisTodoReview || []).map((item) => ({ ...item })),
      riskItems: (G.analysisRiskReview || []).map((item) => ({ ...item })),
    });
    saveApprovalRecords(records.slice(0, 100));
    updateApprovalCount();
  }

  function updateApprovalCount() {
    const count = approvalRecords().filter((item) => item.status === "pending").length;
    const badge = document.getElementById("approvalNavCount");
    if (badge) badge.textContent = count;
  }

  window.openApprovalCenter = async function (status = "pending") {
    if (!isLead()) return showToast("관리자만 승인함을 볼 수 있습니다.", "warn");
    nav("analysis");
    ensureApprovalCenter();
    await refreshApprovalRecordsFromServer();
    updateApprovalCount();
    document.getElementById("approvalPendingTab")?.classList.toggle("active", status === "pending");
    document.getElementById("approvalPendingTab")?.classList.toggle("primary", status === "pending");
    document.getElementById("approvalDoneTab")?.classList.toggle("active", status === "done");
    document.getElementById("approvalDoneTab")?.classList.toggle("primary", status === "done");
    const items = approvalRecords().filter((item) => item.status === status);
    document.getElementById("approvalCenterList").innerHTML = items.map((item) => `<article class="wr-approval-card"><div onclick="this.parentElement.classList.toggle('open')"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.analyst)} · ${String(item.date).slice(0,10)}</span><div class="wr-approval-counts"><b>Todo ${item.todoCount}</b><b>Risk ${item.riskCount}</b><b>Blocked ${item.blockedCount}</b></div></div><section><div class="wr-approval-evidence"><div><b>출처 문서</b><span>${escapeHtml(item.sourceDocument || item.title)}</span></div><div><b>관련 구간</b><span>${escapeHtml(item.sourceRange || "-")}</span></div><div><b>AI 판단 근거</b><span>${escapeHtml(item.aiReason || "AI 분석 결과")}</span></div></div><div class="form-label">출처 기반 추출 근거</div><p>${escapeHtml(item.evidence || "저장된 근거 없음")}</p><div class="modal-actions">${status === "pending" ? `<button class="tbtn" onclick="openApprovalReview('${item.id}','todo')">Todo 검토</button><button class="tbtn" onclick="openApprovalReview('${item.id}','risk')">리스크 검토</button>` : `<button class="tbtn" style="color:var(--danger)" onclick="deleteApproval('${item.id}')">삭제</button>`}</div></section></article>`).join("") || '<div class="chat-context-empty">항목이 없습니다.</div>';
  };
  window.deleteApproval = (id) => { if (!confirm("승인 완료 기록을 삭제하시겠습니까?")) return; saveApprovalRecords(approvalRecords().filter((row) => row.id !== id)); openApprovalCenter("done"); };
  window.openApprovalReview = function (id, kind) {
    const item = approvalRecords().find((row) => String(row.id) === String(id));
    if (!item) return;
    G.lastAnalysisDocumentId = item.id;
    G.analysisTodoReview = (item.todoItems || []).map((todo) => ({ ...todo }));
    G.analysisRiskReview = (item.riskItems || []).map((risk) => ({ ...risk }));
    G.analysisTodoChecked = Object.fromEntries(G.analysisTodoReview.map((todo) => [todoKey(todo), true]));
    G.analysisRiskChecked = Object.fromEntries(G.analysisRiskReview.map((risk) => [issueKey(risk), true]));
    kind === "todo" ? openAnalysisTodoReview() : openAnalysisRiskReview();
  };

  function syncCurrentApprovalAfterReview() {
    const id = String(G.lastAnalysisDocumentId || "");
    if (!id) return;
    const records = approvalRecords();
    const item = records.find((row) => String(row.id) === id);
    if (!item) return;
    item.todoCount = (G.analysisTodoReview || []).length;
    item.riskCount = (G.analysisRiskReview || []).length;
    item.todoItems = (G.analysisTodoReview || []).map((todo) => ({ ...todo }));
    item.riskItems = (G.analysisRiskReview || []).map((risk) => ({ ...risk }));
    if (item.todoCount === 0 && item.riskCount === 0) item.status = "done";
    saveApprovalRecords(records);
    updateApprovalCount();
  }

  function wrapReviewActions() {
    ["moveCheckedAnalysisTodosToProgress", "deleteCheckedAnalysisTodos", "moveCheckedAnalysisRisksToConfirmed", "deleteCheckedAnalysisRisks"].forEach((name) => {
      const original = window[name];
      if (typeof original !== "function" || original.__wrApprovalWrapped) return;
      const wrapped = async (...args) => {
        const result = await original(...args);
        syncCurrentApprovalAfterReview();
        return result;
      };
      wrapped.__wrApprovalWrapped = true;
      window[name] = wrapped;
    });
  }

  function wrapAnalysis() {
    const original = window.opsRadarApi?.runDocumentAnalysis;
    if (!original || original.__wrWrapped) return;
    const wrapped = async (...args) => {
      const result = await original(...args);
      captureAnalysisApproval(result);
      configureAnalysisResultForRole();
      if (isLead()) openApprovalCenter("pending");
      return result;
    };
    wrapped.__wrWrapped = true;
    window.opsRadarApi.runDocumentAnalysis = wrapped;
    const start = window.startAnalysis;
    if (typeof start === "function" && !start.__wrApprovalWrapped) {
      const wrappedStart = async (...args) => {
        const result = await start(...args);
        if (G.lastAnalysisDocumentId) {
          captureAnalysisApproval({
            documentId: G.lastAnalysisDocumentId,
            todos: G.analysisTodoReview || [],
            issues: G.analysisRiskReview || [],
          });
          configureAnalysisResultForRole();
          if (isLead()) openApprovalCenter("pending");
        }
        return result;
      };
      wrappedStart.__wrApprovalWrapped = true;
      window.startAnalysis = startAnalysis = wrappedStart;
    }
  }

  function applyCalendarControls() {
    const suggest = Array.from(document.querySelectorAll("#s-calendar .topbar .tbtn")).find((item) => item.textContent.includes("AI 추천 일정"));
    suggest?.remove();
    const insight = document.getElementById("calAIText")?.parentElement;
    if (insight) {
      insight.id = "wrCalendarMonthNav";
      insight.className = "wr-calendar-month-nav";
      insight.innerHTML = `<button id="calPrevBtn" class="tbtn" onclick="goToPrevMonth()">← 이전 달</button><div id="calMonthTitle" class="chip">현재 월</div><button id="calNextBtn" class="tbtn" onclick="goToNextMonth()">다음 달 →</button>`;
      if (typeof updateCalendarHeader === 'function') updateCalendarHeader();
    }
    const topbarControls = document.querySelector("#s-calendar .topbar > div:last-child");
    if (topbarControls) topbarControls.style.display = "none";
    const settings = document.querySelector("#s-settings .settings-content");
    if (settings && !document.getElementById("calendarPreferencePanel")) {
      const panel = document.createElement("section");
      panel.id = "calendarPreferencePanel";
      panel.className = "settings-panel";
      panel.innerHTML = `<div class="settings-card-inner"><div class="settings-panel-head"><div><div class="settings-eyebrow">Calendar</div><h3>캘린더 일정</h3><p class="settings-panel-sub">표시할 담당자와 Todo 상태를 선택합니다.</p></div></div><div id="calendarMemberPrefs" class="wr-pref-grid"></div><div class="wr-pref-grid"><label><input type="checkbox" data-cal-status="approved" checked> 진행 Todo</label><label><input type="checkbox" data-cal-status="done" checked> 완료 Todo</label></div></div>`;
      settings.appendChild(panel);
      const host = panel.querySelector("#calendarMemberPrefs");
      host.innerHTML = names().map((name) => `<label><input type="checkbox" data-cal-member="${escapeHtml(name)}" checked> ${escapeHtml(name)}</label>`).join("");
      panel.querySelectorAll("input").forEach((input) => input.onchange = saveCalendarPreferences);
    }
  }

  function updatePersonalTodoCounts() {
    const scoped = isLead() ? todos : todos.filter((todo) => extraAssignees(todo).includes(memberName()));
    const values = {
      "t-ai-cnt": scoped.filter((todo) => todo.status === "pending").length,
      "t-in-cnt": scoped.filter((todo) => todo.status === "approved").length,
      "t-done-cnt": scoped.filter((todo) => todo.status === "done").length,
      "t-rej-cnt": scoped.filter((todo) => todo.status === "rejected").length,
    };
    Object.entries(values).forEach(([id, count]) => { const element = document.getElementById(id); if (element) element.textContent = count; });
    const pending = document.getElementById("pendingCount");
    if (pending) pending.textContent = values["t-ai-cnt"];
  }

  const baseUpdateTodoCounts = window.updateTodoCounts;
  window.updateTodoCounts = updateTodoCounts = function () {
    if (baseUpdateTodoCounts) baseUpdateTodoCounts();
    updatePersonalTodoCounts();
  };

  function configureAnalysisResultForRole() {
    const result = document.getElementById("resultSection");
    if (!result) return;
    result.querySelectorAll(".wr-member-analysis-actions").forEach((item) => item.remove());
    const cards = result.querySelector(".three-col");
    const actions = result.querySelector(".three-col")?.parentElement?.querySelector("div[style*='margin-top:14px']");
    if (isLead()) {
      if (cards) cards.style.pointerEvents = "";
      if (actions) actions.style.display = "";
      return;
    }
    if (cards) {
      cards.style.pointerEvents = "none";
      cards.querySelectorAll("div[style*='font-size:9px']").forEach((label) => { label.textContent = "팀장 검토 대상"; });
    }
    if (actions) actions.style.display = "none";
    result.insertAdjacentHTML("beforeend", `<div class="wr-member-analysis-actions"><div class="wr-member-analysis-note">분석 결과를 팀장에게 전송하면 승인 대기함에서 Todo와 리스크를 검토합니다.</div><button class="tbtn primary" onclick="sendCurrentAnalysisToLead()"><i class="ti ti-send"></i> 팀장에게 전송</button><button class="tbtn" onclick="discardCurrentAnalysis()" style="color:var(--danger)"><i class="ti ti-trash"></i> 삭제 후 다른 파일 추출</button></div>`);
  }

  window.sendCurrentAnalysisToLead = function () {
    const records = approvalRecords();
    const item = records.find((row) => String(row.id) === String(G.lastAnalysisDocumentId || ""));
    if (!item) return showToast("전송할 분석 결과를 찾지 못했습니다.", "warn");
    item.status = "pending";
    item.sentAt = new Date().toISOString();
    saveApprovalRecords(records);
    configureAnalysisResultForRole();
    showToast("분석 결과를 팀장 승인 대기함으로 전송했습니다.", "success");
  };

  window.discardCurrentAnalysis = async function () {
    if (!confirm("현재 분석 결과와 추출된 Todo·리스크 후보를 삭제하고 다른 파일을 분석하시겠습니까?")) return;
    const record = approvalRecords().find((row) => String(row.id) === String(G.lastAnalysisDocumentId || ""));
    try {
      await Promise.all((record?.todoItems || []).filter((item) => item.apiId).map((item) => api(`/todos/${item.apiId}`, { method: "DELETE" })));
      await Promise.all((record?.riskItems || []).filter((item) => item.apiId).map((item) => api(`/issues/${item.apiId}`, { method: "DELETE" })));
      saveApprovalRecords(approvalRecords().filter((row) => String(row.id) !== String(G.lastAnalysisDocumentId || "")));
      G.analysisTodoReview = [];
      G.analysisRiskReview = [];
      if (typeof resetFlow === "function") resetFlow(); else resetUpload();
      await window.opsRadarApi.reload();
      showToast("분석 결과를 삭제했습니다.", "info");
    } catch (error) { showToast("분석 결과 삭제에 실패했습니다.", "warn"); }
  };

  function saveCalendarPreferences() {
    const members = Array.from(document.querySelectorAll("[data-cal-member]:checked")).map((input) => input.dataset.calMember);
    const statuses = Array.from(document.querySelectorAll("[data-cal-status]:checked")).map((input) => input.dataset.calStatus);
    write(STORAGE.calendar, { members, statuses });
    if (typeof syncTodoCalendar === "function") syncTodoCalendar();
  }

  function applyCalendarPreferences() {
    const preferences = read(STORAGE.calendar, {});
    const activeMembers = names();
    if (!activeMembers.length) return;
    const selectedMembers = (preferences.members || []).filter((name) => activeMembers.includes(name));
    const allowedMembers = new Set(selectedMembers.length ? selectedMembers : activeMembers);
    const allowedStatuses = new Set(["approved", "done"]);
    (G.calEvents || []).forEach((event) => {
      event.tags = (event.tags || []).filter((tag) => {
        if (!tag.todoId) return true;
        const todo = todos.find((item) => item.id === tag.todoId);
        return todo && allowedStatuses.has(todo.status) && extraAssignees(todo).some((name) => allowedMembers.has(name));
      });
    });
  }

  const baseSyncCalendar = window.syncTodoCalendar;
  if (typeof baseSyncCalendar === "function") {
    window.syncTodoCalendar = syncTodoCalendar = function () {
      const result = baseSyncCalendar();
      applyCalendarPreferences();
      if (G.currentScreen === "calendar" && typeof renderCalendar === "function") renderCalendar(G.currentCalYear, G.currentCalMonth);
      return result;
    };
  }

  function init() {
    ensureTodoEditFields();
    ensureIssueTodoAssignees();
    ensureRejectionModal();
    ensureApprovalCenter();
    applyCalendarControls();
    applyRoleVisibility();
    wrapAnalysis();
    wrapReviewActions();
    updateApprovalCount();
    updatePersonalTodoCounts();
    renderMemberDashboard();
    if (typeof renderTodos === "function") renderTodos();
    if (typeof renderIssues === "function") renderIssues();
    configureAnalysisResultForRole();
  }
  setTimeout(init, 700);
  setTimeout(init, 2500);
})();
