(function () {
  const API = window.OPSRADAR_API_BASE || "/api/v1";
  const idMap = new Map();
  let nextUiId = 100000;

  function uiId(kind, apiId) {
    const key = `${kind}:${apiId}`;
    if (!idMap.has(key)) idMap.set(key, nextUiId++);
    return idMap.get(key);
  }

  async function request(path, options = {}) {
    const headers = options.body instanceof FormData
      ? { ...(options.headers || {}) }
      : { "Content-Type": "application/json", ...(options.headers || {}) };
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        detail = body.detail || body.message || detail;
      } catch (_) {}
      throw new Error(detail);
    }
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
      severity: issue.risk_level || issue.severity || "medium",
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
      dominoFinal: issue.domino_impact || "",
      suggestTodo: issue.title ? `${issue.title} follow-up` : null,
      suggestAssignee: issue.assignee || null,
      suggestPriority: (issue.risk_level || issue.severity) === "high" ? "high" : "medium",
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
    if (!year || !month || !day) return null;
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
      const key = `${event.y}-${event.m}-${event.d}`;
      const existing = byDay.get(key);
      if (existing) existing.tags.push(...event.tags);
      else byDay.set(key, event);
    });
    window.G.calEvents = Array.from(byDay.values());
  }

  function normalizeReport(report) {
    const type = report.period === "monthly" ? "monthly" : "weekly";
    return {
      id: report.id,
      apiId: report.id,
      type,
      title: type === "monthly" ? "월간 운영 보고서" : "주간 운영 보고서",
      period: `${report.start_date || report.week_start || "-"} ~ ${report.end_date || report.week_end || "-"}`,
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
    const todoData = await request("/todos");
    const issueData = await request("/issues");
    const docTodos = byDocumentId(todoData.todos, documentId);
    const docIssues = byDocumentId(issueData.issues, documentId);

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

  window.opsRadarCreateCalendarEvent = async function ({ title, day, month, year, color }) {
    const target = new Date(
      year ?? window.G?.currentCalYear ?? new Date().getFullYear(),
      month ?? window.G?.currentCalMonth ?? new Date().getMonth(),
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
          try {
            await request(`/todos/${todo.apiId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: uiStatusToApi("approved"), approval_status: "approved" }),
            });
          } catch (error) {
            console.warn("Todo approve API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
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
              body: JSON.stringify({ approval_status: "rejected" }),
            });
          } catch (error) {
            console.warn("Todo reject API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
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
              body: JSON.stringify({ status: uiStatusToApi("done") }),
            });
          } catch (error) {
            console.warn("Todo done API failed", error);
            showToast("Todo 저장에 실패했습니다.", "warn");
            return;
          }
        }
        original(id);
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

  function patchCalendarActions() {
    if (typeof deleteCalTag === "function") {
      const original = deleteCalTag;
      window.deleteCalTag = deleteCalTag = async function (day, index) {
        const tag = window.G?.calEvents?.find((x) => x.d === day)?.tags[index];
        if (tag?.apiId) {
          try {
            await request(`/calendar/${tag.apiId}`, { method: "DELETE" });
          } catch (error) {
            console.warn("Calendar delete API failed", error);
            showToast("캘린더 삭제에 실패했습니다.", "warn");
            return;
          }
        }
        original(day, index);
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
    patchCreateActions();
    patchCalendarActions();
    patchReportActions();
    patchDocumentAnalysis();
    window.opsRadarApi.reload().then((results) => {
      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length) console.warn("Some OpsRadar API loads failed", rejected);
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
