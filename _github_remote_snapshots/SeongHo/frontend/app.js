const uploads = [
  {
    name: "weekly_meeting_2026_05_18.docx",
    type: "회의록",
    status: "완료",
    date: "2026.05.18",
    result: "TODO 4건, 이슈 후보 1건",
  },
  {
    name: "team_chat_export_2026_05_17.csv",
    type: "채팅",
    status: "분석중",
    date: "2026.05.17",
    result: "자연어 이슈 감지 테스트 중",
  },
  {
    name: "dashboard_api_spec_v2.pdf",
    type: "업무 문서",
    status: "완료",
    date: "2026.05.15",
    result: "TODO 근거 문서 3건 연결",
  },
];

const teamMembers = [
  ["PM", "진행 5", "AI 제안 검토 2"],
  ["Frontend", "진행 3", "화면 거의 최종"],
  ["Backend", "진행 4", "API 초안"],
  ["AI", "진행 2", "이슈 감지 테스트"],
];

const resources = [
  ["weekly_meeting_2026_05_18.docx", "회의록", "완료"],
  ["team_chat_export_2026_05_17.csv", "채팅", "분석중"],
  ["dashboard_api_spec_v2.pdf", "문서", "완료"],
  ["handoff_notes.md", "인수인계", "완료"],
];

const todos = [
  {
    title: "대시보드 최종 화면 구조 반영",
    status: "progress",
    priority: "High",
    assignee: "Frontend",
    action: "화면 반영",
    due: "2026.05.20",
    evidence: "사용자 최종 프론트 메모",
    evidenceDate: "2026.05.18",
  },
  {
    title: "마감 3일 전 이슈 자동 생성 규칙 정의",
    status: "suggested",
    priority: "High",
    assignee: "PM",
    action: "정책 승인",
    due: "2026.05.21",
    evidence: "이슈로그 요구사항",
    evidenceDate: "2026.05.18",
  },
  {
    title: "자연어 이슈 감지 가능성 테스트",
    status: "suggested",
    priority: "Medium",
    assignee: "AI",
    action: "샘플 테스트",
    due: "2026.05.23",
    evidence: "채팅 로그 분석 후보",
    evidenceDate: "2026.05.17",
  },
  {
    title: "자료 업로드 상태 표기 완료/분석중 분리",
    status: "done",
    priority: "Medium",
    assignee: "Frontend",
    action: "완료 확인",
    due: "2026.05.18",
    evidence: "AI 분석 화면 요구사항",
    evidenceDate: "2026.05.18",
  },
  {
    title: "근거 없는 TODO 수기 등록 흐름 검토",
    status: "progress",
    priority: "Medium",
    assignee: "PM",
    action: "운영정책 작성",
    due: "2026.05.24",
    evidence: "추적 불가능 업무 기록 고민",
    evidenceDate: "2026.05.18",
  },
  {
    title: "신규 입사자 온보딩 탭 자료 정리",
    status: "progress",
    priority: "Low",
    assignee: "Ops",
    action: "자료실 연결",
    due: "2026.05.27",
    evidence: "지식 전달 요구사항",
    evidenceDate: "2026.05.18",
  },
];

const issues = [
  {
    title: "마감 3일 전 자동 이슈 후보",
    state: "자동 생성",
    owner: "PM",
    severity: "High",
    detail: "대시보드 최종 화면 구조 반영 TODO가 2026.05.20 마감이라 이슈 로그에 노출됩니다.",
  },
  {
    title: "자연어 이슈 감지 테스트 필요",
    state: "검증 필요",
    owner: "AI",
    severity: "Medium",
    detail: "채팅에서 '늦을 것 같다', '막혔다', '스펙이 불명확하다' 같은 표현을 이슈 후보로 잡을 수 있는지 테스트해야 합니다.",
  },
  {
    title: "근거 자료가 없는 업무 누락 위험",
    state: "운영정책 필요",
    owner: "PM",
    severity: "High",
    detail: "근거 문서와 날짜가 없는 업무는 담당자 수기 등록 또는 확인 요청 상태로 남기는 정책이 필요합니다.",
  },
  {
    title: "메일/채팅 연동 범위 미정",
    state: "추후 연동",
    owner: "Backend",
    severity: "Medium",
    detail: "현재는 파일 업로드 기준으로 두고, 이후 메일/채팅 커넥터를 붙일 수 있도록 소스 타입을 분리합니다.",
  },
];

const defaultReport = `[주간 보고서 초안]

1. 요약
- Project AZAG 프론트 구조는 거의 최종안 기준으로 정리되었습니다.
- 핵심 탭은 대시보드, AI 분석, TODO 관리, 이슈 로그, 보고서 생성, 지식 전달, AI Assistant입니다.
- TODO 누락 방지를 위해 근거 문서, 근거 날짜, 담당자 수기 확인 흐름이 필요합니다.

2. 주요 진행
- AI Weekly / Monthly Summary 영역 구성
- 자료 파일 업로드 및 파일명별 분석 상태 구성
- 진행 Todo / AI 제안 / 완료 필터 구성
- 마감 3일 전 이슈 노출 규칙 반영
- 신규 입사자 온보딩 / 재직자 인수인계 탭 구성

3. 확인 필요
- 자연어 기반 이슈 감지 정확도 테스트
- 근거 없는 TODO의 운영 정책
- 메일/채팅 연동 시점과 범위`;

function renderIcons() {
  const template = document.querySelector("#iconSprite");
  const symbols = [...template.content.querySelectorAll("svg")].reduce((map, svg) => {
    map[svg.dataset.name] = svg.outerHTML;
    return map;
  }, {});

  document.querySelectorAll("[data-icon]").forEach((target) => {
    const icon = symbols[target.dataset.icon];
    if (icon) target.innerHTML = icon;
  });
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });
}

function renderUploads() {
  document.querySelector("#uploadTable").innerHTML = uploads
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td><span class="tag">${item.type}</span></td>
          <td><span class="status-chip">${item.status}</span></td>
          <td>${item.date}</td>
          <td>${item.result}</td>
        </tr>
      `
    )
    .join("");
}

function renderTeamStatus() {
  document.querySelector("#teamStatus").innerHTML = teamMembers
    .map(
      ([name, count, note]) => `
        <div class="team-item">
          <strong>${name}</strong>
          <span>${count}</span>
          <p>${note}</p>
        </div>
      `
    )
    .join("");
}

function renderResources() {
  document.querySelector("#resourceList").innerHTML = resources
    .map(
      ([name, type, status]) => `
        <div class="resource-item">
          <strong>${name}</strong>
          <span class="tag">${type}</span>
          <span class="status-chip">${status}</span>
        </div>
      `
    )
    .join("");
}

function renderTodos(filter = "all") {
  const filtered = todos.filter((todo) => filter === "all" || todo.status === filter);

  document.querySelector("#todoBoard").innerHTML = filtered
    .map(
      (todo) => `
        <article class="todo-card">
          <header>
            <h3>${todo.title}</h3>
            <span class="tag">${todo.priority}</span>
          </header>
          <dl class="todo-detail">
            <div><dt>담당자</dt><dd>${todo.assignee}</dd></div>
            <div><dt>상태</dt><dd>${statusLabel(todo.status)}</dd></div>
            <div><dt>액션</dt><dd>${todo.action}</dd></div>
            <div><dt>마감일</dt><dd>${todo.due}</dd></div>
          </dl>
          <p>근거: ${todo.evidence} · ${todo.evidenceDate}</p>
          <div class="todo-actions">
            <button type="button">승인</button>
            <button type="button">수정</button>
            <button type="button">보류</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderIssues() {
  document.querySelector("#issueList").innerHTML = issues
    .map(
      (issue) => `
        <article class="issue-card">
          <header>
            <h3>${issue.title}</h3>
            <span class="${issue.severity === "High" ? "warning-chip" : "tag"}">${issue.severity}</span>
          </header>
          <p>${issue.detail}</p>
          <div class="issue-meta">
            <span class="tag">${issue.state}</span>
            <span class="tag">${issue.owner}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function statusLabel(status) {
  return {
    progress: "진행 Todo",
    suggested: "AI 제안",
    done: "완료",
  }[status];
}

function runPipeline() {
  const status = document.querySelector("#pipelineStatus");
  const steps = [...document.querySelectorAll("#pipeline li")];
  status.textContent = "분석중";
  steps.forEach((step, index) => {
    if (index > 0) step.classList.remove("done");
  });

  steps.forEach((step, index) => {
    setTimeout(() => {
      step.classList.add("done");
      if (index === steps.length - 1) status.textContent = "완료";
    }, 350 * (index + 1));
  });
}

function addFiles(files) {
  [...files].forEach((file) => {
    uploads.unshift({
      name: file.name,
      type: classifyFile(file.name),
      status: "분석중",
      date: "업로드 직후",
      result: "분석 대기",
    });
  });
  renderUploads();
  runPipeline();
}

function classifyFile(name) {
  const lower = name.toLowerCase();
  if (lower.includes("meeting") || lower.includes("회의")) return "회의록";
  if (lower.includes("chat") || lower.includes("slack")) return "채팅";
  if (lower.includes("mail") || lower.includes("email")) return "메일";
  return "업무 문서";
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelector("#runAnalysisTop").addEventListener("click", () => {
    switchView("analysis");
    runPipeline();
  });

  document.querySelector("#simulateUpload").addEventListener("click", runPipeline);

  document.querySelector("#chooseFile").addEventListener("click", () => {
    document.querySelector("#fileInput").click();
  });

  document.querySelector("#fileInput").addEventListener("change", (event) => {
    addFiles(event.target.files);
  });

  const dropZone = document.querySelector("#dropZone");
  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
    addFiles(event.dataTransfer.files);
  });

  document.querySelectorAll(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderTodos(button.dataset.filter);
    });
  });

  document.querySelector("#generateReport").addEventListener("click", () => {
    document.querySelector("#reportText").value = defaultReport;
  });

  document.querySelector("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.querySelector("#chatInput");
    const value = input.value.trim();
    if (!value) return;
    appendChat("user", "사용자", value);
    appendChat("assistant", "AI Assistant", answerQuestion(value));
    input.value = "";
  });

  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.question;
      appendChat("user", "사용자", question);
      appendChat("assistant", "AI Assistant", answerQuestion(question));
    });
  });
}

function appendChat(type, name, text) {
  const message = document.createElement("div");
  message.className = `chat-message ${type}`;
  message.innerHTML = `<strong>${name}</strong><p>${text}</p>`;
  document.querySelector("#chatWindow").appendChild(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
}

function answerQuestion(question) {
  if (question.includes("위험") || question.includes("이슈")) {
    return "현재 가장 위험한 항목은 근거 자료가 없는 업무 누락입니다. 이 항목은 사용자 최종 프론트 메모 2026.05.18을 근거로 운영 정책 결정이 필요합니다.";
  }
  if (question.includes("마감")) {
    return "마감 3일 이내 업무는 대시보드 최종 화면 구조 반영입니다. 담당자는 Frontend이고 마감일은 2026.05.20입니다.";
  }
  if (question.includes("근거")) {
    return "근거가 약한 TODO는 담당자 수기 등록 흐름 검토입니다. 근거 문서와 날짜를 못 잡으면 확인 요청 상태로 남기는 방식을 권장합니다.";
  }
  return "현재 기준으로 TODO 18건, 완료 12건, Blocked 2건, AI 제안 2건이 확인됩니다. 답변에는 가능한 경우 근거 문서와 날짜를 함께 표시합니다.";
}

function init() {
  renderIcons();
  renderUploads();
  renderTeamStatus();
  renderResources();
  renderTodos();
  renderIssues();
  document.querySelector("#reportText").value = defaultReport;
  bindEvents();
}

init();
