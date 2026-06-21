(function () {
  const api = (path, options = {}) => window.opsRadarApi.request(path, options);
  const riskKey = (item) => String(item?.apiId || item?.id || "");
  const activeNames = () => (window.opsRadarMembers || [])
    .filter((member) => (member.status || "active") === "active")
    .map((member) => member.name)
    .filter(Boolean);
  const assigneeOptions = (selected = "") => {
    const names = activeNames();
    const options = ['<option value="">미지정</option>']
      .concat(names.map((name) => `<option value="${escapeHtml(name)}" ${name === selected ? "selected" : ""}>${escapeHtml(name)}</option>`));
    if (selected && !names.includes(selected)) options.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
    return options.join("");
  };
  const defaultDueDate = () => {
    const value = new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  };
  const recommendRiskAssignee = (item) => {
    const members = (window.opsRadarMembers || []).filter((member) => (member.status || "active") === "active");
    const text = `${item?.title || ""} ${item?.desc || item?.description || ""}`.toLowerCase();
    const named = members.find((member) => text.includes(String(member.name || "").toLowerCase()));
    if (named) return named.name;
    // 역할 키워드만으로 특정 팀원을 선택하지 않는다. 원문에 이름 근거가 없으면 미지정이다.
    return "";
  };

  function getAnalysisRisks() {
    if (Array.isArray(G.analysisRiskReview) && G.analysisRiskReview.length) return G.analysisRiskReview;
    const documentId = G.lastAnalysisDocumentId;
    G.analysisRiskReview = issues
      .filter((issue) => !documentId || issue.src === documentId)
      .filter((issue) => issue.type === "candidate")
      .map((issue) => ({ ...issue, suggestAssignee: issue.suggestAssignee || recommendRiskAssignee(issue), dueDate: issue.dueDate || defaultDueDate() }));
    return G.analysisRiskReview;
  }

  window.openAnalysisRiskReview = function () {
    const items = getAnalysisRisks();
    if (!items.length) {
      showToast("검토할 리스크가 없습니다.", "info");
      return;
    }
    G.analysisRiskChecked = G.analysisRiskChecked || {};
    items.forEach((item) => {
      const key = riskKey(item);
      if (G.analysisRiskChecked[key] === undefined) G.analysisRiskChecked[key] = true;
    });
    document.getElementById("analysisRiskCloseConfirm").style.display = "none";
    document.getElementById("analysisRiskModal").classList.add("show");
    renderAnalysisRiskReview();
  };

  window.renderAnalysisRiskReview = function () {
    const list = document.getElementById("analysisRiskList");
    if (!list) return;
    const items = getAnalysisRisks();
    if (!items.length) {
      list.innerHTML = '<div style="padding:28px;text-align:center;color:var(--text3);font-size:12px">남은 리스크 후보가 없습니다.</div>';
      updateAnalysisRiskCheckedCount();
      return;
    }
    list.innerHTML = items.map((item, index) => {
      const key = riskKey(item);
      const checked = G.analysisRiskChecked?.[key] !== false;
      const description = item.desc || item.description || item.title || "";
      return `<div style="border:1px solid var(--border);background:var(--surface2);border-radius:var(--radius-sm);padding:10px;display:grid;grid-template-columns:24px minmax(0,1fr) 145px;gap:10px;align-items:start">
        <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleAnalysisRiskChecked('${escapeHtml(key)}',this.checked)" style="accent-color:var(--danger);margin-top:7px">
        <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
          <input class="form-input" value="${escapeHtml(item.title || "")}" oninput="updateAnalysisRiskField(${index},'title',this.value)" placeholder="Risk 제목">
          <textarea class="form-input" rows="2" style="resize:vertical" oninput="updateAnalysisRiskField(${index},'desc',this.value)" placeholder="간단한 내용">${escapeHtml(description)}</textarea>
        </div>
        <div><div class="form-label">마감기한</div><input class="form-input" type="date" value="${escapeHtml(item.dueDate || defaultDueDate())}" onchange="updateAnalysisRiskField(${index},'dueDate',this.value)"></div>
      </div>`;
    }).join("");
    updateAnalysisRiskCheckedCount();
  };

  window.updateAnalysisRiskField = function (index, field, value) {
    const item = getAnalysisRisks()[index];
    if (item) item[field] = value;
  };
  window.toggleAnalysisRiskChecked = function (key, checked) {
    G.analysisRiskChecked = G.analysisRiskChecked || {};
    G.analysisRiskChecked[key] = checked;
    updateAnalysisRiskCheckedCount();
  };
  window.setAllAnalysisRiskChecked = function (checked) {
    G.analysisRiskChecked = G.analysisRiskChecked || {};
    getAnalysisRisks().forEach((item) => { G.analysisRiskChecked[riskKey(item)] = checked; });
    renderAnalysisRiskReview();
  };
  function selectedRisks() {
    return getAnalysisRisks().filter((item) => G.analysisRiskChecked?.[riskKey(item)] !== false);
  }
  window.updateAnalysisRiskCheckedCount = function () {
    const element = document.getElementById("analysisRiskCheckedCount");
    if (element) element.textContent = selectedRisks().length;
  };

  window.moveCheckedAnalysisRisksToConfirmed = async function () {
    const selected = selectedRisks();
    if (!selected.length) return showToast("선택된 리스크가 없습니다.", "info");
    try {
      await Promise.all(selected.map(async (item) => {
        if (item.apiId) {
          await api(`/issues/${item.apiId}`, {
            method: "PATCH",
            body: JSON.stringify({
              title: item.title,
              description: item.desc || item.description || "",
              assignee: null,
              status: item.status === "blocked" ? "blocked" : "open",
              approval_status: "approved",
            }),
          });
        }
        item.type = "confirmed";
        item.approvalStatus = "approved";
      }));
      const keys = new Set(selected.map(riskKey));
      G.analysisRiskReview = getAnalysisRisks().filter((item) => !keys.has(riskKey(item)));
      selected.forEach((item) => delete G.analysisRiskChecked[riskKey(item)]);
      await window.opsRadarApi.reload();
      renderAnalysisRiskReview();
      renderDashboardLive();
      showToast(`${selected.length}개 리스크를 확정 이슈로 이동했습니다.`, "success");
      if (!G.analysisRiskReview.length) closeModal("analysisRiskModal");
    } catch (error) {
      console.warn("Risk confirmation failed", error);
      showToast("리스크 확정 또는 일정 등록에 실패했습니다.", "warn");
    }
  };

  window.deleteCheckedAnalysisRisks = async function () {
    const selected = selectedRisks();
    if (!selected.length) return showToast("선택된 리스크가 없습니다.", "info");
    try {
      await Promise.all(selected.filter((item) => item.apiId).map((item) => api(`/issues/${item.apiId}`, { method: "DELETE" })));
      const keys = new Set(selected.map(riskKey));
      G.analysisRiskReview = getAnalysisRisks().filter((item) => !keys.has(riskKey(item)));
      selected.forEach((item) => delete G.analysisRiskChecked[riskKey(item)]);
      await window.opsRadarApi.loadIssues();
      renderAnalysisRiskReview();
      renderDashboardLive();
      showToast(`${selected.length}개 리스크를 삭제했습니다.`, "info");
      if (!G.analysisRiskReview.length) closeModal("analysisRiskModal");
    } catch (error) {
      console.warn("Risk delete failed", error);
      showToast("리스크 삭제에 실패했습니다.", "warn");
    }
  };

  window.requestCloseAnalysisRiskModal = function () {
    if (getAnalysisRisks().length) {
      document.getElementById("analysisRiskCloseConfirm").style.display = "block";
      return;
    }
    closeModal("analysisRiskModal");
  };
  window.confirmCloseAnalysisRiskModal = function (close) {
    document.getElementById("analysisRiskCloseConfirm").style.display = "none";
    if (close) closeModal("analysisRiskModal");
  };

  window.openDashboardTodoTab = function (tab) {
    nav("todo");
    switchTodoTab(tab);
  };
  window.openDashboardIssue = function (id) {
    nav("issues");
    switchIssueTab("inprogress");
    selectIssue(id);
  };

  window.renderDashboardLive = async function () {
    const pending = todos.filter((todo) => todo.status === "pending");
    const progress = todos.filter((todo) => todo.status === "approved");
    const done = todos.filter((todo) => todo.status === "done");
    const rejected = todos.filter((todo) => todo.status === "rejected");
    const highRisks = issues.filter((issue) => issue.type === "confirmed" && issue.severity === "high" && issue.status !== "resolved");
    const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };

    setText("db-data-chip", `운영 데이터 ${todos.length + issues.length}건`);
    setText("db-pending-chip", `AI 제안 ${pending.length}건`);
    setText("db-progress-count", progress.length);
    setText("db-done-count", done.length);
    setText("db-rejected-count", rejected.length);
    setText("db-approval-count", pending.length);
    setText("db-pending", pending.length);
    setText("db-todo-rate", `${done.length} / ${todos.length}`);

    try {
      const summary = await api("/dashboard/summary");
      setText("db-blocked-chip", `Blocked Todo ${summary.blocked_count || 0}건`);
    } catch (_) {
      setText("db-blocked-chip", "Blocked Todo 0건");
    }

    const approvalList = document.getElementById("db-ai-todo-list");
    if (approvalList) {
      approvalList.innerHTML = progress.length
        ? progress.slice(0, 4).map((todo) => `<div class="ops-approval-item" onclick="openDashboardTodoTab('inprogress')"><div><strong>${escapeHtml(cleanTodoTitle(todo.title))}</strong><span>${escapeHtml(briefTodoText(todo))}</span></div><i class="ti ti-arrow-right"></i></div>`).join("")
        : '<div class="ops-approval-item" onclick="openDashboardTodoTab(\'inprogress\')"><div><strong>진행중 Todo 없음</strong><span>진행 Todo가 생성되면 표시됩니다.</span></div><i class="ti ti-arrow-right"></i></div>';
    }

    const riskGrid = document.getElementById("db-high-risk-grid");
    if (riskGrid) {
      riskGrid.innerHTML = highRisks.length
        ? highRisks.slice(0, 3).map((issue) => `<article class="ops-risk-card">
            <div class="ops-risk-card-top"><h3>${escapeHtml(issue.title)}</h3><span class="badge b-danger">HIGH</span></div>
            <p>${escapeHtml(issue.desc || "설명이 없습니다.")}</p>
            <div class="ops-risk-meta"><span>${escapeHtml(issue.status)}</span><span>${escapeHtml(issue.assignee || "담당자 미지정")}</span></div>
            <div class="ops-domino"><strong>도미노 영향</strong><span>${escapeHtml(issue.dominoFinal || "운영 영향 분석 대기")}</span></div>
            <div class="ops-card-actions"><button onclick="openTodoCreate(${JSON.stringify(issue.id)})">대응 Todo 생성</button><button onclick="openDashboardIssue(${JSON.stringify(issue.id)})">상세 보기</button></div>
          </article>`).join("")
        : '<article class="ops-risk-card"><div class="ops-risk-card-top"><h3>High Risk 이슈 없음</h3><span class="badge b-success">안정</span></div><p>현재 확정된 High Risk 이슈가 없습니다.</p><div class="ops-card-actions"><button onclick="nav(\'issues\')">이슈 로그 보기</button></div></article>';
    }
  };

  const originalNav = window.nav;
  window.nav = nav = function (screen) {
    originalNav(screen);
    if (screen === "dashboard") renderDashboardLive();
  };

  const originalReload = window.opsRadarApi.reload;
  window.opsRadarApi.reload = async function () {
    const result = await originalReload();
    await renderDashboardLive();
    return result;
  };

  setTimeout(renderDashboardLive, 500);
})();
