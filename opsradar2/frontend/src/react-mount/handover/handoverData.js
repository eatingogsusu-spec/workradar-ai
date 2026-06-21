export const ARCHIVE_KEY = "opsradar_handoff_archives";

export const PEOPLE = ["박서준", "김희진", "정하늘", "최유진", "한지우"];
export const DEPARTMENTS = ["영업관리팀", "구매팀", "품질클레임팀", "물류팀", "운영총괄"];
export const CUSTOMERS = ["전체", "Hyundai Mobis Tier2", "Daesung Automotive", "Mirae EV Systems", "Global Harness Vietnam"];
export const SUPPLIERS = ["전체", "KET Supplier", "TE Connectivity Korea", "Yazaki Parts Asia", "Local Cable Works"];
export const PERIODS = ["최근 1개월", "최근 3개월", "최근 6개월", "최근 1년"];
export const HANDOFF_REASONS = ["담당자 변경", "휴가/부재", "부서 이동", "퇴사"];
export const HANDOFF_SCOPES = ["이전 담당 업무 전체", "특정 고객사", "특정 이슈"];
export const HANDOFF_INCLUDES = ["진행 중 Todo", "미해결 이슈", "최근 보고서", "관련 문서", "일정/마감", "고객별 주의사항"];
export const ONBOARDING_INCLUDES = ["주요 고객사", "주요 품목", "반복 이슈", "미해결 Todo", "최근 보고서", "추천 질문"];

export const DEFAULT_HANDOFF_CONDITIONS = { owner: "", receiver: "", department: "영업관리팀", reason: "담당자 변경", scope: "이전 담당 업무 전체", customer: "전체", supplier: "전체", filterDepartment: "전체", period: "최근 6개월", includes: [...HANDOFF_INCLUDES] };
export const DEFAULT_ONBOARDING_CONDITIONS = { target: "신입", mentor: "", department: "영업관리팀", period: "최근 6개월", includes: [...ONBOARDING_INCLUDES] };

const item = (id, group, title, meta, priority = "Medium") => ({ id, group, title, meta, priority });
export const HANDOFF_CANDIDATES = [
  item("h1", "진행 중 Todo", "Daesung Automotive 긴급 발주 가능 수량 확인", "Daesung Automotive · 박서준", "High"),
  item("h2", "진행 중 Todo", "Hyundai Mobis Tier2 6월 출고 일정 재확인", "Hyundai Mobis Tier2 · 박서준"),
  item("h3", "진행 중 Todo", "TE Connectivity Korea 단가 인상 안내 초안 작성", "Hyundai Mobis Tier2 · 최유진", "High"),
  item("h4", "미해결 이슈", "KET Supplier AP-TM-118 재고 부족 가능성", "Daesung Automotive · 최유진", "High"),
  item("h5", "미해결 이슈", "Mirae EV Systems 반복 품질 클레임", "Mirae EV Systems · 한지우", "High"),
  item("h6", "참고 보고서", "Daesung Automotive 긴급 발주 주간 보고", "주간 보고서"),
  item("h7", "참고 보고서", "KET Supplier 재고 부족 리스크 보고", "월간 보고서", "High"),
  item("h8", "관련 문서", "Hyundai Mobis Tier2 고객별 주문 패턴", "고객 운영 문서"),
  item("h9", "고객별 주의사항", "납기 변경은 최소 5영업일 전 공유 필요", "Hyundai Mobis Tier2", "High")
];
export const ONBOARDING_CANDIDATES = [
  item("o1", "먼저 파악할 고객사", "Hyundai Mobis Tier2", "납기 민감도 높음 · 월별 대량 주문", "High"),
  item("o2", "먼저 파악할 고객사", "Daesung Automotive", "긴급 발주 빈번 · 월말 집중"),
  item("o3", "먼저 파악할 구매처", "KET Supplier", "AP-TM-118 재고 부족 반복", "High"),
  item("o4", "먼저 파악할 구매처", "TE Connectivity Korea", "고단가 품목과 단가 인상 이슈"),
  item("o5", "최근 반복 이슈", "Mirae EV Systems 반복 품질 클레임", "8D 리포트 진행 상태 확인", "High"),
  item("o6", "우선 확인할 Todo", "고객별 납기 리스트 브리핑", "첫날 · 사수 동행", "High"),
  item("o7", "추천 질문", "긴급 발주 요청 시 누구에게 먼저 확인하나요?", "업무 흐름"),
  item("o8", "추천 질문", "High Risk 업무를 단독 처리하지 않는 기준은?", "리스크 기준", "High")
];

const titles = (candidates, ids, group) => candidates.filter((v) => ids.includes(v.id) && (!group || v.group === group)).map((v) => v.title);
const lines = (values) => values.length ? values : ["선택된 항목이 없습니다."];
export function buildPreviewData(type, conditions, candidates, selectedIds) {
  if (type === "onboarding") {
    const selected = candidates.filter((candidate) => selectedIds.includes(candidate.id));
    const todos = selected.filter((candidate) => candidate.id.startsWith("todo_"));
    const issues = selected.filter((candidate) => candidate.id.startsWith("issue_"));
    const issueTitles = issues.map((candidate) => candidate.title);
    const todoTitles = todos.map((candidate) => candidate.title);
    return {
      type,
      title: "3 Step으로 배우는 업무 적응 플랜 - 신입",
      sections: [
        ["1. 업무 지도", [`선택한 ${conditions.department} 운영 자료에서 진행 Todo ${todos.length}건과 미해결 이슈 ${issues.length}건을 우선 학습 범위로 구성했습니다. 실제 업무 흐름과 역할 분담은 사수와 함께 확인이 필요합니다.`]],
        ["2. 1 Step: 흐름과 자료 익히기", lines([...issueTitles, ...todoTitles].slice(0, 5).map((title) => `선택 자료의 제목·현재 상태·출처를 사수와 함께 확인: ${title}`))],
        ["3. 2 Step: 사수와 함께 하는 실전 연습", lines(todoTitles.length ? todoTitles.map((title) => `사수와 함께 처리 흐름과 완료 기준을 확인: ${title}`) : ["실전 연습 후보 없음"] )],
        ["4. 3 Step: 독립 처리 범위와 리스크 기준", lines(issueTitles.length ? issueTitles.map((title) => `이슈 상태와 사수에게 공유해야 할 판단 기준을 합의: ${title}`) : ["선택된 이슈가 없어 사수와 독립 처리 범위 합의 필요"] )],
        ["5. 사수 확인 및 참고 자료", ["선택 자료의 처리 우선순위와 완료 기준을 함께 확인", "단독 처리 가능한 범위와 즉시 공유할 조건을 합의", "연결된 참고 문서를 읽고 모르는 용어와 절차를 질문"]]
      ]
    };
  }
  if (conditions.scope === "특정 이슈") return {
    type, title: `이슈 인수인계서 - ${conditions.owner} → ${conditions.receiver}`,
    sections: [
      ["이슈 개요", [`${conditions.customer} 관련 선택 이슈의 현재 맥락과 담당 부서를 정리합니다.`]],
      ["현재 진행 중 업무", lines(titles(candidates, selectedIds, "진행 중 Todo"))],
      ["미해결 리스크", lines(titles(candidates, selectedIds, "미해결 이슈"))],
      ["관련 부서별 확인사항", [`${conditions.filterDepartment}: 담당 업무와 최신 마감일 확인`, "영업관리팀: 고객 안내 일정과 표현 확인"]],
      ["참고 자료", lines([...titles(candidates, selectedIds, "참고 보고서"), ...titles(candidates, selectedIds, "관련 문서")])],
      ["다음 액션", [`${conditions.receiver}: 미해결 리스크 우선순위 확인`, "관련 부서와 마감 일정 재확인"]]
    ]
  };
  return {
    type, title: `업무 인수인계서 - ${conditions.owner} → ${conditions.receiver}`,
    sections: [
      ["인수인계 개요", [`${conditions.owner} 담당자의 ${conditions.scope}를 ${conditions.receiver} 담당자에게 인계합니다.`, `${conditions.period} 업무 기록을 기준으로 정리했습니다.`]],
      ["담당 고객사 / 협력사", [`고객사: ${conditions.customer}`, `협력사: ${conditions.supplier}`, `소속 팀: ${conditions.department}`]],
      ["현재 진행 중 Todo", lines(titles(candidates, selectedIds, "진행 중 Todo"))],
      ["미해결 이슈", lines(titles(candidates, selectedIds, "미해결 이슈"))],
      ["주요 리스크", lines(titles(candidates, selectedIds, "미해결 이슈"))],
      ["고객별 주의사항", lines(titles(candidates, selectedIds, "고객별 주의사항"))],
      ["관련 부서별 확인사항", ["구매팀: 재고와 단가 적용일 확인", "물류팀: 출고 일정과 긴급 배송 비용 확인", "품질클레임팀: 8D 리포트 일정 확인"]],
      ["참고 보고서 / 문서", lines([...titles(candidates, selectedIds, "참고 보고서"), ...titles(candidates, selectedIds, "관련 문서")])],
      ["다음 액션", [`${conditions.receiver}: 고객별 미완료 Todo 확인`, "관련 부서와 High Risk 항목 마감 일정 재확인"]],
      ["팀장 확인 항목", ["인수인계 범위에 빠진 고객사가 없는지 확인", "미완료 Todo 담당자와 마감일 확인", "신규 담당자의 우선 처리 업무 확인"]]
    ]
  };
}

const API_BASE = "/api/v1";

function getAuthToken() {
  const direct = localStorage.getItem("access_token") || localStorage.getItem("token");
  if (direct) return direct;
  try {
    const session = JSON.parse(localStorage.getItem("opsradar_session") || "null");
    if (session?.access_token || session?.token) return session.access_token || session.token;
  } catch (_) {}
  try {
    return JSON.parse(localStorage.getItem("auth") || "null")?.token || "";
  } catch (_) {
    return "";
  }
}

function normalizePriority(value) {
  const v = (value || "").toLowerCase();
  if (v === "high" || v === "critical") return "High";
  if (v === "low") return "Low";
  return "Medium";
}

export async function fetchHandoffCandidates() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const [todosRes, issuesRes] = await Promise.all([
    fetch(`${API_BASE}/todos?status=in_progress&limit=50`, { headers }),
    fetch(`${API_BASE}/issues?status=open&limit=50`, { headers }),
  ]);
  if (!todosRes.ok || !issuesRes.ok) throw new Error("API fetch failed");
  const [todosData, issuesData] = await Promise.all([todosRes.json(), issuesRes.json()]);

  const todoItems = (todosData.todos || []).map((t) => ({
    id: `todo_${t.id}`,
    group: "진행 중 Todo",
    title: t.title,
    meta: t.assignee || "",
    priority: normalizePriority(t.priority),
    description: t.description || t.content || "",
    dueAt: t.due_at || t.due_date || "",
    team: t.team_name || t.department || "",
  }));

  const issueItems = (issuesData.issues || []).map((i) => ({
    id: `issue_${i.id}`,
    group: "미해결 이슈",
    title: i.title,
    meta: i.assignee || "",
    priority: normalizePriority(i.risk_level),
    description: i.description || i.risk_reason || "",
    team: i.team_name || i.department || "",
  }));

  const staticItems = HANDOFF_CANDIDATES.filter(
    (c) => c.group !== "진행 중 Todo" && c.group !== "미해결 이슈"
  );

  return [...todoItems, ...issueItems, ...staticItems];
}

// 온보딩은 예시 고객사 목록이 아니라 현재 실제로 진행 중인 업무와 리스크를 학습 재료로 삼는다.
export function buildOnboardingCandidates(candidates) {
  const operational = candidates
    .filter((candidate) => candidate.id.startsWith("todo_") || candidate.id.startsWith("issue_"))
    .map((candidate) => ({
      ...candidate,
      group: candidate.id.startsWith("todo_") ? "첫주 실전 연습 Todo" : "업무 지도: 현재 리스크",
    }));
  return operational.length ? operational : ONBOARDING_CANDIDATES;
}

export async function fetchMembers() {
  try {
    const res = await fetch(`${API_BASE}/members?active_only=true`);
    if (!res.ok) throw new Error("Members fetch failed");
    const data = await res.json();
    const members = data.members || [];
    const names = [...new Set(members.map((m) => m.name).filter(Boolean))];
    const teamMap = {};
    for (const m of members) {
      if (m.name && m.team_name) teamMap[m.name] = m.team_name;
    }
    return { names, teamMap };
  } catch {
    return { names: PEOPLE, teamMap: {} };
  }
}

// AI 인수인계서 생성: 백엔드 LLM 호출. 실패/미설정 시 fallback 신호 반환.
export async function fetchHandoverPreview({ owner, receiver, target, mentor, type, todoIds, issueIds, department, period }) {
  try {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/knowledge/generate-handover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        owner,
        receiver,
        target,
        mentor,
        type,
        todo_ids: todoIds,
        issue_ids: issueIds,
        department,
        period,
      }),
    });
    if (!res.ok) return { content: null, mode: "fallback", documents: [] };
    const data = await res.json();
    return { content: data.content, mode: data.generation_mode, documents: data.documents || [] };
  } catch {
    return { content: null, mode: "fallback", documents: [] };
  }
}

// LLM markdown(## 1.~## 4.)을 HandoffPreview가 쓰는 { title, sections, documents } 구조로 변환.
export function parseHandoverMarkdown(md, title, documents = [], type = "handoff") {
  const sections = [];
  let current = null;
  for (const raw of (md || "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("## ")) {
      if (current) sections.push(current);
      // "## 1. 인수인계 개요" → "1. 인수인계 개요"
      current = [line.slice(3).trim(), []];
    } else if (line.startsWith("# ")) {
      continue; // 최상위 제목은 무시(handover 출력엔 없음)
    } else if (current && line.trim()) {
      current[1].push(line);
    }
  }
  if (current) sections.push(current);
  return { type, title: title || (type === "onboarding" ? "3 Step으로 배우는 업무 적응 플랜 - 신입" : "업무 인수인계서"), sections, documents };
}

export async function fetchWorkflowReview() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}/workflow/review`, { headers });
  if (!res.ok) throw new Error("Workflow review fetch failed");
  return res.json();
}

export function readArchives() { try { const data = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || "[]"); return Array.isArray(data) ? data : []; } catch { return []; } }
export function writeArchives(value) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(value)); }
export function deleteArchive(id) { const list = readArchives().filter((a) => a.id !== id); writeArchives(list); return list; }
