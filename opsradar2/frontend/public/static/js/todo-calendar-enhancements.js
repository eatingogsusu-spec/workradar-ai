(function () {
  const today = () => new Date().toISOString().slice(0, 10);
  const todoKey = (todo) => String(todo?.apiId || todo?.id || "");
  const selectedTodos = (status) => {
    const checked = Object.keys(G.todoChecked || {}).filter((id) => G.todoChecked[id]).map(Number);
    return todos.filter((todo) => (!status || todo.status === status) && checked.includes(todo.id));
  };
  const api = (path, options = {}) => window.opsRadarApi.request(path, options);
  const jsArg = (value) => typeof value === "number"
    ? String(value)
    : `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

  function recommendedDueDate(todo) {
    const date = new Date();
    const text = `${todo?.title || ""} ${todo?.description || ""}`.toLowerCase();
    const days = todo?.priority === "high" || /긴급|장애|오류|실패|risk|리스크/.test(text) ? 2
      : todo?.priority === "low" ? 14 : 7;
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return "미지정";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }

  function dueDateForEdit(todo) {
    return todo?.dueDate || (todo?.status === "pending" ? recommendedDueDate(todo) : today());
  }

  function enableDateHitbox(input) {
    if (!input || input.dataset.hitboxBound === "true") return;
    input.dataset.hitboxBound = "true";
    const wrap = input.parentElement;
    if (!wrap) return;
    wrap.classList.add("todo-date-hitbox");
    wrap.onclick = (event) => {
      if (event.target.closest("button, select, textarea")) return;
      input.focus();
      if (typeof input.showPicker === "function") input.showPicker();
    };
  }

  const originalOpenEditModal = window.openEditModal;
  window.openEditModal = openEditModal = function (id) {
    originalOpenEditModal(id);
    const todo = todos.find((item) => item.id === id);
    const input = document.getElementById("editDueDate");
    const hint = document.getElementById("editDueHint");
    if (input) input.value = dueDateForEdit(todo);
    enableDateHitbox(input);
    if (hint) {
      const recommendation = recommendedDueDate(todo);
      hint.textContent = todo?.status === "pending"
        ? `AI 추천 마감일: ${formatDate(recommendation)} · 업무 우선순위와 위험 키워드 기준`
        : `마감일: ${formatDate(input?.value || todo?.dueDate)}`;
    }
  };

  window.saveEdit = saveEdit = async function () {
    const todo = todos.find((item) => item.id === G.editTargetId);
    const title = document.getElementById("editTitle")?.value?.trim();
    const description = document.getElementById("editDescription")?.value?.trim() || "";
    const assignee = document.getElementById("editAssignee")?.value || null;
    const dueDate = document.getElementById("editDueDate")?.value || null;
    if (!todo || !title) return;
    try {
      if (todo.apiId) {
        await api(`/todos/${todo.apiId}`, {
          method: "PATCH",
          body: JSON.stringify({ title, description, assignee, due_at: dueDate }),
        });
      }
      todo.title = title;
      todo.description = description;
      todo.assignee = assignee;
      todo.dueDate = dueDate;
      closeModal("editModal");
      await window.opsRadarApi.loadTodos();
      syncTodoCalendar();
      showToast("Todo와 마감일을 수정했습니다.", "success");
    } catch (error) {
      console.warn("Todo edit with due date failed", error);
      showToast("Todo 수정 저장에 실패했습니다.", "warn");
    }
  };

  async function deleteTodos(items, message) {
    if (!items.length) return showToast("선택된 Todo가 없습니다.", "info");
    if (!confirm(message)) return;
    try {
      await Promise.all(items.filter((todo) => todo.apiId).map((todo) => api(`/todos/${todo.apiId}`, { method: "DELETE" })));
      const keys = new Set(items.map(todoKey));
      for (let index = todos.length - 1; index >= 0; index -= 1) {
        if (keys.has(todoKey(todos[index]))) todos.splice(index, 1);
      }
      items.forEach((todo) => { G.todoChecked[todo.id] = false; });
      await window.opsRadarApi.loadTodos();
      syncTodoCalendar();
      renderTodos();
      showToast(`${items.length}개 Todo를 영구 삭제했습니다.`, "success");
    } catch (error) {
      console.warn("Todo permanent delete failed", error);
      showToast("Todo 영구 삭제에 실패했습니다.", "warn");
    }
  }

  window.deleteRejectedTodo = function (id) {
    const todo = todos.find((item) => item.id === id && item.status === "rejected");
    return deleteTodos(todo ? [todo] : [], "이 반려 Todo를 영구 삭제하시겠습니까?\n원본 문서와 더미데이터는 삭제되지 않습니다.");
  };

  window.bulkDeleteTodos = function () {
    const status = G.currentTodoTab === "done" ? "done" : G.currentTodoTab === "rejected" ? "rejected" : null;
    return deleteTodos(selectedTodos(status), "선택한 Todo를 영구 삭제하시겠습니까?\n원본 문서와 더미데이터는 삭제되지 않습니다.");
  };

  window.bulkCompleteTodos = async function () {
    const items = selectedTodos("approved");
    if (!items.length) return showToast("체크된 진행 Todo가 없습니다.", "info");
    try {
      await Promise.all(items.filter((todo) => todo.apiId).map((todo) => api(`/todos/${todo.apiId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed", approval_status: "approved" }),
      })));
      items.forEach((todo) => { todo.status = "done"; G.todoChecked[todo.id] = false; });
      await window.opsRadarApi.loadTodos();
      syncTodoCalendar();
      switchTodoTab("done");
      showToast(`${items.length}개 Todo를 완료 처리했습니다.`, "success");
    } catch (error) {
      console.warn("Todo bulk complete failed", error);
      showToast("체크항목 완료 처리에 실패했습니다.", "warn");
    }
  };

  const baseActionB = window.actionB || actionB;
  window.actionB = actionB = function (todo) {
    if (todo.status === "rejected") {
      return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="undoTodo(${todo.id})">↩ 되돌리기</div><div class="ab ab-reject" onclick="deleteRejectedTodo(${todo.id})">삭제</div></div>`;
    }
    if (todo.status === "done") {
      return `<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-edit" onclick="openTodoDetailModal(${todo.id})">상세보기</div></div>`;
    }
    return baseActionB(todo);
  };

  const baseSwitchTodoTab = window.switchTodoTab || switchTodoTab;
  window.switchTodoTab = switchTodoTab = function (tab) {
    baseSwitchTodoTab(tab);
    const notice = document.getElementById("todoAINotice");
    const text = document.getElementById("todoNoticeText");
    const icon = document.getElementById("todoNoticeIcon");
    const complete = document.getElementById("todoBulkCompleteBtn");
    const remove = document.getElementById("todoBulkDeleteBtn");
    const undo = document.getElementById("todoBulkUndoBtn");
    if (notice) notice.style.display = "flex";
    if (complete) complete.style.display = tab === "inprogress" ? "flex" : "none";
    if (remove) remove.style.display = tab === "done" || tab === "rejected" ? "flex" : "none";
    if (undo) undo.style.marginLeft = tab === "inprogress" ? "0" : "";
    if (tab === "done") {
      if (icon) icon.className = "ti ti-circle-check";
      if (text) text.textContent = "완료 Todo를 상세 확인하거나 선택 항목을 영구 삭제할 수 있습니다.";
    } else if (tab === "rejected") {
      if (icon) icon.className = "ti ti-ban";
      if (text) text.textContent = "반려 Todo를 되돌리거나 선택 항목을 영구 삭제할 수 있습니다.";
    } else if (tab === "inprogress") {
      if (text) text.textContent = "체크한 진행 Todo를 되돌리거나 완료 처리할 수 있습니다.";
    }
    renderTodos();
  };

  function ensureDetailModal() {
    if (document.getElementById("todoReadModal")) return;
    const overlay = document.createElement("div");
    overlay.id = "todoReadModal";
    overlay.className = "modal-overlay";
    overlay.onclick = (event) => { if (event.target === overlay) closeModal("todoReadModal"); };
    overlay.innerHTML = `<div class="modal slide-up" style="width:min(620px,92vw)" onclick="event.stopPropagation()">
      <div class="modal-title">Todo 상세정보</div>
      <div id="todoReadContent"></div>
      <div class="modal-actions"><div class="tbtn" onclick="closeModal('todoReadModal')">닫기</div></div>
    </div>`;
    document.body.appendChild(overlay);
  }

  window.openTodoDetailModal = function (id) {
    const todo = todos.find((item) => item.id === id);
    if (!todo) return;
    ensureDetailModal();
    document.getElementById("todoReadContent").innerHTML = `
      <div style="display:grid;gap:10px">
        <div><div class="form-label">제목</div><div class="form-input">${escapeHtml(cleanTodoTitle(todo.title))}</div></div>
        <div><div class="form-label">업무내용</div><div class="form-input" style="min-height:64px">${escapeHtml(todo.description || briefTodoText(todo))}</div></div>
        <div class="form-row"><div><div class="form-label">담당자</div><div class="form-input">${escapeHtml(todo.assignee || "미지정")}</div></div><div><div class="form-label">상태</div><div class="form-input">${todo.status === "done" ? "완료" : "진행중"}</div></div></div>
        <div><div class="form-label">캘린더 마감일</div><input class="form-input" type="date" value="${escapeHtml(todo.dueDate || "")}" disabled><div style="font-size:10px;color:var(--text3);margin-top:5px">마감일: ${escapeHtml(formatDate(todo.dueDate))}</div></div>
      </div>`;
    openModal("todoReadModal");
  };

  function todoCalendarTags() {
    return todos
      .filter((todo) => (todo.status === "approved" || todo.status === "done") && todo.dueDate)
      .map((todo) => {
        const [year, month, day] = todo.dueDate.split("-").map(Number);
        return {
          year, month: month - 1, day,
          tag: {
            t: `${todo.status === "approved" ? "[진행]" : "[완료]"} ${cleanTodoTitle(todo.title)}`,
            c: todo.status === "approved" ? "ct-info" : "ct-success",
            todoId: todo.id,
            todoStatus: todo.status,
          },
        };
      });
  }

  window.syncTodoCalendar = syncTodoCalendar = function () {
    if (!window.G) return;
    (G.calEvents || []).forEach((event) => {
      event.tags = (event.tags || []).filter((tag) => !tag.todoId);
    });
    todoCalendarTags().forEach(({ year, month, day, tag }) => {
      let event = (G.calEvents || []).find((item) => item.y === year && item.m === month && item.d === day);
      if (!event) {
        event = { y: year, m: month, d: day, tags: [] };
        G.calEvents.push(event);
      }
      event.tags.push(tag);
      event.tags.sort((a, b) => (a.todoStatus === "approved" ? -1 : 0) - (b.todoStatus === "approved" ? -1 : 0));
    });
    if (G.currentScreen === "calendar") renderCalendar(G.currentCalYear, G.currentCalMonth);
  };

  const baseOpenCalModal = window.openCalModal || openCalModal;
  window.openCalModal = openCalModal = function (day) {
    baseOpenCalModal(day);
    const event = (G.calEvents || []).find((item) => item.y === G.currentCalYear && item.m === G.currentCalMonth && item.d === day);
    const list = document.getElementById("calModalList");
    if (!event || !list) return;
    list.innerHTML = (event.tags || []).map((tag, index) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius-sm)">
      <span class="cal-tag ${tag.c}" style="flex:1">${escapeHtml(tag.t)}</span>
      ${tag.todoId ? `<div class="tbtn" onclick="goToCalendarTodo(${tag.todoId})"><i class="ti ti-arrow-right"></i> 해당 Todo로 이동</div>` : `<div onclick="deleteCalTag(${day},${index})" style="cursor:pointer;color:var(--text3);font-size:14px;padding:2px 6px;border-radius:4px;border:1px solid var(--border)" title="삭제">×</div>`}
    </div>`).join("") || '<div style="font-size:11px;color:var(--text3);text-align:center;padding:16px 0">등록된 일정이 없습니다.</div>';
  };

  window.goToCalendarTodo = function (id) {
    const todo = todos.find((item) => item.id === id);
    if (!todo) return;
    closeModal("calModal");
    nav("todo");
    switchTodoTab(todo.status === "done" ? "done" : "inprogress");
    G.selectedTodoId = id;
    renderTodos();
    renderTodoDetail(id);
  };

  const baseReload = window.opsRadarApi.reload;
  window.opsRadarApi.reload = async function () {
    const result = await baseReload();
    syncTodoCalendar();
    return result;
  };

  const baseLoadTodos = window.opsRadarApi.loadTodos;
  window.opsRadarApi.loadTodos = async function () {
    const result = await baseLoadTodos();
    syncTodoCalendar();
    return result;
  };

  const baseLoadCalendar = window.opsRadarApi.loadCalendar;
  window.opsRadarApi.loadCalendar = async function () {
    const result = await baseLoadCalendar();
    syncTodoCalendar();
    return result;
  };

  ["approveTodo", "doneTodo", "undoTodo"].forEach((name) => {
    const original = window[name];
    if (typeof original !== "function") return;
    window[name] = async function (...args) {
      const result = await original(...args);
      syncTodoCalendar();
      return result;
    };
  });

  const approveWithDue = window.approveTodo;
  window.approveTodo = approveTodo = async function (id) {
    const todo = todos.find((item) => item.id === id);
    const dueDate = todo?.dueDate || recommendedDueDate(todo);
    const result = await approveWithDue(id);
    if (todo?.apiId && !todo.dueDate) {
      await api(`/todos/${todo.apiId}`, { method: "PATCH", body: JSON.stringify({ due_at: dueDate }) });
      await window.opsRadarApi.loadTodos();
    }
    syncTodoCalendar();
    return result;
  };

  const bulkApproveWithDue = window.bulkApprove;
  window.bulkApprove = bulkApprove = async function () {
    const items = selectedTodos("pending");
    const dueDates = new Map(items.map((todo) => [todoKey(todo), todo.dueDate || recommendedDueDate(todo)]));
    const result = await bulkApproveWithDue();
    await Promise.all(items.filter((todo) => todo.apiId && !todo.dueDate).map((todo) => api(`/todos/${todo.apiId}`, {
      method: "PATCH",
      body: JSON.stringify({ due_at: dueDates.get(todoKey(todo)) }),
    })));
    if (items.length) await window.opsRadarApi.loadTodos();
    syncTodoCalendar();
    return result;
  };

  const baseNav = window.nav;
  window.nav = nav = function (screen) {
    if (screen === "calendar") syncTodoCalendar();
    return baseNav(screen);
  };

  const baseRenderDashboardLive = window.renderDashboardLive;
  window.renderDashboardLive = async function () {
    if (baseRenderDashboardLive) await baseRenderDashboardLive();
    const unresolved = issues.filter((issue) => issue.type === "confirmed" && issue.status !== "resolved");
    const heading = document.querySelector("#db-admin-view .ops-section-heading > div");
    if (heading) heading.innerHTML = '<i class="ti ti-alert-triangle"></i> 미해결 이슈';
    const grid = document.getElementById("db-high-risk-grid");
    if (!grid) return;
    grid.innerHTML = unresolved.length ? unresolved.slice(0, 6).map((issue) => `<article class="ops-risk-card">
      <div class="ops-risk-card-top"><h3>${escapeHtml(issue.title)}</h3><span class="badge ${issue.severity === "high" ? "b-danger" : issue.severity === "medium" ? "b-warn" : "b-gray"}">${escapeHtml(String(issue.severity || "medium").toUpperCase())}</span></div>
      <p>${escapeHtml(issue.desc || "설명이 없습니다.")}</p>
      <div class="ops-risk-meta"><span>${escapeHtml(issue.status)}</span><span>${escapeHtml(issue.assignee || "담당자 미지정")}</span></div>
      <div class="ops-card-actions"><button onclick="window.openDashboardTodoCreate(${jsArg(issue.id)})">대응 Todo 생성</button><button onclick="openDashboardIssue(${jsArg(issue.id)})">상세 보기</button></div>
    </article>`).join("") : '<article class="ops-risk-card"><div class="ops-risk-card-top"><h3>미해결 이슈 없음</h3><span class="badge b-success">안정</span></div><p>현재 확정된 미해결 이슈가 없습니다.</p></article>';
  };

  window.openTodoCreate = openTodoCreate = function (issueId) {
    const issue = issues.find((item) => String(item.id) === String(issueId));
    if (!issue) return showToast("연결할 이슈를 찾지 못했습니다.", "warn");
    G.createIssueId = issue.id;
    document.getElementById("tcModalSub").textContent = `이슈: ${issue.title.slice(0, 40)}...`;
    document.getElementById("tcModalFrom").textContent = `이 Todo는 "${issue.title.slice(0, 30)}..." 이슈와 연결됩니다.`;
    document.getElementById("tcTitle").value = issue.suggestTodo || `${issue.title} 대응 Todo`;
    document.getElementById("tcDescription").value = `${issue.title} 대응을 위한 원인 확인 및 조치 결과 공유`;
    document.getElementById("tcAssignee").value = issue.suggestAssignee || issue.assignee || (window.opsRadarMembers || [])[0]?.name || "";
    document.getElementById("tcPriority").value = issue.suggestPriority || issue.severity || "medium";
    document.getElementById("tcDue").value = recommendedDueDate({ ...issue, priority: issue.suggestPriority || issue.severity });
    enableDateHitbox(document.getElementById("tcDue"));
    openModal("todoCreateModal");
  };
  window.openDashboardTodoCreate = window.openTodoCreate;
  window.createTodoFromIssue = function (issueId) {
    window.openTodoCreate(issueId);
  };

  window.confirmTodoCreate = async function () {
    const title = document.getElementById("tcTitle")?.value?.trim();
    if (!title) return showToast("Todo 제목을 입력해주세요.", "warn");
    const issue = issues.find((item) => item.id === G.createIssueId);
    const issueApiId = issue?.apiId || (typeof issue?.id === "string" ? issue.id : null);
    const body = {
      title,
      description: document.getElementById("tcDescription")?.value?.trim() || "",
      assignee: document.getElementById("tcAssignee")?.value || null,
      priority: document.getElementById("tcPriority")?.value || "medium",
      due_at: document.getElementById("tcDue")?.value || null,
      status: "in_progress",
      approval_status: "approved",
      source: "manual",
    };
    try {
      if (issueApiId) await api(`/issues/${issueApiId}/todos`, { method: "POST", body: JSON.stringify(body) });
      else await api("/todos", { method: "POST", body: JSON.stringify(body) });
      closeModal("todoCreateModal");
      await window.opsRadarApi.reload();
      nav("todo");
      switchTodoTab("inprogress");
      showToast(`"${title.slice(0, 20)}" Todo가 생성되었습니다.`, "success");
    } catch (error) {
      console.warn("Dashboard issue Todo create failed", error);
      showToast(`Todo 생성에 실패했습니다. ${error.message || ""}`, "warn");
    }
  };

  setTimeout(() => {
    syncTodoCalendar();
    if (typeof renderDashboardLive === "function") renderDashboardLive();
  }, 800);
  setTimeout(syncTodoCalendar, 5000);
})();
