// 대시보드(s-dashboard) 화면의 React 버전 (스트랭글러 — 보고서/캘린더 패턴).
//
// 기존 #s-dashboard 의 두 직계 자식(.topbar, .content)을 verbatim dangerouslySetInnerHTML 로
// "그대로" 렌더한다(클래스·구조·인라인 onclick·스타일 100% 보존, 픽셀 동일). 여분 래퍼가 없어
// flex 레이아웃이 그대로 유지된다. 동작은 전부 vanilla 소유:
//   - renderDashboardLive(4중 몽키패치: ops-workflow-enhancements 정의 → role/todo-calendar/
//     workflow-v2 wrap)가 카운트(textContent)·#db-high-risk-grid·#db-ai-todo-list·#db-member-view
//     (innerHTML)를 채운다.
//   - ops-workflow-enhancements 가 window.nav 를 wrap → nav('dashboard') 마다 renderDashboardLive().
//     + setTimeout(500) + opsRadarApi.reload + workflow init(setTimeout 900/2800) 에서도 실행.
//   - applyRoleVisibility 가 .ops-role-switch 를 런타임 제거 + body.wr-team-member 토글 + switchDbRole
//     로 #db-admin-view/#db-member-view .active 전환. isLead 가 그 .active 를 상태소스로 읽는다.
//
// ⚠️ "재렌더 0"이 이 화면의 핵심: React 가 다시 렌더하면 vanilla 가 제거한 .ops-role-switch 가
//   되살아나고 뷰 .active 토글이 꼬인다. 그래서 memo + createRoot 1회 렌더(MutationObserver 미사용).
// (대시보드엔 이슈 같은 onclick 속성 셀렉터 결합 없음, 차트 라이브러리 없음 → 추가 처리 불요.)
import { memo, useEffect } from 'react'

const TOPBAR_INNER = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="topbar-title">Dashboard</div>
      <div class="ops-role-switch">
        <div id="db-tab-pm" class="ops-role-tab active" onclick="switchDbRole('pm')"><i class="ti ti-crown"></i> 관리자</div>
        <div id="db-tab-member" class="ops-role-tab" onclick="switchDbRole('member')"><i class="ti ti-user"></i> 팀원</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <div class="notif-btn" onclick="toggleNotif()" title="알림 센터">
        <i class="ti ti-bell" style="font-size:18px;color:var(--text2)"></i>
        <div class="notif-dot" id="notifDot"></div>
      </div>
      <div class="chip" id="todayDate" data-current-date="long">오늘 날짜</div>
    </div>`

const CONTENT_INNER = `
    <div id="db-admin-view" class="ops-dashboard-view active">
      <section class="ops-ai-summary-card">
        <div class="ops-card-header">
          <div class="ops-card-title"><i class="ti ti-sparkles"></i> AI 운영 판단 요약</div>
          <span class="ops-updated"><i class="ti ti-clock"></i> 마지막 업데이트 15분 전</span>
        </div>
        <div class="ops-ai-body">
          <p>운영 로그와 Todo 데이터가 연결되면 AI가 현재 운영 상태, 위험 요인, 우선 실행 항목을 요약합니다.</p>
          <div class="ops-evidence-chips">
            <span class="ops-chip blue" id="db-data-chip" onclick="nav('analysis')" style="cursor:pointer">운영 데이터 0건</span>
            <span class="ops-chip warn" id="db-blocked-chip" onclick="openDashboardTodoTab('inprogress')" style="cursor:pointer">Blocked Todo 0건</span>
            <span class="ops-chip green" id="db-pending-chip" onclick="openDashboardTodoTab('ai')" style="cursor:pointer">AI 제안 0건</span>
          </div>
        </div>
      </section>

      <section>
        <div class="ops-section-heading">
          <div><i class="ti ti-alert-triangle"></i> 미해결 이슈</div>
          <button class="ops-link-btn" onclick="nav('issues')">전체 이슈 보기 <i class="ti ti-arrow-right"></i></button>
        </div>
        <div class="ops-risk-grid" id="db-high-risk-grid">
          <article class="ops-risk-card">
            <div class="ops-risk-card-top"><h3>Risk 데이터 없음</h3><span class="badge b-accent">대기</span></div>
            <p>운영 로그 분석 후 High Risk 이슈가 이 영역에 표시됩니다.</p>
            <div class="ops-risk-meta"><span>Blocked 0</span><span>대기 중</span></div>
            <div class="ops-domino"><strong>도미노 영향</strong><span>분석 데이터 연결 후 영향 흐름이 표시됩니다.</span></div>
            <div class="ops-card-actions"><button onclick="nav('todo')">대응 Todo 생성</button><button onclick="openIssueDetail('payment-api')">상세 보기</button></div>
          </article>
          <article class="ops-risk-card">
            <div class="ops-risk-card-top"><h3>Risk 데이터 없음</h3><span class="badge b-accent">대기</span></div>
            <p>확인된 운영 리스크가 아직 없습니다.</p>
            <div class="ops-risk-meta"><span>Blocked 0</span><span>대기 중</span></div>
            <div class="ops-domino"><strong>도미노 영향</strong><span>분석 데이터 연결 후 영향 흐름이 표시됩니다.</span></div>
            <div class="ops-card-actions"><button onclick="nav('todo')">대응 Todo 생성</button><button onclick="openIssueDetail('db-pool')">상세 보기</button></div>
          </article>
          <article class="ops-risk-card">
            <div class="ops-risk-card-top"><h3>Risk 데이터 없음</h3><span class="badge b-accent">대기</span></div>
            <p>확인된 운영 리스크가 아직 없습니다.</p>
            <div class="ops-risk-meta"><span>Blocked 0</span><span>대기 중</span></div>
            <div class="ops-domino"><strong>도미노 영향</strong><span>분석 데이터 연결 후 영향 흐름이 표시됩니다.</span></div>
            <div class="ops-card-actions"><button onclick="nav('todo')">대응 Todo 생성</button><button onclick="openIssueDetail('deploy-pipeline')">상세 보기</button></div>
          </article>
        </div>
      </section>

      <section class="ops-bottom-grid">
        <div class="ops-panel">
          <div class="ops-panel-title">Todo 실행 현황</div>
          <div class="ops-stat-row">
            <div onclick="openDashboardTodoTab('inprogress')" style="cursor:pointer"><span class="ops-stat-num blue" id="db-progress-count">0</span><span class="ops-stat-label">진행중</span></div>
            <div onclick="openDashboardTodoTab('done')" style="cursor:pointer"><span class="ops-stat-num success" id="db-done-count">0</span><span class="ops-stat-label">완료</span></div>
            <div onclick="openDashboardTodoTab('rejected')" style="cursor:pointer"><span class="ops-stat-num warn" id="db-rejected-count">0</span><span class="ops-stat-label">반려</span></div>
          </div>
          <div class="ops-progress-stack">
            <div style="width:0%;background:var(--success)" title="완료"></div>
            <div style="width:0%;background:var(--accent-blue)" title="진행중"></div>
            <div id="db-todo-bar" style="width:0%;background:var(--warning)" title="Blocked"></div>
          </div>
          <div class="ops-muted-line"><span id="db-todo-rate">0 / 0</span> 완료, 운영 데이터 연결 대기 중</div>
        </div>
        <div class="ops-panel">
          <div class="ops-panel-title">AI 제안</div>
          <div class="ops-approval-list" id="db-ai-todo-list">
            <div class="ops-approval-item" onclick="nav('todo')"><div><strong>승인 대기 항목 없음</strong><span>AI 생성 Todo 승인 요청이 생성되면 표시됩니다.</span></div><i class="ti ti-arrow-right"></i></div>
          </div>
          <div class="ops-muted-line"><span id="db-pending">0</span>건 AI 제안 대기 중</div>
        </div>
      </section>
    </div>

    <div id="db-member-view" class="ops-dashboard-view">
      <section class="ops-ai-summary-card member">
        <div class="ops-card-header">
          <div class="ops-card-title"><i class="ti ti-user-check"></i> 오늘 내 업무 요약</div>
          <span class="ops-updated"><i class="ti ti-clock"></i> 오전 스탠드업 기준</span>
        </div>
        <div class="ops-ai-body">
          <p>내 Todo와 일정 데이터가 연결되면 오늘 우선 작업, 관련 이슈, 필요한 브리핑이 표시됩니다.</p>
          <div class="ops-evidence-chips">
            <span class="ops-chip blue">내 Todo 5건</span>
            <span class="ops-chip warn">Blocked 0건</span>
            <span class="ops-chip green">오늘 일정 2건</span>
          </div>
        </div>
      </section>

      <section class="ops-member-grid">
        <div class="ops-panel">
          <div class="ops-panel-title">오늘 우선 작업</div>
          <div class="ops-task-list">
            <div class="ops-task-item high"><span>P0</span><div><strong>등록된 우선 작업 없음</strong><small>Todo 데이터 연결 후 표시됩니다.</small></div></div>
            <div class="ops-task-item"><span>P1</span><div><strong>등록된 우선 작업 없음</strong><small>Todo 데이터 연결 후 표시됩니다.</small></div></div>
            <div class="ops-task-item"><span>P1</span><div><strong>등록된 우선 작업 없음</strong><small>Todo 데이터 연결 후 표시됩니다.</small></div></div>
          </div>
        </div>
        <div class="ops-panel">
          <div class="ops-panel-title">내 관련 이슈</div>
          <div class="ops-issue-mini danger"><div><strong>Risk 데이터 없음</strong><span>관련 이슈 없음</span></div><button onclick="nav('issues')">보기</button></div>
          <div class="ops-issue-mini warn"><div><strong>Risk 데이터 없음</strong><span>관련 이슈 없음</span></div><button onclick="nav('issues')">보기</button></div>
        </div>
      </section>

      <section class="ops-bottom-grid">
        <div class="ops-panel">
          <div class="ops-panel-title">내 Todo 진행 현황</div>
          <div class="ops-stat-row compact">
            <div><span class="ops-stat-num success">2</span><span class="ops-stat-label">완료</span></div>
            <div><span class="ops-stat-num blue">2</span><span class="ops-stat-label">진행중</span></div>
            <div><span class="ops-stat-num warn">1</span><span class="ops-stat-label">Blocked</span></div>
          </div>
          <div class="ops-progress-stack"><div style="width:40%;background:var(--success)"></div><div style="width:40%;background:var(--accent-blue)"></div><div style="width:20%;background:var(--warning)"></div></div>
          <button class="ops-wide-btn" onclick="nav('todo')">내 Todo 확인</button>
        </div>
        <div class="ops-panel">
          <div class="ops-panel-title">내 일정 / 필요한 브리핑</div>
          <div class="ops-brief-list">
            <div><i class="ti ti-calendar-event"></i><span>등록된 일정 없음</span></div>
            <div><i class="ti ti-message-report"></i><span>필요한 브리핑 없음</span></div>
            <div><i class="ti ti-file-text"></i><span>필요한 브리핑 없음</span></div>
          </div>
          <button class="ops-wide-btn" onclick="nav('knowledge')">내 브리핑 보기</button>
        </div>
      </section>
    </div>`

const DashboardScreen = memo(function DashboardScreen() {
  // 날짜 칩([data-current-date])은 app.js renderCurrentDateLabels 가 init 시 1회만 채운다.
  // React 가 그 후 마운트해 placeholder("오늘 날짜")로 덮으므로, 마운트 직후 1회 다시 채운다.
  // (문서 전역·멱등 → 다른 화면 칩도 함께 채워짐). vanilla 무수정.
  useEffect(() => {
    if (typeof window.renderCurrentDateLabels === 'function') window.renderCurrentDateLabels()
  }, [])

  return (
    <>
      <div className="topbar ops-db-topbar" dangerouslySetInnerHTML={{ __html: TOPBAR_INNER }}></div>
      <div className="content ops-dashboard-content" dangerouslySetInnerHTML={{ __html: CONTENT_INNER }}></div>
    </>
  )
})

export default DashboardScreen
