import { useEffect, useState } from "react";

const defaultAdminRisks = [
  {
    issueId: "payment-api",
    title: "Risk 데이터 없음",
    description: "운영 로그 분석 후 High Risk 이슈가 이 영역에 표시됩니다.",
    action: "대응 Todo 생성",
    badge: "대기",
    badgeClass: "badge b-accent",
    meta: ["Blocked 0", "대기 중"],
    domino: "분석 데이터 연결 후 영향 흐름이 표시됩니다.",
  },
  {
    issueId: "db-pool",
    title: "Risk 데이터 없음",
    description: "확인된 운영 리스크가 아직 없습니다.",
    action: "담당자 지정",
    badge: "대기",
    badgeClass: "badge b-accent",
    meta: ["Blocked 0", "대기 중"],
    domino: "분석 데이터 연결 후 영향 흐름이 표시됩니다.",
  },
  {
    issueId: "deploy-pipeline",
    title: "Risk 데이터 없음",
    description: "확인된 운영 리스크가 아직 없습니다.",
    action: "대응 Todo 생성",
    badge: "대기",
    badgeClass: "badge b-accent",
    meta: ["Blocked 0", "대기 중"],
    domino: "분석 데이터 연결 후 영향 흐름이 표시됩니다.",
  },
];

const memberTasks = [
  { priority: "P0", className: "ops-task-item high" },
  { priority: "P1", className: "ops-task-item" },
  { priority: "P1", className: "ops-task-item" },
];

const fallbackIssueDetails = {
  "payment-api": {
    id: "payment-api",
    title: "결제 API 응답 지연",
    severity: "HIGH",
    status: "Blocked",
    elapsed: "48시간",
    assignee: "Backend",
    reason:
      "평균 응답시간 3.2초, 결제 완료율 하락, 고객 이탈 우려가 감지되었습니다.",
    dominoImpact:
      "API 지연 -> 결제 실패 -> 고객 문의 증가 -> 고객 이탈 -> 매출 영향",
    relatedTodos: ["API 재시도 로직 점검", "DB 커넥션 풀 확인", "백업 결제 경로 점검"],
    relatedDocs: ["issue_log_20260514_azure_timeout.txt", "payment_api_latency_report.csv"],
  },
  "db-pool": {
    id: "db-pool",
    title: "DB 커넥션 풀 고갈",
    severity: "HIGH",
    status: "Monitoring",
    elapsed: "1일",
    assignee: "Infra",
    reason: "최대 연결 수에 근접한 상태가 반복되어 신규 요청 실패 가능성이 있습니다.",
    dominoImpact: "DB 연결 대기 -> API timeout -> 운영 로그 누락 -> 원인 추적 지연",
    relatedTodos: ["커넥션 풀 임계치 조정", "장기 실행 쿼리 확인", "모니터링 알림 기준 재설정"],
    relatedDocs: ["db_pool_metrics_202605.csv", "ops_runbook_database.md"],
  },
  "deploy-pipeline": {
    id: "deploy-pipeline",
    title: "배포 파이프라인 실패",
    severity: "HIGH",
    status: "Pending Fix",
    elapsed: "2일",
    assignee: "DevOps",
    reason: "최근 배포 실패가 반복되어 긴급 패치 반영과 QA 확인이 지연될 가능성이 있습니다.",
    dominoImpact: "배포 실패 -> 패치 지연 -> 운영 장애 지연 -> 인수인계 부담 증가",
    relatedTodos: ["QA 자동화 로그 확인", "롤백 경로 점검", "배포 권한 및 secret 확인"],
    relatedDocs: ["deploy_failure_202605.log", "qa_pipeline_checklist.md"],
  },
};

function getIssueDetail(issueId) {
  return (
    window.getDashboardIssueDetailData?.(issueId) ||
    fallbackIssueDetails[issueId] ||
    fallbackIssueDetails["payment-api"]
  );
}

function IssueDetailPanel({ issue, onClose }) {
  if (!issue) return null;

  const relatedTodos = issue.relatedTodos?.length
    ? issue.relatedTodos
    : ["연결된 Todo가 없습니다."];
  const relatedDocs = issue.relatedDocs?.length
    ? issue.relatedDocs
    : ["연결된 문서가 없습니다."];

  return (
    <div className="issue-detail-panel show" id="issueDetailPanel">
      <button
        className="issue-detail-backdrop"
        type="button"
        aria-label="이슈 상세 닫기"
        onClick={onClose}
      />
      <aside
        className="issue-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="이슈 상세 정보"
      >
        <div className="issue-detail-head">
          <div>
            <div className="issue-detail-eyebrow">HIGH RISK DETAIL</div>
            <div className="issue-detail-title text-content">{issue.title}</div>
          </div>
          <button
            className="issue-detail-close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="issue-detail-body">
          <div className="issue-detail-meta">
            <div className="issue-detail-box">
              <span>심각도</span>
              <strong>
                <span className="badge b-danger issue-severity-high">
                  {issue.severity}
                </span>
              </strong>
            </div>
            <div className="issue-detail-box">
              <span>현재 상태</span>
              <strong>{issue.status}</strong>
            </div>
            <div className="issue-detail-box">
              <span>발생/경과 시간</span>
              <strong>{issue.elapsed}</strong>
            </div>
            <div className="issue-detail-box">
              <span>담당자</span>
              <strong>{issue.assignee}</strong>
            </div>
          </div>
          <section className="issue-detail-section">
            <h4>
              <i className="ti ti-brain" /> AI 판단 근거
            </h4>
            <p>{issue.reason}</p>
          </section>
          <section className="issue-detail-section">
            <h4>
              <i className="ti ti-route" /> 도미노 영향
            </h4>
            <p>{issue.dominoImpact}</p>
          </section>
          <section className="issue-detail-section">
            <h4>
              <i className="ti ti-checkbox" /> 관련 Todo
            </h4>
            <ul className="issue-detail-list">
              {relatedTodos.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section className="issue-detail-section">
            <h4>
              <i className="ti ti-file-text" /> 관련 문서
            </h4>
            <ul className="issue-detail-list">
              {relatedDocs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
        <div className="issue-detail-actions">
          <button
            className="tbtn primary"
            type="button"
            onClick={() => window.createTodoFromIssue?.(issue.id)}
          >
            <i className="ti ti-plus" /> 대응 Todo 생성
          </button>
          <button
            className="tbtn"
            type="button"
            onClick={() => window.assignIssueOwner?.(issue.id)}
          >
            <i className="ti ti-user-check" /> 담당자 지정
          </button>
          <button
            className="tbtn"
            type="button"
            onClick={() => window.updateIssueStatus?.(issue.id, "in_progress")}
          >
            <i className="ti ti-refresh" /> 상태 변경
          </button>
        </div>
      </aside>
    </div>
  );
}

function RiskCard({ risk, onIssueDetail, onNav }) {
  const [primaryMeta, secondaryMeta] = risk.meta || ["Blocked 0", "대기 중"];

  return (
    <article className="ops-risk-card">
      <div className="ops-risk-card-top">
        <h3>{risk.title}</h3>
        <span className={risk.badgeClass || "badge b-accent"}>
          {risk.badge || "대기"}
        </span>
      </div>
      <p>{risk.description}</p>
      <div className="ops-risk-meta">
        <span>{primaryMeta}</span>
        <span>{secondaryMeta}</span>
      </div>
      <div className="ops-domino">
        <strong>도미노 영향</strong>
        <span>{risk.domino || "분석 데이터 연결 후 영향 흐름이 표시됩니다."}</span>
      </div>
      <div className="ops-card-actions">
        <button type="button" onClick={() => onNav("todo")}>
          {risk.action}
        </button>
        <button
          type="button"
          data-dashboard-issue-detail={risk.issueId}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onIssueDetail(event.currentTarget.dataset.dashboardIssueDetail);
          }}
        >
          상세 보기
        </button>
      </div>
    </article>
  );
}

function AdminDashboard({ risks, onIssueDetail, onNav }) {
  return (
    <div id="db-admin-view" className="ops-dashboard-view active">
      <section className="ops-ai-summary-card">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <i className="ti ti-sparkles" /> AI 운영 판단 요약
          </div>
          <span className="ops-updated">
            <i className="ti ti-clock" /> 마지막 업데이트 15분 전
          </span>
        </div>
        <div className="ops-ai-body">
          <p>
            운영 로그와 Todo 데이터가 연결되면 AI가 현재 운영 상태, 위험 요인,
            우선 실행 항목을 요약합니다.
          </p>
          <div className="ops-evidence-chips">
            <span className="ops-chip blue">운영 데이터 대기</span>
            <span className="ops-chip warn">Blocked Todo 0건</span>
            <span className="ops-chip green">승인 대기 0건</span>
          </div>
        </div>
      </section>

      <section>
        <div className="ops-section-heading">
          <div>
            <i className="ti ti-alert-triangle" /> High Risk 이슈
          </div>
          <button
            className="ops-link-btn"
            type="button"
            onClick={() => onNav("issues")}
          >
            전체 이슈 보기 <i className="ti ti-arrow-right" />
          </button>
        </div>
        <div className="ops-risk-grid">
          {risks.map((risk) => (
            <RiskCard
              key={risk.issueId}
              risk={risk}
              onIssueDetail={onIssueDetail}
              onNav={onNav}
            />
          ))}
        </div>
      </section>

      <section className="ops-bottom-grid">
        <div className="ops-panel">
          <div className="ops-panel-title">Todo 실행 현황</div>
          <div className="ops-stat-row">
            <div>
              <span className="ops-stat-num success">0</span>
              <span className="ops-stat-label">완료</span>
            </div>
            <div>
              <span className="ops-stat-num blue">0</span>
              <span className="ops-stat-label">진행중</span>
            </div>
            <div>
              <span className="ops-stat-num warn" id="db-blocked">
                0
              </span>
              <span className="ops-stat-label">Blocked</span>
            </div>
          </div>
          <div className="ops-progress-stack">
            <div style={{ width: "0%", background: "var(--success)" }} title="완료" />
            <div
              style={{ width: "0%", background: "var(--accent-blue)" }}
              title="진행중"
            />
            <div
              id="db-todo-bar"
              style={{ width: "0%", background: "var(--warning)" }}
              title="Blocked"
            />
          </div>
          <div className="ops-muted-line">
            <span id="db-todo-rate">0 / 0</span> 완료, 운영 데이터 연결 대기 중
          </div>
        </div>
        <div className="ops-panel">
          <div className="ops-panel-title">승인 대기</div>
          <div className="ops-approval-list">
            <button
              className="ops-approval-item"
              type="button"
              onClick={() => onNav("todo")}
            >
              <div>
                <strong>승인 대기 항목 없음</strong>
                <span>AI 생성 Todo 승인 요청이 생성되면 표시됩니다.</span>
              </div>
              <i className="ti ti-arrow-right" />
            </button>
          </div>
          <div className="ops-muted-line">
            <span id="db-pending">0</span>건 승인 대기 중
          </div>
        </div>
      </section>
    </div>
  );
}

function MemberDashboard({ onNav }) {
  return (
    <div id="db-member-view" className="ops-dashboard-view active">
      <section className="ops-ai-summary-card member">
        <div className="ops-card-header">
          <div className="ops-card-title">
            <i className="ti ti-user-check" /> 오늘 내 업무 요약
          </div>
          <span className="ops-updated">
            <i className="ti ti-clock" /> 오전 스탠드업 기준
          </span>
        </div>
        <div className="ops-ai-body">
          <p>
            내 Todo와 일정 데이터가 연결되면 오늘 우선 작업, 관련 이슈,
            필요한 브리핑이 표시됩니다.
          </p>
          <div className="ops-evidence-chips">
            <span className="ops-chip blue">내 Todo 5건</span>
            <span className="ops-chip warn">Blocked 0건</span>
            <span className="ops-chip green">오늘 일정 2건</span>
          </div>
        </div>
      </section>

      <section className="ops-member-grid">
        <div className="ops-panel">
          <div className="ops-panel-title">오늘 우선 작업</div>
          <div className="ops-task-list">
            {memberTasks.map((task, index) => (
              <div className={task.className} key={`${task.priority}-${index}`}>
                <span>{task.priority}</span>
                <div>
                  <strong>등록된 우선 작업 없음</strong>
                  <small>Todo 데이터 연결 후 표시됩니다.</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ops-panel">
          <div className="ops-panel-title">내 관련 이슈</div>
          <div className="ops-issue-mini danger">
            <div>
              <strong>Risk 데이터 없음</strong>
              <span>관련 이슈 없음</span>
            </div>
            <button type="button" onClick={() => onNav("issues")}>
              보기
            </button>
          </div>
          <div className="ops-issue-mini warn">
            <div>
              <strong>Risk 데이터 없음</strong>
              <span>관련 이슈 없음</span>
            </div>
            <button type="button" onClick={() => onNav("issues")}>
              보기
            </button>
          </div>
        </div>
      </section>

      <section className="ops-bottom-grid">
        <div className="ops-panel">
          <div className="ops-panel-title">내 Todo 진행 현황</div>
          <div className="ops-stat-row compact">
            <div>
              <span className="ops-stat-num success">2</span>
              <span className="ops-stat-label">완료</span>
            </div>
            <div>
              <span className="ops-stat-num blue">2</span>
              <span className="ops-stat-label">진행중</span>
            </div>
            <div>
              <span className="ops-stat-num warn">1</span>
              <span className="ops-stat-label">Blocked</span>
            </div>
          </div>
          <div className="ops-progress-stack">
            <div style={{ width: "40%", background: "var(--success)" }} />
            <div style={{ width: "40%", background: "var(--accent-blue)" }} />
            <div style={{ width: "20%", background: "var(--warning)" }} />
          </div>
          <button className="ops-wide-btn" type="button" onClick={() => onNav("todo")}>
            내 Todo 확인
          </button>
        </div>
        <div className="ops-panel">
          <div className="ops-panel-title">내 일정 / 필요한 브리핑</div>
          <div className="ops-brief-list">
            <div>
              <i className="ti ti-calendar-event" />
              <span>등록된 일정 없음</span>
            </div>
            <div>
              <i className="ti ti-message-report" />
              <span>필요한 브리핑 없음</span>
            </div>
            <div>
              <i className="ti ti-file-text" />
              <span>필요한 브리핑 없음</span>
            </div>
          </div>
          <button
            className="ops-wide-btn"
            type="button"
            onClick={() => onNav("knowledge")}
          >
            내 브리핑 보기
          </button>
        </div>
      </section>
    </div>
  );
}

export default function Dashboard({
  role,
  onRoleChange,
  onNav,
}) {
  const isMember = role === "member";
  const [risks, setRisks] = useState(defaultAdminRisks);
  const [selectedIssue, setSelectedIssue] = useState(null);

  function openIssueDetail(issueId) {
    setSelectedIssue(getIssueDetail(issueId));
  }

  useEffect(() => {
    function applyRisks(nextRisks) {
      setRisks(nextRisks?.length ? nextRisks : defaultAdminRisks);
    }

    function refreshRisks() {
      applyRisks(window.getDashboardRiskSummaries?.());
    }

    function handleRisksUpdated(event) {
      applyRisks(event.detail?.risks);
    }

    function handleIssueDetail(event) {
      openIssueDetail(event.detail?.issueId);
    }

    function handleIssueDetailData(event) {
      setSelectedIssue(event.detail?.issueData || null);
    }

    function handleIssueDetailClose() {
      setSelectedIssue(null);
    }

    window.addEventListener(
      "opsradar:dashboard-risks-updated",
      handleRisksUpdated,
    );
    window.addEventListener("opsradar:dashboard-issue-detail", handleIssueDetail);
    window.addEventListener(
      "opsradar:dashboard-issue-detail-data",
      handleIssueDetailData,
    );
    window.addEventListener(
      "opsradar:dashboard-issue-detail-close",
      handleIssueDetailClose,
    );
    refreshRisks();

    return () => {
      window.removeEventListener(
        "opsradar:dashboard-risks-updated",
        handleRisksUpdated,
      );
      window.removeEventListener(
        "opsradar:dashboard-issue-detail",
        handleIssueDetail,
      );
      window.removeEventListener(
        "opsradar:dashboard-issue-detail-data",
        handleIssueDetailData,
      );
      window.removeEventListener(
        "opsradar:dashboard-issue-detail-close",
        handleIssueDetailClose,
      );
    };
  }, []);

  return (
    <>
      <div className="topbar ops-db-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="topbar-title">Dashboard</div>
          <div className="ops-role-switch">
            <button
              id="db-tab-pm"
              className={`ops-role-tab${isMember ? "" : " active"}`}
              type="button"
              onClick={() => onRoleChange("pm")}
            >
              <i className="ti ti-crown" /> 관리자
            </button>
            <button
              id="db-tab-member"
              className={`ops-role-tab${isMember ? " active" : ""}`}
              type="button"
              onClick={() => onRoleChange("member")}
            >
              <i className="ti ti-user" /> 팀원
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="notif-btn"
            type="button"
            onClick={() => window.toggleNotif?.()}
            title="알림 센터"
          >
            <i
              className="ti ti-bell"
              style={{ fontSize: 18, color: "var(--text2)" }}
            />
            <div className="notif-dot" id="notifDot" />
          </button>
          <div className="chip" id="todayDate" data-current-date="long">
            오늘 날짜
          </div>
        </div>
      </div>

      <div className="content ops-dashboard-content">
        {isMember ? (
          <MemberDashboard onNav={onNav} />
        ) : (
          <AdminDashboard
            risks={risks}
            onIssueDetail={openIssueDetail}
            onNav={onNav}
          />
        )}
      </div>
      <IssueDetailPanel
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </>
  );
}
