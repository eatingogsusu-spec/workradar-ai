(function () {
  const PAGE_SIZE = 7;
  const api = (path, options = {}) => window.opsRadarApi.request(path, options);
  const session = () => {
    try { return JSON.parse(localStorage.getItem("opsradar_session") || "{}"); } catch (_) { return {}; }
  };
  const actor = () => session().user || {};
  const LEAD_ROLES = ["admin", "pm", "leader", "lead", "시스템 관리자"];
  const isLead = () => {
    const a = actor();
    if (a.username === "hj" || a.username === "admin") return true;
    if (LEAD_ROLES.includes(String(a.role || "").toLowerCase())) return true;
    const stored = (
      localStorage.getItem("opsradar_user_role") ||
      localStorage.getItem("role") ||
      ""
    ).toLowerCase();
    if (LEAD_ROLES.includes(stored)) return true;
    if (G.workflowReview?.role) return LEAD_ROLES.includes(G.workflowReview.role.toLowerCase());
    if (document.getElementById("db-tab-pm")?.classList.contains("active")) return true;
    const isMemberTab = document.getElementById("db-tab-member")?.classList.contains("active");
    return !isMemberTab;
  };
  const memberName = () => actor().name || "";
  const keyOf = (item) => String(item?.apiId || item?.id || "");
  const esc = (value) => escapeHtml(String(value ?? ""));
  const due = (item) => item?.due_at ? String(item.due_at).slice(0, 10) : item?.dueDate || recommendedDue(item);
  const description = (item) => item?.description || item?.desc || item?.reason || `${item?.title || "업무"} 수행 범위와 완료 기준을 확인합니다.`;
  const members = () => (window.opsRadarMembers || []).filter((item) => (item.status || "active") === "active");
  const assigneeOptions = (selected) => [`<option value="">미지정</option>`, ...members().map((item) => `<option value="${esc(item.name)}" ${item.name === selected ? "selected" : ""}>${esc(item.name)}</option>`)].join("");

  function recommendedDue(item) {
    const date = new Date();
    const level = item?.priority || item?.severity || item?.level || "medium";
    date.setDate(date.getDate() + ({ critical: 1, high: 3, medium: 7, low: 14 }[level] || 7));
    return date.toISOString().slice(0, 10);
  }

  function hasAuthToken() {
    if (localStorage.getItem("access_token") || localStorage.getItem("token")) return true;
    try {
      const storedSession = JSON.parse(localStorage.getItem("opsradar_session") || "null");
      if (storedSession?.access_token || storedSession?.token) return true;
    } catch (_) {}
    try {
      return Boolean(JSON.parse(localStorage.getItem("auth") || "null")?.token);
    } catch (_) {
      return false;
    }
  }

  async function loadWorkflow() {
    if (!hasAuthToken()) {
      G.workflowReview = { todo_drafts: [], pending_todos: [], risk_drafts: [], pending_risks: [] };
      return G.workflowReview;
    }
    try {
      G.workflowReview = await api("/workflow/review");
    } catch (error) {
      console.warn("workflow review load failed", error);
      G.workflowReview = { todo_drafts: [], pending_todos: [], risk_drafts: [], pending_risks: [] };
    }
    return G.workflowReview;
  }

  window.downloadSource = async function (documentId, fileName) {
    if (!documentId) return showToast("다운로드할 출처 파일이 없습니다.", "warn");
    try {
      const response = await fetch(`/api/v1/documents/${encodeURIComponent(documentId)}/download`);
      if (!response.ok) throw new Error("source unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cd = response.headers.get("content-disposition") || "";
      const cdName = cd.match(/filename\*=UTF-8''([^\s;]+)/i)?.[1]
        || cd.match(/filename="?([^";]+)"?/i)?.[1];
      link.download = cdName ? decodeURIComponent(cdName) : (fileName || "source");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) { showToast("출처 파일이 삭제되었거나 다운로드할 수 없습니다.", "warn"); }
  };

  function reviewCard(item, index, kind) {
    const isTodo = kind === "todo";
    const checked = (isTodo ? G.analysisTodoChecked : G.analysisRiskChecked)?.[keyOf(item)] !== false;
    const accent = isTodo ? "var(--accent)" : "var(--danger)";
    return `<article class="wr-review-item">
      <input type="checkbox" ${checked ? "checked" : ""} onchange="${isTodo ? "toggleAnalysisTodoChecked" : "toggleAnalysisRiskChecked"}('${esc(keyOf(item))}',this.checked)" style="accent-color:${accent}">
      <div class="wr-review-fields">
        <label><span>제목</span><input class="form-input" value="${esc(item.title)}" oninput="${isTodo ? "updateAnalysisTodoField" : "updateAnalysisRiskField"}(${index},'title',this.value)"></label>
        <label><span>업무 내용</span><textarea class="form-input" rows="3" oninput="${isTodo ? "updateAnalysisTodoField" : "updateAnalysisRiskField"}(${index},'description',this.value)">${esc(description(item))}</textarea></label>
      </div>
      <div class="wr-review-meta">
        <label><span>추천 담당자</span><select class="form-input" onchange="${isTodo ? "updateAnalysisTodoField" : "updateAnalysisRiskField"}(${index},'assignee',this.value)">${assigneeOptions(item.assignee || item.recommendedAssignee || "")}</select></label>
        <label><span>AI 추천 마감일</span><input class="form-input" type="date" value="${esc(due(item))}" onchange="${isTodo ? "updateAnalysisTodoField" : "updateAnalysisRiskField"}(${index},'due_at',this.value)"></label>
      </div>
    </article>`;
  }

  window.renderAnalysisTodoReview = renderAnalysisTodoReview = function () {
    const list = document.getElementById("analysisTodoList");
    const items = Array.isArray(G.analysisTodoReview) ? G.analysisTodoReview : [];
    if (list) list.innerHTML = items.length ? items.map((item, index) => reviewCard(item, index, "todo")).join("") : '<div class="wr-empty">남은 Todo 후보가 없습니다.</div>';
    updateAnalysisTodoCheckedCount();
    syncAnalysisCounts();
  };
  window.renderAnalysisRiskReview = renderAnalysisRiskReview = function () {
    const list = document.getElementById("analysisRiskList");
    const items = Array.isArray(G.analysisRiskReview) ? G.analysisRiskReview : [];
    if (list) list.innerHTML = items.length ? items.map((item, index) => reviewCard(item, index, "risk")).join("") : '<div class="wr-empty">남은 Risk 후보가 없습니다.</div>';
    updateAnalysisRiskCheckedCount();
    syncAnalysisCounts();
  };
  window.updateAnalysisRiskField = function (index, field, value) {
    if (G.analysisRiskReview?.[index]) G.analysisRiskReview[index][field] = value;
  };

  function relabelReviewActions() {
    const todoPrimary = document.querySelector("#analysisTodoModal .modal-actions .primary");
    const riskPrimary = document.querySelector("#analysisRiskModal .modal-actions .primary");
    if (todoPrimary) {
      todoPrimary.innerHTML = `<i class="ti ti-send"></i> ${isLead() ? "진행 Todo" : "관리자에게 Todo 전송"}`;
      todoPrimary.onclick = isLead() ? moveCheckedAnalysisTodosToProgress : sendCheckedTodosToLead;
    }
    if (riskPrimary) {
      riskPrimary.innerHTML = `<i class="ti ti-send"></i> ${isLead() ? "확정 이슈로 이동" : "관리자에게 Risk 전송"}`;
      riskPrimary.onclick = isLead() ? moveCheckedAnalysisRisksToConfirmed : sendCheckedRisksToLead;
    }
  }

  window.sendCheckedTodosToLead = async function () {
    const selected = selectedReviewItems("todo");
    if (!selected.length) return showToast("선택된 Todo가 없습니다.", "info");
    const items = Object.fromEntries(selected.map((item) => [keyOf(item), {
      title: item.title, description: description(item), assignee: item.assignee || item.recommendedAssignee || null,
      priority: item.priority || "medium", due_at: due(item),
    }]));
    try {
      const result = await api("/workflow/todos/send", { method: "POST", body: JSON.stringify({ items }) });
      await refreshWorkflowViews();
      G.analysisTodoReview = (G.workflowReview?.todo_drafts || []).map((item) => ({ ...item, apiId: item.id }));
      renderAnalysisTodoReview();
      if (!G.analysisTodoReview.length) closeModal("analysisTodoModal");
      showToast(`${result.sent || selected.length}개 Todo를 관리자 승인 대기로 전송했습니다.`, "success");
    } catch (error) { showToast(`Todo 전송에 실패했습니다. ${error.message || ""}`, "warn"); }
  };

  window.sendCheckedRisksToLead = async function () {
    const selected = selectedReviewItems("risk");
    if (!selected.length) return showToast("선택된 Risk가 없습니다.", "info");
    const items = Object.fromEntries(selected.map((item) => [keyOf(item), {
      title: item.title, description: description(item), assignee: item.assignee || null,
      severity: item.severity || item.level || "medium", due_at: due(item),
    }]));
    await api("/workflow/risks/send", { method: "POST", body: JSON.stringify({ items }) });
    await refreshWorkflowViews();
    G.analysisRiskReview = (G.workflowReview?.risk_drafts || []).map((item) => ({ ...item, apiId: item.id }));
    renderAnalysisRiskReview();
    if (!G.analysisRiskReview.length) closeModal("analysisRiskModal");
    showToast(`${selected.length}개 Risk를 관리자에게 전송했습니다.`, "success");
  };

  function removeReviewed(selected, kind) {
    const keys = new Set(selected.map(keyOf));
    if (kind === "todo") {
      G.analysisTodoReview = (G.analysisTodoReview || []).filter((item) => !keys.has(keyOf(item)));
      renderAnalysisTodoReview();
      if (!G.analysisTodoReview.length) closeModal("analysisTodoModal");
    } else {
      G.analysisRiskReview = (G.analysisRiskReview || []).filter((item) => !keys.has(keyOf(item)));
      renderAnalysisRiskReview();
      if (!G.analysisRiskReview.length) closeModal("analysisRiskModal");
    }
  }

  function selectedReviewItems(kind) {
    const items = kind === "todo" ? G.analysisTodoReview || [] : G.analysisRiskReview || [];
    const checked = kind === "todo" ? G.analysisTodoChecked || {} : G.analysisRiskChecked || {};
    return items.filter((item) => checked[keyOf(item)] !== false && keyOf(item));
  }

  window.deleteCheckedAnalysisTodos = async function () {
    const selected = selectedReviewItems("todo");
    if (!selected.length) return showToast("선택된 Todo가 없습니다.", "info");
    try {
      await Promise.all(selected.map((item) => api(`/todos/${keyOf(item)}`, { method: "DELETE" })));
      await refreshWorkflowViews();
      G.analysisTodoReview = (G.workflowReview?.todo_drafts || []).map((item) => ({ ...item, apiId: item.id }));
      renderAnalysisTodoReview();
      if (!G.analysisTodoReview.length) closeModal("analysisTodoModal");
      showToast(`${selected.length}개 Todo를 삭제했습니다.`, "success");
    } catch (error) { console.warn("Todo review delete failed", error); showToast(`Todo 삭제에 실패했습니다. ${error.message || ""}`, "warn"); }
  };
  window.deleteCheckedAnalysisRisks = async function () {
    const selected = selectedReviewItems("risk");
    if (!selected.length) return showToast("선택된 Risk가 없습니다.", "info");
    try {
      await Promise.all(selected.map((item) => api(`/issues/${keyOf(item)}`, { method: "DELETE" })));
      await refreshWorkflowViews();
      G.analysisRiskReview = (G.workflowReview?.risk_drafts || []).map((item) => ({ ...item, apiId: item.id }));
      renderAnalysisRiskReview();
      if (!G.analysisRiskReview.length) closeModal("analysisRiskModal");
      showToast(`${selected.length}개 Risk를 삭제했습니다.`, "success");
    } catch (error) { console.warn("Risk review delete failed", error); showToast(`Risk 삭제에 실패했습니다. ${error.message || ""}`, "warn"); }
  };

  async function refreshWorkflowViews() {
    await loadWorkflow();
    if (window.opsRadarApi?.reload) await window.opsRadarApi.reload();
    configureRoleScreen();
    if (G.currentIssueTab === "pending") renderPendingIssues();
    if (G.currentIssueTab === "resolved") renderResolvedIssues();
  }

  function queueDetail(item, kind) {
    const source = item.document_id ? `<button class="wr-source-link" onclick="downloadSource('${esc(item.document_id)}')"><i class="ti ti-download"></i>${esc(item.source_file_name || "출처 파일")}</button>` : "<span>출처 파일 없음</span>";
    return `<div class="wr-queue-detail"><div><b>업무 내용</b><p>${esc(description(item))}</p></div><div class="wr-queue-meta"><span>담당자 <b>${esc(item.assignee || "미지정")}</b></span><span>마감일 <b>${esc(due(item))}</b></span><span>전송자 <b>${esc(item.sent_by || "-")}</b></span></div><div><b>출처</b>${source}</div></div>`;
  }

  function queueRow(item, kind) {
    const todo = kind === "todo";
    return `<article class="wr-queue-row" id="queue-${esc(kind)}-${esc(item.id)}">
      <div class="wr-queue-head" onclick="this.parentElement.classList.toggle('open')"><strong>${esc(item.title)}</strong><span>${esc(item.sent_by || "팀원")} · ${esc(String(item.updated_at || item.created_at || "").slice(0,10))}</span>
      <div class="wr-queue-actions" onclick="event.stopPropagation()"><button class="tbtn primary" onclick="${todo ? "approvePendingTodo" : "approvePendingRisk"}('${esc(item.id)}')">${todo ? "승인" : "이슈 확정"}</button><button class="tbtn" onclick="editPendingItem('${esc(kind)}','${esc(item.id)}')">수정</button><button class="tbtn danger" onclick="rejectPendingItem('${esc(kind)}','${esc(item.id)}')">반려</button></div></div>${queueDetail(item, kind)}</article>`;
  }

  function ensureQueues() {
    const old = document.getElementById("analysisApprovalCenter");
    old?.remove();
    const content = document.querySelector("#s-analysis .content");
    if (!content || document.getElementById("workflowQueueCenter")) return;
    const section = document.createElement("section");
    section.id = "workflowQueueCenter";
    section.className = "wr-queue-center";
    section.innerHTML = `<div class="wr-queue-tabs"><button class="tbtn primary" onclick="showWorkflowQueue('todo')">승인 대기중 Todo <b id="workflowTodoCount">0</b></button><button class="tbtn" onclick="showWorkflowQueue('risk')">승인 대기중 Risk <b id="workflowRiskCount">0</b></button></div><div id="workflowQueueList"></div>`;
    content.prepend(section);
  }

  window.showWorkflowQueue = function (kind = "todo") {
    G.workflowQueueKind = kind;
    const review = G.workflowReview || {};
    const items = kind === "todo" ? review.pending_todos || [] : review.pending_risks || [];
    document.getElementById("workflowQueueList").innerHTML = items.map((item) => queueRow(item, kind)).join("") || '<div class="wr-empty">승인 대기 항목이 없습니다.</div>';
    document.querySelectorAll(".wr-queue-tabs .tbtn").forEach((button, index) => button.classList.toggle("primary", index === (kind === "todo" ? 0 : 1)));
  };
  window.openApprovalCenter = function () {
    document.getElementById("analysisApprovalCenter")?.remove();
    document.getElementById("workflowQueueCenter")?.remove();
  };

  window.approvePendingTodo = async function (id) {
    await api(`/todos/${id}`, { method: "PATCH", body: JSON.stringify({ status: "in_progress", approval_status: "approved" }) });
    await refreshWorkflowViews(); if (G.currentTodoTab === "ai") renderTodos(); showToast("진행 Todo로 승인했습니다.", "success");
  };
  window.approvePendingRisk = async function (id) {
    await api(`/issues/${id}`, { method: "PATCH", body: JSON.stringify({ approval_status: "approved", status: "open" }) });
    await refreshWorkflowViews(); if (G.currentIssueTab === "candidate") renderPendingRisks(); showToast("확정 이슈로 이동했습니다.", "success");
  };
  window.rejectPendingItem = async function (kind, id) {
    const reason = prompt("반려 사유를 입력하세요.");
    if (!reason) return;
    if (kind === "risk") {
      const workflowItem = G.workflowReview?.pending_risks?.find((row) => String(row.id) === String(id));
      if (workflowItem) await api(`/workflow/risks/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
      else await api(`/issues/${id}`, { method: "PATCH", body: JSON.stringify({ approval_status: "rejected" }) });
    }
    else await api(`/todos/${id}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "rejected" }) });
    await refreshWorkflowViews();
    if (kind === "risk" && G.currentIssueTab === "candidate") renderPendingRisks();
    if (kind === "todo" && G.currentTodoTab === "ai") renderTodos();
    showToast("반려 처리했습니다.", "warn");
  };
  window.editPendingItem = async function (kind, id) {
    const source = kind === "todo" ? G.workflowReview?.pending_todos : G.workflowReview?.pending_risks;
    const item = source?.find((row) => String(row.id) === String(id))
      || (kind === "risk" && typeof issues !== "undefined"
        ? issues.find((row) => String(row.apiId || row.id) === String(id))
        : null);
    if (!item) return;
    const title = prompt("제목", item.title);
    if (!title) return;
    const detail = prompt("내용", description(item));
    if (detail === null) return;
    const dueAt = prompt("마감일 (YYYY-MM-DD)", due(item));
    if (dueAt === null) return;
    await api(`/${kind === "todo" ? "todos" : "issues"}/${id}`, { method: "PATCH", body: JSON.stringify({ title, description: detail, due_at: dueAt }) });
    await loadWorkflow();
    showToast("검토 항목을 수정했습니다.", "success");
    if (kind === "risk" && G.currentIssueTab === "candidate") renderPendingRisks();
    if (kind === "todo" && G.currentTodoTab === "ai") renderTodos();
  };

  function configureRoleScreen() {
    relabelReviewActions();
    const cards = document.querySelector("#resultSection .three-col");
    if (cards) { cards.style.pointerEvents = ""; cards.style.opacity = "1"; }
    const upload = ["uploadSection", "analysisGuide", "analysisSection", "resultSection"].map((id) => document.getElementById(id));
    ensureQueues();
    const queue = document.getElementById("workflowQueueCenter");
    if (queue) queue.remove();
    if (isLead()) {
      upload.forEach((node) => { if (node && ["uploadSection", "analysisGuide"].includes(node.id)) node.style.display = ""; });
    } else {
      const aiTab = document.getElementById("t-ai-cnt")?.closest(".tab");
      if (aiTab) { aiTab.style.display = ""; aiTab.childNodes[0].nodeValue = "승인 대기중 Todo "; }
    }
    configureTodoTabs();
    ensureIssueResolvedTab();
    ensureIssueRejectedTab();
    configureIssueTabs();
    removeObsoleteAnalysisUi();
    relocateCalendarPreferences();
  }

  function configureTodoTabs() {
    const tabs = document.getElementById("todoTabs");
    if (!tabs) return;
    document.getElementById("adminFileAnalysisTab")?.remove();
    const tabBadgeIds = { inprogress: "t-in-cnt", ai: "t-ai-cnt", done: "t-done-cnt", rejected: "t-rej-cnt" };
    const byTab = (tab) => document.getElementById(tabBadgeIds[tab])?.closest(".tab");
    const labels = { inprogress: "진행 Todo", done: "완료", rejected: "반려", ai: "승인 대기 Todo" };
    ["inprogress", "done", "rejected", "ai"].forEach((tab) => {
      const node = byTab(tab); if (!node) return;
      const badge = node.querySelector(".badge");
      node.childNodes[0].nodeValue = `${labels[tab]} `;
      node.appendChild(badge);
      tabs.appendChild(node);
    });
    ensureAllTodoToggle();
  }

  function configureIssueTabs() {
    const tabs = document.querySelector("#s-issues .tabs");
    if (!tabs || !isLead()) return;
    const resolved = tabs.querySelector(".tab[onclick*=\"'resolved'\"]") || document.getElementById("issueResolvedTab");
    const rejected = document.getElementById("issueRejectedTab");
    const pending = tabs.querySelector(".tab[onclick*=\"'candidate'\"]");
    [resolved, rejected, pending].filter(Boolean).forEach((node) => tabs.appendChild(node));
  }

  function removeObsoleteAnalysisUi() {
    document.querySelectorAll(".wr-member-analysis-actions:not(.wr-discard-analysis)").forEach((node) => node.remove());
    ["rSrcRange", "rSrcReason"].forEach((id) => document.getElementById(id)?.closest("div[style*='display:flex']")?.remove());
    const footer = document.querySelector("#resultSection > div:last-child");
    if (footer) {
      Array.from(footer.children).filter((node) => node.textContent.includes("Dashboard 반영")).forEach((node) => node.remove());
      Array.from(footer.children).forEach((node) => {
        if (node.textContent.includes("Todo 확인")) node.onclick = () => { nav("todo"); switchTodoTab("inprogress"); };
        if (node.textContent.includes("이슈 확인")) node.onclick = () => { nav("issues"); switchIssueTab("inprogress"); };
      });
    }
    if (!isLead()) {
      const result = document.getElementById("resultSection");
      if (result && !result.querySelector(".wr-discard-analysis")) result.insertAdjacentHTML("beforeend", `<div class="wr-member-analysis-actions wr-discard-analysis"><button class="tbtn" onclick="startAnotherAnalysis()"><i class="ti ti-plus"></i> 다른 파일 추출</button></div>`);
    }
    syncAnalysisCounts();
  }

  window.startAnotherAnalysis = function () {
    if (typeof resetFlow === "function") resetFlow(); else if (typeof resetUpload === "function") resetUpload();
    const input = document.querySelector("#uploadSection input[type='file']");
    input?.click();
  };

  function syncAnalysisCounts() {
    const todoCount = (G.analysisTodoReview || []).length;
    const riskCount = (G.analysisRiskReview || []).length;
    const todo = document.getElementById("rTodo");
    const risk = document.getElementById("rIssue");
    if (todo) todo.textContent = todoCount;
    if (risk) risk.textContent = riskCount;
  }

  function ensureAllTodoToggle() {
    const tools = document.querySelector("#s-todo .todo-list-tools");
    if (isLead() || !tools || document.getElementById("allTodoToggle")) return;
    const label = document.createElement("label");
    label.id = "allTodoToggle";
    label.className = "wr-all-todo-toggle";
    label.innerHTML = `<input type="checkbox"> 전체 Todo 보기`;
    label.querySelector("input").onchange = (event) => { G.showAllTodos = event.target.checked; renderTodos(); updateTodoCounts(); };
    tools.appendChild(label);
  }

  const baseSwitchTodo = window.switchTodoTab;
  window.switchTodoTab = switchTodoTab = function (tab) {
    G.todoChecked = {};
    const result = baseSwitchTodo(tab);
    const tabBadgeIds = { inprogress: "t-in-cnt", ai: "t-ai-cnt", done: "t-done-cnt", rejected: "t-rej-cnt" };
    Object.entries(tabBadgeIds).forEach(([key, badgeId]) => {
      document.getElementById(badgeId)?.closest(".tab")?.classList.toggle("active", key === tab);
    });
    const show = (id, visible) => { const el = document.getElementById(id); if (el) el.style.display = visible ? "flex" : "none"; };
    show("todoBulkDeleteBtn",          ["done", "rejected", "inprogress"].includes(tab));
    show("todoBulkRejectProgressBtn",  tab === "inprogress");
    show("todoBulkDeleteAiBtn",        tab === "ai");
    show("todoBulkRestoreRejectedBtn", tab === "rejected");
    refreshTodoBulkState();
    return result;
  };

  function todoActions(item) {
    if (!isLead()) return "";
    if (item.status === "pending") return `<div class="action-btns wr-actions-nowrap" onclick="event.stopPropagation()"><div class="ab ab-approve" onclick="approveTodo(${item.id})">승인</div><div class="ab ab-edit" onclick="openEditModal(${item.id})">수정</div><div class="ab ab-reject" onclick="rejectTodo(${item.id})">반려</div></div>`;
    if (item.status === "approved") return `<div class="action-btns wr-actions-nowrap" onclick="event.stopPropagation()"><div class="ab ab-approve" onclick="doneTodo(${item.id})">완료</div><div class="ab ab-edit" onclick="openEditModal(${item.id})">수정</div><div class="ab ab-undo" onclick="returnTodoToPending(${item.id})">승인대기 Todo로 되돌리기</div></div>`;
    if (item.status === "done") return `<div class="action-btns wr-actions-nowrap" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="restoreDoneTodo(${item.id})">진행 Todo로 되돌리기</div><div class="ab ab-reject" onclick="deleteDoneTodo(${item.id})">삭제</div></div>`;
    return `<div class="action-btns wr-actions-nowrap" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="returnRejectedTodoToPending(${item.id})">되돌리기</div><div class="ab ab-reject" onclick="deleteRejectedTodo(${item.id})">삭제</div><div class="ab ab-edit" onclick="showTodoRejectionReason(${item.id})">반려 사유</div></div>`;
  }
  window.actionB = actionB = todoActions;

  window.returnTodoToPending = async function (id) {
    const item = todos.find((todo) => todo.id === id);
    if (!item?.apiId) return;
    await api(`/todos/${item.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "pending" }) });
    await refreshWorkflowViews();
    switchTodoTab("ai");
    showToast("승인 대기 Todo로 되돌렸습니다.", "success");
  };
  window.returnRejectedTodoToPending = async function (id) {
    const item = todos.find((todo) => todo.id === id);
    if (!item?.apiId) return;
    await api(`/todos/${item.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "pending" }) });
    await refreshWorkflowViews();
    switchTodoTab("ai");
    showToast("승인 대기 Todo로 되돌렸습니다.", "success");
  };

  window.confirmTodoRejection = async function () {
    const reason = document.getElementById("todoRejectReasonInput")?.value.trim();
    const item = todos.find((todo) => todo.id === G.rejectReasonTarget);
    if (!item || !reason) return showToast("반려 사유를 입력하세요.", "warn");
    if (item.apiId) await api(`/todos/${item.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "rejected" }) });
    try {
      const reasons = JSON.parse(localStorage.getItem("workrader_todo_rejection_reasons") || "{}");
      reasons[String(item.apiId || item.id)] = { reason, at: new Date().toISOString(), reviewer: memberName() };
      localStorage.setItem("workrader_todo_rejection_reasons", JSON.stringify(reasons));
    } catch (_) {}
    closeModal("todoRejectReasonModal");
    await refreshWorkflowViews();
    switchTodoTab("rejected");
    showToast("반려 탭으로 이동했습니다.", "warn");
  };

  const baseOpenTodo = window.openAnalysisTodoReview;
  window.openAnalysisTodoReview = openAnalysisTodoReview = function () {
    if (!G.analysisTodoReview?.length && G.workflowReview?.todo_drafts?.length) G.analysisTodoReview = G.workflowReview.todo_drafts.map((item) => ({ ...item, apiId: item.id }));
    if (!G.analysisTodoReview?.length) return showToast("확인할 Todo 목록이 없습니다.", "info");
    G.analysisTodoChecked = G.analysisTodoChecked || {};
    G.analysisTodoReview.forEach((item) => { if (G.analysisTodoChecked[keyOf(item)] === undefined) G.analysisTodoChecked[keyOf(item)] = true; });
    document.getElementById("analysisTodoCloseConfirm").style.display = "none";
    document.getElementById("analysisTodoModal").classList.add("show");
    renderAnalysisTodoReview(); relabelReviewActions(); syncAnalysisCounts();
  };
  const baseOpenRisk = window.openAnalysisRiskReview;
  window.openAnalysisRiskReview = openAnalysisRiskReview = function () {
    if (!G.analysisRiskReview?.length && G.workflowReview?.risk_drafts?.length) G.analysisRiskReview = G.workflowReview.risk_drafts.map((item) => ({ ...item, apiId: item.id }));
    if (!G.analysisRiskReview?.length) return showToast("확인할 Risk 목록이 없습니다.", "info");
    G.analysisRiskChecked = G.analysisRiskChecked || {};
    G.analysisRiskReview.forEach((item) => { if (G.analysisRiskChecked[keyOf(item)] === undefined) G.analysisRiskChecked[keyOf(item)] = true; });
    document.getElementById("analysisRiskCloseConfirm").style.display = "none";
    document.getElementById("analysisRiskModal").classList.add("show");
    renderAnalysisRiskReview(); relabelReviewActions(); syncAnalysisCounts();
  };

  const baseFiltered = window.getFilteredTodos;
  window.getFilteredTodos = getFilteredTodos = function () {
    const statuses = { ai: "pending", inprogress: "approved", rejected: "rejected", done: "done" };
    const query = String(G.todoSearch?.[G.currentTodoTab] || "").toLowerCase().trim();
    const field = G.todoSearchField?.[G.currentTodoTab] || "all";
    let items = todos.filter((todo) => todo.status === statuses[G.currentTodoTab]);
    if (G.currentTodoTab === "ai") {
      const allowed = new Set((G.workflowReview?.pending_todos || []).map((item) => String(item.id)));
      items = isLead() ? todos.filter((todo) => todo.status === "pending") : todos.filter((todo) => allowed.has(String(todo.apiId)));
      if (!isLead() && G.showAllTodos) items = todos.filter((todo) => todo.status === "pending" && todo.assignee);
    } else if (!isLead() && !G.showAllTodos) {
      items = items.filter((todo) => todo.assignee === memberName());
    }
    return items.filter((todo) => {
      if (!query) return true;
      const values = { title: todo.title || "", description: todo.description || "", assignee: todo.assignee || "", all: `${todo.title || ""} ${todo.description || ""} ${todo.assignee || ""}` };
      return String(values[field] || values.all).toLowerCase().includes(query);
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  };

  window.todoPageItems = todoPageItems = (list) => {
    const page = Math.max(1, G.todoPage?.[G.currentTodoTab] || 1);
    return list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  };
  window.renderTodoPager = renderTodoPager = function (total) {
    const pager = document.getElementById("todoPager");
    if (!pager) return;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(G.todoPage[G.currentTodoTab] || 1, pages);
    G.todoPage[G.currentTodoTab] = page;
    pager.innerHTML = pages <= 1 ? "" : Array.from({ length: pages }, (_, index) => `<button class="todo-page-btn ${page === index + 1 ? "active" : ""}" onclick="setTodoPage(${index + 1})">${index + 1}</button>`).join("");
  };

  const baseRenderTodos = window.renderTodos;
  window.renderTodos = renderTodos = function () {
    baseRenderTodos();
  };

  const baseDateColumns = window.updateTodoDateColumns;
  window.updateTodoDateColumns = updateTodoDateColumns = function () {
    baseDateColumns?.();
    const created = document.getElementById("todoCreatedHeader");
    const updated = document.getElementById("todoUpdatedHeader");
    if (created) created.style.display = G.currentTodoTab === "ai" ? "none" : "table-cell";
    if (updated) { updated.textContent = "마감일"; updated.style.display = G.currentTodoTab === "ai" ? "none" : "table-cell"; }
  };

  const baseTodoDetail = window.renderTodoDetail;
  window.renderTodoDetail = renderTodoDetail = function (id) {
    baseTodoDetail(id);
  };

  const baseIssueDetail = window.renderIssueDetail;
  window.renderIssueDetail = renderIssueDetail = function (id) {
    baseIssueDetail(id);
    const item = issues.find((issue) => String(issue.id) === String(id));
    const host = document.getElementById("issueDetailContent");
    if (!item || !host || host.querySelector(".wr-issue-source")) return;
    host.insertAdjacentHTML("beforeend", `<div class="wr-todo-source wr-issue-source"><b>출처</b>${item.src ? `<button class="wr-source-link" onclick="downloadSource('${esc(item.src)}','${esc(item.sourceFileName || "")}')"><i class="ti ti-download"></i> ${esc(item.sourceFileName || "출처 파일")}</button>` : "<span>수동 등록</span>"}</div>`);
  };

  window.renderHistory = async function () {
    const host = document.getElementById("historyList");
    if (!host) return;
    try {
      const result = await api("/documents");
      const docs = result.documents || [];
      if (!docs.length) { host.innerHTML = '<div class="wr-empty">업로드 이력이 없습니다.</div>'; return; }
      // [B5] 업로드 시간순(최신 먼저)으로 명시 정렬. 백엔드도 created_at DESC 지만,
      //   created_at 누락/동시간 tie 에도 순서가 흔들리지 않도록 프론트에서 결정적으로 한 번 더 정렬한다.
      docs.sort((a, b) => {
        const ta = Date.parse(a.created_at || a.uploaded_at || "") || 0;
        const tb = Date.parse(b.created_at || b.uploaded_at || "") || 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || b.document_id || "").localeCompare(String(a.id || a.document_id || ""));
      });
      const admin = isLead();
      const toolbar = admin
        ? `<div style="display:flex;align-items:center;gap:10px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:6px">
            <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--text2)">
              <input type="checkbox" id="historySelectAll" onchange="toggleAllHistorySelect(this)"> 전체 선택
            </label>
            <button class="tbtn danger" onclick="deleteCheckedDocuments()" style="font-size:11px;padding:3px 10px;margin-left:auto">
              <i class="ti ti-trash"></i> 선택 삭제
            </button>
          </div>`
        : "";
      const rows = docs.map((doc) => {
        const id = esc(doc.id || doc.document_id);
        const name = esc(doc.file_name);
        return `<div class="wr-history-row" style="display:flex;align-items:center;gap:8px">
          ${admin ? `<input type="checkbox" class="history-doc-check" value="${id}" style="flex-shrink:0;accent-color:var(--danger)">` : ""}
          <button class="wr-source-link" onclick="downloadSource('${id}','${name}')" style="flex:1;text-align:left">
            <i class="ti ti-file-download"></i>${name}
          </button>
          <span style="font-size:11px;color:var(--text3);white-space:nowrap">${esc(doc.uploaded_by || "-")} · ${esc(String(doc.created_at || "").slice(0, 10))}</span>
          ${admin ? `<button class="tbtn danger" onclick="deleteUploadedDocument('${id}')" style="font-size:11px;padding:3px 8px;flex-shrink:0"><i class="ti ti-trash"></i></button>` : ""}
        </div>`;
      }).join("");
      host.innerHTML = toolbar + rows;
    } catch (error) { host.innerHTML = '<div class="wr-empty">업로드 이력을 불러오지 못했습니다.</div>'; }
  };
  function showAdminPasswordModal(onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay show";
    overlay.style.zIndex = "10000";
    overlay.innerHTML = `
      <div class="modal" style="width:320px">
        <div class="modal-title"><i class="ti ti-lock" style="color:var(--danger)"></i> 관리자 인증</div>
        <div class="modal-sub">삭제를 진행하려면 관리자 비밀번호를 입력하세요.</div>
        <input type="password" id="adminPwInput" class="form-input" placeholder="비밀번호 입력">
        <div id="adminPwError" style="font-size:11px;color:var(--danger);margin-top:6px;display:none">비밀번호가 올바르지 않습니다.</div>
        <div class="modal-actions">
          <button class="tbtn" id="adminPwCancelBtn">취소</button>
          <button class="tbtn danger" id="adminPwConfirmBtn"><i class="ti ti-lock-open"></i> 확인</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector("#adminPwInput");
    const errorEl = overlay.querySelector("#adminPwError");
    const close = () => overlay.remove();
    const verify = () => {
      if (input.value === "1234") { close(); onConfirm(); }
      else { errorEl.style.display = "block"; input.value = ""; input.focus(); }
    };
    overlay.querySelector("#adminPwConfirmBtn").addEventListener("click", verify);
    overlay.querySelector("#adminPwCancelBtn").addEventListener("click", close);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") verify(); if (e.key === "Escape") close(); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    setTimeout(() => input.focus(), 50);
  }

  window.deleteUploadedDocument = async function (id) {
    showAdminPasswordModal(async () => {
      try {
        await api(`/documents/${id}`, { method: "DELETE" });
        renderHistory();
        showToast("업로드 파일을 삭제했습니다.", "success");
      } catch (_) { showToast("삭제에 실패했습니다.", "warn"); }
    });
  };
  window.toggleAllHistorySelect = function (checkbox) {
    document.querySelectorAll(".history-doc-check").forEach((cb) => { cb.checked = checkbox.checked; });
  };
  window.deleteCheckedDocuments = async function () {
    const checked = Array.from(document.querySelectorAll(".history-doc-check:checked")).map((cb) => cb.value);
    if (!checked.length) return showToast("삭제할 파일을 선택해주세요.", "info");
    showAdminPasswordModal(async () => {
      await Promise.all(checked.map((id) => api(`/documents/${id}`, { method: "DELETE" }).catch(() => {})));
      renderHistory();
      showToast(`${checked.length}개 파일을 삭제했습니다.`, "success");
    });
  };

  function calendarText() {
    const year = Number(G.currentCalYear || new Date().getFullYear());
    const month = Number(G.currentCalMonth ?? new Date().getMonth());
    const prev = month === 0 ? 12 : month;
    const next = month === 11 ? 1 : month + 2;
    const prevButton = document.getElementById("calPrevBtn");
    const title = document.getElementById("calMonthTitle");
    const nextButton = document.getElementById("calNextBtn");
    if (prevButton) prevButton.textContent = `← ${prev}월`;
    if (title) title.textContent = `${year}년 ${month + 1}월`;
    if (nextButton) nextButton.textContent = `${next}월 →`;
  }
  function stabilizeLateUi() {
    calendarText();
    const cards = document.querySelector("#resultSection .three-col");
    if (cards) { cards.style.pointerEvents = "auto"; cards.style.opacity = "1"; }
    relabelReviewActions();
    removeObsoleteAnalysisUi();
  }
  function initializeCalendarToCurrentMonth() {
    if (G.workflowCalendarInitialized) return;
    const now = new Date();
    G.currentCalYear = now.getFullYear();
    G.currentCalMonth = now.getMonth();
    G.workflowCalendarInitialized = true;
    if (typeof renderCalendar === "function") renderCalendar(G.currentCalYear, G.currentCalMonth);
    calendarText();
  }
  const baseRenderCalendar = window.renderCalendar;
  if (typeof baseRenderCalendar === "function") {
    window.renderCalendar = renderCalendar = function (...args) {
      const result = baseRenderCalendar(...args);
      calendarText();
      return result;
    };
  }
  ["goToPrevMonth", "goToNextMonth"].forEach((name) => {
    const original = window[name];
    if (typeof original !== "function") return;
    window[name] = function (...args) {
      const result = original(...args);
      setTimeout(calendarText, 0);
      return result;
    };
  });

  function ensureIssueRejectedTab() {
    const tabs = document.querySelector("#s-issues .tabs");
    if (!tabs || document.getElementById("issueRejectedTab")) return;
    const tab = document.createElement("div");
    tab.id = "issueRejectedTab";
    tab.className = "tab";
    tab.innerHTML = `반려 <span class="badge b-gray" id="i-rej-cnt">0</span>`;
    tab.onclick = () => switchIssueTab("rejected");
    tabs.appendChild(tab);
    tab.style.display = isLead() ? "" : "none";
  }

  function ensureIssueResolvedTab() {
    const tabs = document.querySelector("#s-issues .tabs");
    if (!tabs) return;
    if (tabs.querySelector(".tab[onclick*=\"'resolved'\"]") || document.getElementById("issueResolvedTab")) return;
    const tab = document.createElement("div");
    tab.id = "issueResolvedTab";
    tab.className = "tab";
    tab.innerHTML = `완료 <span class="badge b-gray" id="i-done-cnt">0</span>`;
    tab.onclick = () => switchIssueTab("resolved");
    const firstTab = tabs.querySelector(".tab");
    if (firstTab?.nextSibling) {
      tabs.insertBefore(tab, firstTab.nextSibling);
    } else {
      tabs.appendChild(tab);
    }
  }

  const baseSwitchIssue = window.switchIssueTab;
  window.switchIssueTab = switchIssueTab = async function (tab) {
    if (tab === "candidate" && isLead()) {
      G.currentIssueTab = "candidate";
      document.querySelectorAll("#s-issues .tabs .tab").forEach((node) => node.classList.toggle("active", String(node.getAttribute("onclick") || "").includes("'candidate'")));
      renderPendingRisks();
      return;
    }
    if (tab === "resolved") {
      G.currentIssueTab = "resolved";
      G.selectedIssueId = null;
      if (typeof hideIssueDetail === "function") hideIssueDetail();
      document.querySelectorAll("#s-issues .tabs .tab").forEach((node) => {
        const onclickAttr = String(node.getAttribute("onclick") || "");
        node.classList.toggle("active", onclickAttr.includes("'resolved'") || node.id === "issueResolvedTab");
      });
      renderResolvedIssues();
      return;
    }
    if (tab !== "rejected") return baseSwitchIssue(tab);
    G.currentIssueTab = "rejected";
    document.querySelectorAll("#s-issues .tabs .tab").forEach((node) => node.classList.toggle("active", node.id === "issueRejectedTab"));
    try {
      const result = await api("/workflow/risks/rejected");
      G.rejectedRisks = result.issues || [];
    } catch (e) {
      G.rejectedRisks = [];
      const msg = String(e?.message || "");
      if (msg.includes("invalid token") || msg.includes("401") || msg.includes("login")) {
        showToast("인증이 만료됐습니다. 다시 로그인해 주세요.", "warn");
      } else {
        showToast("반려 목록을 불러올 수 없습니다.", "warn");
      }
    }
    renderRejectedRisks();
  };

  function renderPendingRisks() {
    const host = document.getElementById("issueList");
    if (!host) return;
    const pendingRisks = G.workflowReview?.pending_risks || [];
    const candidateIssues = typeof issues !== "undefined" ? issues.filter((i) => i.type === "candidate") : [];
    const allItems = [
      ...pendingRisks.map((item) => ({ ...item, _source: "workflow" })),
      ...candidateIssues.filter((i) => !pendingRisks.some((r) => String(r.id) === String(i.apiId))).map((i) => ({ ...i, _source: "local" })),
    ];
    const badge = document.getElementById("i-cand-cnt");
    if (badge) badge.textContent = allItems.length;
    if (!allItems.length) {
      host.innerHTML = '<div class="wr-empty">승인 대기 이슈가 없습니다.</div>';
      return;
    }
    host.innerHTML = allItems.map((item) => {
      const id = esc(item.apiId || item.id);
      const sev = item.severity || item.risk_level || null;
      const sevBadge = sev === "high"
        ? '<span class="badge b-danger">High</span>'
        : sev === "medium"
        ? '<span class="badge b-warn">Medium</span>'
        : '<span class="badge b-warn">승인 대기</span>';
      const title = esc(item.title || "제목 없음");
      const desc = esc(description(item));
      const assignee = esc(item.sent_by || item.assignee || "");
      return `<div class="issue-card has-issue-chk" style="display:flex;align-items:flex-start;gap:8px">
        <input type="checkbox" class="issue-row-chk" value="${id}" style="accent-color:var(--danger);cursor:pointer;margin-top:6px;flex-shrink:0" onclick="event.stopPropagation();toggleIssueChk('${id}',this.checked)" ${G.issueChecked?.[id] ? "checked" : ""}>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="showPendingRiskDetail('${id}')">
          <div class="issue-hd">
            ${sevBadge}
            <div class="issue-title">${title}</div>
          </div>
          ${desc ? `<div class="issue-desc">${desc}</div>` : ""}
          <div class="issue-footer">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${assignee ? `<span class="badge b-gray">담당: ${assignee}</span>` : ""}
            </div>
            <div class="wr-queue-actions" onclick="event.stopPropagation()">
              <button class="tbtn primary" style="font-size:10px;padding:4px 8px" onclick="approvePendingRisk('${id}')"><i class="ti ti-check"></i> 이슈 확정</button>
              <button class="tbtn danger" style="font-size:10px;padding:4px 8px" onclick="deletePendingRisk('${id}')"><i class="ti ti-trash"></i> 삭제</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
    const toolbar = document.createElement("div");
    toolbar.className = "wr-issue-bulk-bar";
    toolbar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap";
    toolbar.innerHTML = `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--text2)"><input type="checkbox" id="issueChkAll" onchange="toggleAllIssueChk(this)" style="accent-color:var(--danger)"> 전체선택</label><button class="tbtn primary" onclick="bulkApprovePendingRisks()" style="font-size:11px;padding:3px 10px;margin-left:auto"><i class="ti ti-check"></i> 선택항목 이슈확정</button><button class="tbtn danger" onclick="bulkDeleteCurrentIssues()" style="font-size:11px;padding:3px 10px"><i class="ti ti-trash"></i> 선택항목 영구삭제</button>`;
    host.insertBefore(toolbar, host.firstChild);
  }
  window.showPendingRiskDetail = function (id) {
    const item = G.workflowReview?.pending_risks?.find((row) => String(row.id) === String(id))
      || (typeof issues !== "undefined"
        ? issues.find((row) => String(row.apiId || row.id) === String(id))
        : null);
    if (!item) return;
    const issue = {
      title: item.title,
      src: item.document_id || item.src || null,
      sourceFileName: item.source_file_name || item.sourceFileName || null,
      desc: item.description || item.desc || "",
      description: item.description || item.desc || "",
      severity: item.risk_level || item.severity || "medium",
      assignee: item.assignee || item.sent_by || "",
      days: 0,
    };
    renderIssueDetailPanel(issue, `
      <div style="display:flex;gap:5px;justify-content:flex-end">
        <div class="tbtn primary" onclick="approvePendingRisk('${esc(id)}')"><i class="ti ti-check"></i> 이슈 확정</div>
        <div class="tbtn danger" onclick="deletePendingRisk('${esc(id)}')"><i class="ti ti-trash"></i> 삭제</div>
      </div>`);
  };

  function renderPendingIssues() {
    const host = document.getElementById("issueList");
    if (!host) return;
    const pendingRisks = G.workflowReview?.pending_risks || [];
    const candidateIssues = issues.filter((i) => i.type === "candidate");
    const allItems = [
      ...pendingRisks.map((item) => ({ ...item, _source: "workflow" })),
      ...candidateIssues.filter((i) => !pendingRisks.some((r) => String(r.id) === String(i.apiId))).map((i) => ({ ...i, _source: "local" })),
    ];
    const badge = document.getElementById("i-pending-cnt");
    if (badge) badge.textContent = allItems.length;
    if (!allItems.length) { host.innerHTML = '<div class="wr-empty">승인 대기 이슈가 없습니다.</div>'; return; }
    host.innerHTML = allItems.map((item) => {
      const id = esc(item.apiId || item.id);
      const title = esc(item.title || "제목 없음");
      const sentBy = esc(item.sent_by || item.assignee || "팀원");
      const desc = esc(item.description || item.desc || "");
      const dueDate = esc(due(item));
      return `<article class="issue-card candidate" onclick="showPendingRiskDetail('${id}')">
        <div class="issue-hd"><span class="badge b-warn">승인 대기</span><div class="issue-title">${title}</div><span class="badge b-gray">${sentBy}</span></div>
        <div class="issue-desc">${desc}</div>
        <div class="issue-footer"><span>마감일 ${dueDate}</span>
          <div class="wr-queue-actions" onclick="event.stopPropagation()">
            <button class="tbtn primary" onclick="approvePendingRisk('${id}')">이슈 확정</button>
            <button class="tbtn danger" onclick="rejectPendingItem('risk','${id}')">반려</button>
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function renderRejectedRisks() {
    const host = document.getElementById("issueList");
    const items = G.rejectedRisks || [];
    const badge = document.getElementById("i-rej-cnt");
    if (badge) badge.textContent = items.length;
    if (typeof hideIssueDetail === "function") hideIssueDetail();
    if (!items.length) { host.innerHTML = '<div class="wr-empty">반려된 이슈가 없습니다.</div>'; return; }
    host.innerHTML = items.map((item) => {
      const id = esc(item.id);
      const title = esc(item.title || "제목 없음");
      const desc = esc(description(item));
      const sev = item.risk_level || item.severity || null;
      const sevBadge = sev === "high"
        ? '<span class="badge b-danger">High</span>'
        : sev === "medium"
        ? '<span class="badge b-warn">Medium</span>'
        : '<span class="badge b-gray">반려</span>';
      return `<div class="issue-card has-issue-chk" style="display:flex;align-items:flex-start;gap:8px">
        <input type="checkbox" class="issue-row-chk" value="${id}" style="accent-color:var(--danger);cursor:pointer;margin-top:6px;flex-shrink:0" onclick="event.stopPropagation();toggleIssueChk('${id}',this.checked)" ${G.issueChecked?.[id] ? "checked" : ""}>
        <div style="flex:1;min-width:0;cursor:pointer" onclick="showRejectedRiskDetail('${id}')">
          <div class="issue-hd">${sevBadge}<div class="issue-title">${title}</div></div>
          ${desc ? `<div class="issue-desc">${desc}</div>` : ""}
          <div class="issue-footer">
            <span style="font-size:11px;color:var(--text3)">${esc(String(item.created_at || "").slice(0,10))}</span>
            <div class="wr-queue-actions" onclick="event.stopPropagation()">
              <button class="tbtn" style="color:var(--accent)" onclick="restoreRejectedRisk('${id}')"><i class="ti ti-arrow-back-up"></i> 되돌리기</button>
              <button class="tbtn" onclick="showRejectedRiskReason('${id}')"><i class="ti ti-info-circle"></i> 반려사유</button>
              <button class="tbtn danger" onclick="deleteRejectedRisk('${id}')"><i class="ti ti-trash"></i> 삭제</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join("");
    const toolbar = document.createElement("div");
    toolbar.className = "wr-issue-bulk-bar";
    toolbar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap";
    toolbar.innerHTML = `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--text2)"><input type="checkbox" id="issueChkAll" onchange="toggleAllIssueChk(this)" style="accent-color:var(--danger)"> 전체선택</label><button class="tbtn" onclick="bulkRestoreRejectedRisks()" style="font-size:11px;padding:3px 10px;margin-left:auto;color:var(--accent)"><i class="ti ti-arrow-back-up"></i> 선택항목 전체 되돌리기</button><button class="tbtn danger" onclick="bulkDeleteRejectedRisks()" style="font-size:11px;padding:3px 10px"><i class="ti ti-trash"></i> 선택항목 영구삭제</button>`;
    host.insertBefore(toolbar, host.firstChild);
  }
  window.showRejectedRiskDetail = function (id) {
    const item = G.rejectedRisks?.find((row) => String(row.id) === String(id));
    if (!item) return;
    const issue = {
      title: item.title,
      src: item.document_id || null,
      sourceFileName: item.source_file_name || null,
      desc: item.description || item.desc || "",
      description: item.description || item.desc || "",
      severity: item.risk_level || item.severity || "medium",
      assignee: item.assignee || "",
      days: 0,
    };
    renderIssueDetailPanel(issue, `
      <div style="display:flex;gap:5px;justify-content:flex-end">
        <div class="tbtn" style="color:var(--accent)" onclick="restoreRejectedRisk('${esc(id)}')"><i class="ti ti-arrow-back-up"></i> 되돌리기</div>
        <div class="tbtn" onclick="showRejectedRiskReason('${esc(id)}')"><i class="ti ti-info-circle"></i> 반려사유</div>
        <div class="tbtn danger" onclick="deleteRejectedRisk('${esc(id)}')"><i class="ti ti-trash"></i> 삭제</div>
      </div>`);
  };
  window.restoreRejectedRisk = async function (id) {
    try {
      await api(`/issues/${id}`, { method: "PATCH", body: JSON.stringify({ approval_status: "pending" }) });
      switchIssueTab("candidate");
      showToast("승인대기로 되돌렸습니다.", "success");
    } catch (_) { showToast("되돌리기에 실패했습니다.", "warn"); }
  };
  window.deleteRejectedRisk = async function (id) {
    if (!confirm("반려 이슈를 영구 삭제하시겠습니까?")) return;
    try {
      await api(`/issues/${id}`, { method: "DELETE" });
      if (G.rejectedRisks) {
        const idx = G.rejectedRisks.findIndex(r => String(r.id) === String(id));
        if (idx !== -1) G.rejectedRisks.splice(idx, 1);
      }
      clearIssueChecks();
      renderRejectedRisks();
      showToast("이슈를 삭제했습니다.", "success");
    } catch (_) { showToast("삭제에 실패했습니다.", "warn"); }
  };
  window.showRejectedRiskReason = function (id) {
    const item = G.rejectedRisks?.find((row) => String(row.id) === String(id));
    alert(`반려 사유: ${item?.risk_reason || "없음"}`);
  };
  window.bulkRestoreRejectedRisks = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    if (!confirm(`${checkedIds.length}개 이슈를 승인대기로 되돌리시겠습니까?`)) return;
    try {
      await Promise.all(checkedIds.map(id => api(`/issues/${id}`, { method: "PATCH", body: JSON.stringify({ approval_status: "pending" }) })));
      clearIssueChecks();
      switchIssueTab("candidate");
      showToast(`${checkedIds.length}개 이슈를 승인대기로 되돌렸습니다.`, "success");
    } catch (_) { showToast("되돌리기에 실패했습니다.", "warn"); }
  };
  window.bulkDeleteRejectedRisks = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    if (!confirm(`선택한 ${checkedIds.length}개 이슈를 영구 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(checkedIds.map(id => api(`/issues/${id}`, { method: "DELETE" })));
      if (G.rejectedRisks) {
        for (let i = G.rejectedRisks.length - 1; i >= 0; i--) {
          if (checkedIds.includes(String(G.rejectedRisks[i].id))) G.rejectedRisks.splice(i, 1);
        }
      }
      clearIssueChecks();
      renderRejectedRisks();
      showToast(`${checkedIds.length}개 이슈를 삭제했습니다.`, "success");
    } catch (_) { showToast("삭제에 실패했습니다.", "warn"); }
  };

  function relocateCalendarPreferences() {
    document.getElementById("calendarScopePrefs")?.remove();
    const panel = document.getElementById("calendarPreferencePanel");
    const content = document.querySelector("#s-calendar .content");
    if (panel && content && panel.parentElement !== content) content.appendChild(panel);
    panel?.querySelector(".settings-panel-sub")?.replaceChildren("표시할 담당자와 Todo 상태를 선택합니다.");
  }

  const baseTodoCounts = window.updateTodoCounts;
  window.updateTodoCounts = updateTodoCounts = function () {
    baseTodoCounts?.();
    const count = isLead() ? todos.filter((todo) => todo.status === "pending").length : G.workflowReview?.pending_todos?.length || 0;
    const badge = document.getElementById("t-ai-cnt");
    const pending = document.getElementById("pendingCount");
    if (badge) badge.textContent = count;
    if (pending) pending.textContent = count;
  };

  const baseDashboard = window.renderDashboardLive;
  window.renderDashboardLive = async function (...args) {
    const result = await baseDashboard?.(...args);
    configureRoleScreen();
    return result;
  };

  function keepReviewCardsInteractive() {
    const cards = document.querySelector("#resultSection .three-col");
    if (cards) { cards.style.pointerEvents = ""; cards.style.opacity = "1"; }
    relabelReviewActions();
    removeObsoleteAnalysisUi();
  }
  const baseStartAnalysis = window.startAnalysis;
  if (typeof baseStartAnalysis === "function") {
    window.startAnalysis = startAnalysis = async function (...args) {
      const result = await baseStartAnalysis(...args);
      setTimeout(keepReviewCardsInteractive, 50);
      return result;
    };
  }

  // ── 이슈 체크박스 상태 ──
  G.issueChecked = G.issueChecked || {};
  function getCheckedIssueIds() {
    return Object.keys(G.issueChecked || {}).filter((id) => G.issueChecked[id]);
  }
  function clearIssueChecks() {
    G.issueChecked = {};
    const chkAll = document.getElementById("issueChkAll");
    if (chkAll) chkAll.checked = false;
  }
  window.toggleIssueChk = function (id, checked) {
    if (!G.issueChecked) G.issueChecked = {};
    G.issueChecked[String(id)] = checked;
  };
  window.toggleAllIssueChk = function (el) {
    document.querySelectorAll(".issue-row-chk").forEach((cb) => {
      cb.checked = el.checked;
      if (!G.issueChecked) G.issueChecked = {};
      G.issueChecked[String(cb.value)] = el.checked;
    });
  };

  // ── 이슈 목록 체크박스/벌크 툴바 주입 ──
  function injectIssueBulkUi() {
    const host = document.getElementById("issueList");
    if (!host) return;
    host.querySelector(".wr-issue-bulk-bar")?.remove();
    const toolbar = document.createElement("div");
    toolbar.className = "wr-issue-bulk-bar";
    toolbar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap";
    toolbar.innerHTML = `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--text2)"><input type="checkbox" id="issueChkAll" onchange="toggleAllIssueChk(this)" style="accent-color:var(--danger)"> 전체선택</label><button class="tbtn danger" onclick="bulkDeleteCurrentIssues()" style="font-size:11px;padding:3px 10px;margin-left:auto"><i class="ti ti-trash"></i> 선택항목 영구삭제</button>`;
    host.insertBefore(toolbar, host.firstChild);
    host.querySelectorAll(".issue-card:not(.has-issue-chk)").forEach((card) => {
      card.classList.add("has-issue-chk");
      const onclick = card.getAttribute("onclick") || "";
      const selM = onclick.match(/selectIssue\((.*?)\)/);
      const pendM = onclick.match(/showPendingRiskDetail\('([^']+)'\)/);
      let id;
      if (selM) { try { id = JSON.parse(selM[1]); } catch (_) { id = selM[1]; } }
      else if (pendM) { id = pendM[1]; }
      if (!id) return;
      id = String(id);
      const chkWrap = document.createElement("div");
      chkWrap.style.cssText = "display:flex;align-items:flex-start;padding-top:4px;flex-shrink:0";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "issue-row-chk";
      chk.value = id;
      chk.checked = !!(G.issueChecked && G.issueChecked[id]);
      chk.style.cssText = "accent-color:var(--danger);cursor:pointer";
      chk.onclick = (e) => { e.stopPropagation(); window.toggleIssueChk(id, chk.checked); };
      chkWrap.appendChild(chk);
      card.style.cssText = (card.getAttribute("style") || "") + ";display:flex;align-items:flex-start;gap:8px";
      card.insertBefore(chkWrap, card.firstChild);
    });
  }

  // ── 진행/승인대기 탭 벌크 영구삭제 ──
  window.bulkDeleteCurrentIssues = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    const allIssues = typeof issues !== "undefined" ? issues : [];
    // checkedIds may be numeric UI IDs (inprogress) or UUID strings (candidate) — resolve both
    const apiIds = [...new Set(
      checkedIds.map(cid => {
        const byUiId = allIssues.find(i => String(i.id) === cid);
        if (byUiId?.apiId) return byUiId.apiId;
        const byApiId = allIssues.find(i => String(i.apiId || "") === cid);
        return byApiId?.apiId || cid;
      }).filter(Boolean)
    )];
    if (!apiIds.length) return showToast("삭제할 이슈를 찾을 수 없습니다.", "warn");
    if (!confirm(`선택한 ${apiIds.length}개 이슈를 영구 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(apiIds.map(apiId => api(`/issues/${apiId}`, { method: "DELETE" })));
      for (let i = allIssues.length - 1; i >= 0; i--) {
        if (apiIds.includes(String(allIssues[i].apiId || ""))) allIssues.splice(i, 1);
      }
      clearIssueChecks();
      if (window.opsRadarApi?.loadIssues) await window.opsRadarApi.loadIssues();
      if (typeof renderIssues === "function") renderIssues();
      showToast(`${apiIds.length}개 이슈를 영구 삭제했습니다.`, "success");
    } catch (_) { showToast("이슈 삭제에 실패했습니다.", "warn"); }
  };

  // ── 완료 탭 렌더링 ──
  function renderResolvedIssues() {
    const host = document.getElementById("issueList");
    if (!host) return;
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const items = allIssues.filter((i) => i.type === "resolved");
    const badge = document.getElementById("i-done-cnt");
    if (badge) badge.textContent = items.length;
    if (typeof hideIssueDetail === "function") hideIssueDetail();
    if (!items.length) { host.innerHTML = '<div class="wr-empty">완료된 이슈가 없습니다.</div>'; return; }
    host.innerHTML = items.map((issue) => {
      const id = esc(String(issue.apiId || issue.id || ""));
      const title = esc(issue.title || "제목 없음");
      const desc = esc(issue.desc || issue.description || "");
      const assignee = esc(issue.assignee || "미지정");
      return `<div class="issue-card has-issue-chk" style="display:flex;align-items:flex-start;gap:8px"><input type="checkbox" class="issue-row-chk" value="${id}" style="accent-color:var(--danger);cursor:pointer;margin-top:6px;flex-shrink:0" onclick="event.stopPropagation();toggleIssueChk('${id}',this.checked)" ${G.issueChecked?.[id] ? "checked" : ""}><div style="flex:1;min-width:0;cursor:pointer" onclick="showResolvedIssueDetail('${id}')"><div class="issue-hd"><span class="badge b-success">완료</span><div class="issue-title">${title}</div></div>${desc ? `<div class="issue-desc">${desc}</div>` : ""}<div class="issue-footer"><span>담당자 ${assignee}</span><div class="wr-queue-actions" onclick="event.stopPropagation()"><button class="tbtn" style="color:var(--accent)" onclick="restoreResolvedIssue('${id}')"><i class="ti ti-arrow-back-up"></i> 되돌리기</button><button class="tbtn danger" onclick="deleteSingleResolvedIssue('${id}')"><i class="ti ti-trash"></i> 삭제</button></div></div></div></div>`;
    }).join("");
    const toolbar = document.createElement("div");
    toolbar.className = "wr-issue-bulk-bar";
    toolbar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 0 10px;border-bottom:1px solid var(--border);margin-bottom:8px;flex-wrap:wrap";
    toolbar.innerHTML = `<label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer;color:var(--text2)"><input type="checkbox" id="issueChkAll" onchange="toggleAllIssueChk(this)" style="accent-color:var(--danger)"> 전체선택</label><button class="tbtn" onclick="bulkRestoreResolvedIssues()" style="font-size:11px;padding:3px 10px;margin-left:auto;color:var(--accent)"><i class="ti ti-arrow-back-up"></i> 선택항목 전체 되돌리기</button><button class="tbtn danger" onclick="bulkDeleteResolvedIssues()" style="font-size:11px;padding:3px 10px"><i class="ti ti-trash"></i> 선택항목 영구삭제</button>`;
    host.insertBefore(toolbar, host.firstChild);
  }

  // ── 완료 이슈 단건 되돌리기/삭제 ──
  function resolveApiIdFromChecked(cid) {
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const byApiId = allIssues.find(i => String(i.apiId || "") === cid);
    if (byApiId?.apiId) return { issue: byApiId, apiId: byApiId.apiId };
    const byUiId = allIssues.find(i => String(i.id) === cid);
    if (byUiId?.apiId) return { issue: byUiId, apiId: byUiId.apiId };
    if (isUUID(cid)) return { issue: byApiId || null, apiId: cid };
    return null;
  }
  window.restoreResolvedIssue = async function (id) {
    if (!confirm("이 이슈를 진행 이슈로 되돌리시겠습니까?")) return;
    const resolved = resolveApiIdFromChecked(id);
    if (!resolved) return showToast("이슈 ID를 확인할 수 없습니다.", "warn");
    try {
      await api(`/issues/${resolved.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "open" }) });
      if (resolved.issue) { resolved.issue.status = "open"; resolved.issue.type = "confirmed"; }
      renderResolvedIssues();
      showToast("진행 이슈로 되돌렸습니다.", "success");
    } catch (_) { showToast("되돌리기에 실패했습니다.", "warn"); }
  };
  window.deleteSingleResolvedIssue = async function (id) {
    if (!confirm("이슈를 영구 삭제하시겠습니까?")) return;
    try {
      await api(`/issues/${id}`, { method: "DELETE" });
      if (typeof issues !== "undefined") {
        const idx = issues.findIndex((i) => String(i.apiId || i.id) === String(id));
        if (idx !== -1) issues.splice(idx, 1);
      }
      clearIssueChecks();
      renderResolvedIssues();
      showToast("이슈를 영구 삭제했습니다.", "success");
    } catch (_) { showToast("삭제에 실패했습니다.", "warn"); }
  };

  // ── 완료 이슈 벌크 되돌리기/삭제 ──
  window.bulkRestoreResolvedIssues = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    const targets = checkedIds.map(resolveApiIdFromChecked).filter(Boolean);
    if (!targets.length) return showToast("되돌릴 이슈를 찾을 수 없습니다.", "warn");
    if (!confirm(`${targets.length}개 이슈를 진행 이슈로 되돌리시겠습니까?`)) return;
    try {
      await Promise.all(targets.map(({ apiId }) => api(`/issues/${apiId}`, { method: "PATCH", body: JSON.stringify({ status: "open" }) })));
      targets.forEach(({ issue }) => { if (issue) { issue.status = "open"; issue.type = "confirmed"; } });
      clearIssueChecks();
      switchIssueTab("inprogress");
      showToast(`${targets.length}개 이슈를 진행 이슈로 되돌렸습니다.`, "success");
    } catch (_) { showToast("되돌리기에 실패했습니다.", "warn"); }
  };
  window.bulkDeleteResolvedIssues = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    if (!confirm(`선택한 ${checkedIds.length}개 이슈를 영구 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(checkedIds.map((id) => api(`/issues/${id}`, { method: "DELETE" })));
      if (typeof issues !== "undefined") {
        for (let i = issues.length - 1; i >= 0; i--) {
          if (checkedIds.includes(String(issues[i].apiId || issues[i].id))) issues.splice(i, 1);
        }
      }
      clearIssueChecks();
      renderResolvedIssues();
      showToast(`${checkedIds.length}개 이슈를 영구 삭제했습니다.`, "success");
    } catch (_) { showToast("이슈 삭제에 실패했습니다.", "warn"); }
  };

  // ── 승인대기 단건 삭제 / 벌크 이슈확정 ──
  window.deletePendingRisk = async function (id) {
    const resolved = resolveApiIdFromChecked(id);
    if (!resolved?.apiId) return showToast("이슈 ID를 확인할 수 없습니다.", "warn");
    if (!confirm("이슈를 영구 삭제하시겠습니까?")) return;
    try {
      await api(`/issues/${resolved.apiId}`, { method: "DELETE" });
      if (resolved.issue) {
        const allIssues = typeof issues !== "undefined" ? issues : [];
        const idx = allIssues.indexOf(resolved.issue);
        if (idx !== -1) allIssues.splice(idx, 1);
      }
      if (G.workflowReview?.pending_risks) {
        const wIdx = G.workflowReview.pending_risks.findIndex(r => String(r.id) === String(id));
        if (wIdx !== -1) G.workflowReview.pending_risks.splice(wIdx, 1);
      }
      clearIssueChecks();
      renderPendingRisks();
      showToast("이슈를 영구 삭제했습니다.", "success");
    } catch (_) { showToast("삭제에 실패했습니다.", "warn"); }
  };
  window.bulkApprovePendingRisks = async function () {
    const checkedIds = getCheckedIssueIds();
    if (!checkedIds.length) return showToast("선택된 항목이 없습니다.", "info");
    if (!confirm(`${checkedIds.length}개 이슈를 확정하시겠습니까?`)) return;
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const targets = checkedIds.map(cid => {
      const byApiId = allIssues.find(i => String(i.apiId || "") === cid);
      if (byApiId?.apiId) return { issue: byApiId, apiId: byApiId.apiId };
      const byUiId = allIssues.find(i => String(i.id) === cid);
      if (byUiId?.apiId) return { issue: byUiId, apiId: byUiId.apiId };
      if (isUUID(cid)) return { issue: null, apiId: cid };
      return null;
    }).filter(Boolean);
    if (!targets.length) return showToast("확정할 이슈를 찾을 수 없습니다.", "warn");
    try {
      await Promise.all(targets.map(({ apiId }) => api(`/issues/${apiId}`, { method: "PATCH", body: JSON.stringify({ approval_status: "approved", status: "open" }) })));
      targets.forEach(({ issue }) => { if (issue) { issue.type = "confirmed"; issue.status = "open"; issue.approvalStatus = "approved"; } });
      clearIssueChecks();
      await refreshWorkflowViews();
      switchIssueTab("inprogress");
      showToast(`${targets.length}개 이슈를 확정했습니다.`, "success");
    } catch (_) { showToast("이슈 확정에 실패했습니다.", "warn"); }
  };

  // ── 진행 이슈 탭 렌더링 (클린 카드: UUID/Open/AI자동탐지 제거) ──
  function isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ""));
  }
  function renderInProgressIssues() {
    const host = document.getElementById("issueList");
    if (!host) return;
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const items = allIssues.filter(i => i.type === "confirmed");
    const badge = document.getElementById("i-prog-cnt");
    if (badge) badge.textContent = items.length;
    const doneCnt = document.getElementById("i-done-cnt");
    if (doneCnt) doneCnt.textContent = allIssues.filter(i => i.type === "resolved").length;
    if (!items.length) {
      host.innerHTML = '<div class="wr-empty">진행 중인 이슈가 없습니다.</div>';
      injectIssueBulkUi();
      return;
    }
    host.innerHTML = items.map(issue => {
      const id = issue.id;
      const sev = issue.severity || "medium";
      const sevCls = sev === "high" ? "b-danger" : sev === "medium" ? "b-warn" : "b-gray";
      const sevLabel = sev === "high" ? "High" : "Medium";
      const title = esc(issue.title || "제목 없음");
      const desc = esc(issue.desc || issue.description || "");
      const hasTodo = (G.createdTodosFromIssue || []).some(t => t.issueId === issue.id);
      const todoTag = hasTodo ? '<span class="badge b-success" style="font-size:9px">Todo 생성됨</span>' : "";
      const isSelected = G.selectedIssueId === id;
      return `<div class="issue-card ${isSelected ? "selected" : ""}" onclick="selectIssue(${id})" style="cursor:pointer">
          <div class="issue-hd">
              <span class="badge ${sevCls}">${sevLabel}</span>
              <div class="issue-title">${title}</div>
              ${todoTag}
          </div>
          ${desc ? `<div class="issue-desc">${desc}</div>` : ""}
          <div class="issue-footer">
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${issue.assignee ? `<span class="badge b-gray">담당: ${esc(issue.assignee)}</span>` : ""}
                  ${issue.days > 0 ? `<span class="badge b-gray">${issue.days}일째</span>` : ""}
              </div>
              <div class="wr-queue-actions" onclick="event.stopPropagation()">
                  <button class="tbtn" style="font-size:10px;padding:4px 8px;color:var(--success)" onclick="resolveAndSwitchTab(${id})"><i class="ti ti-check"></i> 완료</button>
                  <button class="tbtn" style="font-size:10px;padding:4px 8px;color:var(--accent)" onclick="revertIssue(${id})"><i class="ti ti-arrow-back-up"></i> 되돌리기</button>
                  <button class="tbtn" style="font-size:10px;padding:4px 8px" onclick="openTodoCreate(${id})"><i class="ti ti-plus"></i> 대응 Todo 생성</button>
              </div>
          </div>
      </div>`;
    }).join("");
    injectIssueBulkUi();
  }

  // ── 이슈 상세보기 공통 패널 렌더 ──
  function renderIssueDetailPanel(issue, actionsHtml) {
    const detailEmpty = document.getElementById("issueDetailEmpty");
    const dc = document.getElementById("issueDetailContent");
    const actions = document.getElementById("issueDetailActions");
    if (detailEmpty) detailEmpty.style.display = "none";
    if (!dc) return;
    dc.style.display = "block";
    dc.className = "fade-up";
    const sev = issue.severity || "medium";
    const sevCls = sev === "high" ? "b-danger" : sev === "medium" ? "b-warn" : "b-gray";
    const sevLabel = sev === "high" ? "High" : "Medium";
    // issue.src = document UUID (download target), issue.sourceFileName = display filename
    const hasDocSrc = issue.src && isUUID(String(issue.src));
    const srcHtml = hasDocSrc
      ? `<div class="detail-section">출처</div><div style="font-size:11px;padding:4px 0"><span class="wr-source-link" style="cursor:pointer;color:var(--accent)" onclick="downloadSource('${esc(issue.src)}','${esc(issue.sourceFileName || "")}')"><i class="ti ti-download" style="font-size:10px"></i> ${esc(issue.sourceFileName || "출처 파일 다운로드")}</span></div>`
      : "";
    dc.innerHTML = `
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:10px;line-height:1.5">${esc(issue.title || "제목 없음")}</div>
      ${srcHtml}
      <div class="detail-section">내용</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6;white-space:pre-wrap;word-break:break-word">${esc(issue.desc || issue.description || "(내용 없음)")}</div>
      <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge ${sevCls}">${sevLabel}</span>
        ${issue.assignee ? `<span class="badge b-gray">담당: ${esc(issue.assignee)}</span>` : ""}
        ${issue.days > 0 ? `<span class="badge b-gray">${issue.days}일째</span>` : ""}
      </div>`;
    if (actions) {
      actions.style.display = "flex";
      actions.innerHTML = actionsHtml;
    }
  }
  window.showResolvedIssueDetail = function (apiId) {
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const issue = allIssues.find(i => String(i.apiId || "") === String(apiId));
    if (!issue) return;
    renderIssueDetailPanel(issue, `
      <div style="display:flex;gap:5px;justify-content:flex-end">
        <div class="tbtn" style="color:var(--accent)" onclick="restoreResolvedIssue('${esc(apiId)}')"><i class="ti ti-arrow-back-up"></i> 되돌리기</div>
        <div class="tbtn danger" onclick="deleteSingleResolvedIssue('${esc(apiId)}')"><i class="ti ti-trash"></i> 삭제</div>
      </div>`);
  };
  // ── 진행 이슈 상세보기 패널 ──
  const baseRenderIssueDetail = window.renderIssueDetail;
  window.renderIssueDetail = renderIssueDetail = function (id) {
    if (G.currentIssueTab !== "inprogress") {
      if (typeof baseRenderIssueDetail === "function") baseRenderIssueDetail(id);
      return;
    }
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const issue = allIssues.find(i => i.id === id);
    if (!issue) return;
    renderIssueDetailPanel(issue, `
      <div class="tbtn primary" onclick="openTodoCreate(${id})" style="justify-content:center"><i class="ti ti-plus"></i> 대응 Todo 생성</div>
      <div style="display:flex;gap:5px;margin-top:4px">
        <div class="tbtn" style="flex:1;justify-content:center;color:var(--success)" onclick="resolveAndSwitchTab(${id})"><i class="ti ti-check"></i> 완료</div>
        <div class="tbtn" style="flex:1;justify-content:center" onclick="openIssueEditInDetail(${id})"><i class="ti ti-edit"></i> 수정</div>
        <div class="tbtn" style="flex:1;justify-content:center;color:var(--accent)" onclick="revertIssue(${id})"><i class="ti ti-arrow-back-up"></i> 되돌리기</div>
      </div>`);
  };
  window.resolveAndSwitchTab = async function (id) {
    if (typeof resolveIssue === "function") await resolveIssue(id);
    if (typeof switchIssueTab === "function") switchIssueTab("resolved");
  };
  window.openIssueEditInDetail = function (id) {
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const issue = allIssues.find(i => i.id === id);
    if (!issue) return;
    const dc = document.getElementById("issueDetailContent");
    const actions = document.getElementById("issueDetailActions");
    if (!dc) return;
    dc.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px">제목</div>
          <input class="form-input" id="issueEditTitle" value="${esc(issue.title || "")}" style="width:100%;box-sizing:border-box;font-size:12px">
        </div>
        <div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px">내용</div>
          <textarea class="form-input" id="issueEditDesc" rows="5" style="width:100%;box-sizing:border-box;resize:vertical;font-size:12px">${esc(issue.desc || issue.description || "")}</textarea>
        </div>
      </div>`;
    if (actions) {
      actions.innerHTML = `
        <div class="tbtn primary" onclick="saveIssueEdit(${id})" style="justify-content:center"><i class="ti ti-device-floppy"></i> 저장</div>
        <div class="tbtn" onclick="selectIssue(${id})" style="justify-content:center;margin-top:4px">취소</div>`;
    }
  };
  window.saveIssueEdit = async function (id) {
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const issue = allIssues.find(i => i.id === id);
    if (!issue) return showToast("이슈를 찾을 수 없습니다.", "warn");
    const title = document.getElementById("issueEditTitle")?.value?.trim();
    const description = document.getElementById("issueEditDesc")?.value?.trim() || "";
    if (!title) return showToast("제목을 입력해 주세요.", "warn");
    const apiId = issue.apiId || (isUUID(String(issue.id || "")) ? String(issue.id) : null);
    if (!apiId) return showToast("이슈 ID를 확인할 수 없습니다.", "warn");
    try {
      await api(`/issues/${apiId}`, { method: "PATCH", body: JSON.stringify({ title, description }) });
      issue.title = title;
      issue.desc = description;
      issue.description = description;
      if (typeof selectIssue === "function") selectIssue(id);
      showToast("이슈를 수정했습니다.", "success");
    } catch (_) { showToast("수정 저장에 실패했습니다.", "warn"); }
  };

  // ── renderIssues override ──
  const baseRenderIssues = window.renderIssues;
  window.renderIssues = renderIssues = function () {
    if (G.currentIssueTab === "resolved") { renderResolvedIssues(); return; }
    if (G.currentIssueTab === "inprogress") { renderInProgressIssues(); return; }
    if (G.currentIssueTab === "candidate") { renderPendingRisks(); return; }
    if (G.currentIssueTab === "rejected") { renderRejectedRisks(); return; }
    if (typeof baseRenderIssues === "function") baseRenderIssues();
    const allIssues = typeof issues !== "undefined" ? issues : [];
    const progCnt = document.getElementById("i-prog-cnt");
    if (progCnt) progCnt.textContent = allIssues.filter((i) => i.type === "confirmed").length;
    const doneCnt = document.getElementById("i-done-cnt");
    if (doneCnt) doneCnt.textContent = allIssues.filter((i) => i.type === "resolved").length;
  };

  // ── Todo 벌크 버튼 enable/disable ──
  function refreshTodoBulkState() {
    const tabStatusMap = { inprogress: "approved", ai: "pending", done: "done", rejected: "rejected" };
    const status = tabStatusMap[G.currentTodoTab];
    const checked = Object.keys(G.todoChecked || {}).filter((id) => G.todoChecked[id]).map(Number);
    const allTodos = typeof todos !== "undefined" ? todos : [];
    const hasChecked = allTodos.some((t) => (status ? t.status === status : true) && checked.includes(t.id));
    const container = document.getElementById("todoBulkActions");
    if (!container) return;
    container.querySelectorAll(".tbtn").forEach((btn) => {
      if (btn.style.display === "none") return;
      btn.style.opacity = hasChecked ? "" : "0.4";
      btn.style.pointerEvents = hasChecked ? "" : "none";
    });
  }
  window.refreshTodoBulkState = refreshTodoBulkState;

  const baseToggleChk = window.toggleChk;
  window.toggleChk = toggleChk = function (id, checked) {
    if (typeof baseToggleChk === "function") baseToggleChk(id, checked);
    refreshTodoBulkState();
  };
  const baseToggleAllChk = window.toggleAllChk;
  window.toggleAllChk = toggleAllChk = function (el) {
    if (typeof baseToggleAllChk === "function") baseToggleAllChk(el);
    refreshTodoBulkState();
  };

  // ── 반려 탭: 체크항목 전체 되돌리기 (→ 승인 대기) ──
  window.bulkRestoreRejectedTodos = async function () {
    const checked = Object.keys(G.todoChecked || {}).filter((id) => G.todoChecked[id]).map(Number);
    const allTodos = typeof todos !== "undefined" ? todos : [];
    const items = allTodos.filter((t) => t.status === "rejected" && checked.includes(t.id));
    if (!items.length) return showToast("선택된 반려 Todo가 없습니다.", "info");
    if (!confirm(`${items.length}개 반려 Todo를 승인 대기로 되돌리시겠습니까?`)) return;
    try {
      await Promise.all(items.filter((t) => t.apiId).map((t) =>
        api(`/todos/${t.apiId}`, { method: "PATCH", body: JSON.stringify({ status: "pending", approval_status: "pending" }) })
      ));
      items.forEach((t) => { t.status = "pending"; if (G.todoChecked) G.todoChecked[t.id] = false; });
      if (window.opsRadarApi?.loadTodos) await window.opsRadarApi.loadTodos();
      if (typeof syncTodoCalendar === "function") syncTodoCalendar();
      switchTodoTab("ai");
      showToast(`${items.length}개 Todo를 승인 대기로 되돌렸습니다.`, "success");
    } catch (_) { showToast("되돌리기에 실패했습니다.", "warn"); }
  };

  // ── 승인대기 탭: 체크항목 전체 삭제 (관리자 비번) ──
  window.bulkDeleteAiTodos = function () {
    const checked = Object.keys(G.todoChecked || {}).filter((id) => G.todoChecked[id]).map(Number);
    const allTodos = typeof todos !== "undefined" ? todos : [];
    const items = allTodos.filter((t) => t.status === "pending" && checked.includes(t.id));
    if (!items.length) return showToast("선택된 Todo가 없습니다.", "info");
    showAdminPasswordModal(async () => {
      try {
        await Promise.all(items.filter((t) => t.apiId).map((t) =>
          api(`/todos/${t.apiId}`, { method: "DELETE" })
        ));
        items.forEach((t) => {
          const idx = allTodos.indexOf(t);
          if (idx !== -1) allTodos.splice(idx, 1);
          if (G.todoChecked) G.todoChecked[t.id] = false;
        });
        if (window.opsRadarApi?.loadTodos) await window.opsRadarApi.loadTodos();
        if (typeof syncTodoCalendar === "function") syncTodoCalendar();
        if (typeof renderTodos === "function") renderTodos();
        if (typeof updateTodoCounts === "function") updateTodoCounts();
        showToast(`${items.length}개 Todo를 영구 삭제했습니다.`, "success");
      } catch (_) { showToast("Todo 삭제에 실패했습니다.", "warn"); }
    });
  };

  // ── Todo 진행/승인대기 벌크 영구삭제 ──
  async function bulkDeleteProgressTodos() {
    const statusMap = { inprogress: "approved", ai: "pending" };
    const status = statusMap[G.currentTodoTab];
    if (!status) return;
    const checked = Object.keys(G.todoChecked || {}).filter((id) => G.todoChecked[id]).map(Number);
    const allTodos = typeof todos !== "undefined" ? todos : [];
    const targets = allTodos.filter((t) => t.status === status && checked.includes(t.id));
    if (!targets.length) return showToast("선택된 Todo가 없습니다.", "info");
    showAdminPasswordModal(async () => {
      try {
        await Promise.all(targets.filter((t) => t.apiId).map((t) => api(`/todos/${t.apiId}`, { method: "DELETE" })));
        targets.forEach((t) => {
          const idx = allTodos.indexOf(t);
          if (idx !== -1) allTodos.splice(idx, 1);
          if (G.todoChecked) G.todoChecked[t.id] = false;
        });
        if (window.opsRadarApi?.loadTodos) await window.opsRadarApi.loadTodos();
        if (typeof renderTodos === "function") renderTodos();
        if (typeof updateTodoCounts === "function") updateTodoCounts();
        showToast(`${targets.length}개 Todo를 영구 삭제했습니다.`, "success");
      } catch (_) { showToast("Todo 삭제에 실패했습니다.", "warn"); }
    });
  }
  window.showAdminPasswordModal = showAdminPasswordModal;
  const baseBulkDeleteTodos = window.bulkDeleteTodos;
  window.bulkDeleteTodos = function () {
    if (G.currentTodoTab === "inprogress" || G.currentTodoTab === "ai") {
      bulkDeleteProgressTodos();
    } else {
      if (typeof baseBulkDeleteTodos === "function") baseBulkDeleteTodos();
    }
  };

  async function init() {
    await loadWorkflow();
    configureRoleScreen();
    initializeCalendarToCurrentMonth();
    updateTodoDateColumns();
    if (typeof renderTodos === "function") renderTodos();
    stabilizeLateUi();
  }
  setTimeout(init, 900);
  setTimeout(init, 2800);
  setInterval(stabilizeLateUi, 800);
})();
