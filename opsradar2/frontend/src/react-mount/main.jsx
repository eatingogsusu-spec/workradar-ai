// Strangler-fig React entry (see MIGRATION_LOG.md).
//
// 전환된 화면을 기존 바닐라 노드 안에 React로 렌더한다. 현재: 설정(s-settings),
// 보고서(s-reports), 캘린더(s-calendar), 이슈 로그(s-issues), 대시보드(s-dashboard),
// 인수인계 센터(s-knowledge), 운영 로그 분석(s-analysis), AI Assistant(s-chat),
// Todo(s-todo) 9개 — 9개 화면 전부 React 전환 완료.
//
// 안전 설계:
//  - window.nav 를 건드리지 않는다. 대신 #s-settings 가 .active 가 되는 것을
//    MutationObserver 로 감지해 React 를 렌더/갱신한다 → 다른 화면 영향 0.
//  - 폴백 스위치: localStorage.opsradar_react_settings = 'off' (+새로고침) 하면
//    React 가 마운트되지 않고 기존 바닐라 설정 화면이 그대로 동작한다.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsScreen from './SettingsScreen.jsx'
import ReportsScreen from './ReportsScreen.jsx'
import CalendarScreen from './CalendarScreen.jsx'
import IssuesScreen from './IssuesScreen.jsx'
import DashboardScreen from './DashboardScreen.jsx'
import HandoverCenterPage from './handover/HandoverCenterPage.jsx'
import { installHandoffCompatibility } from './handover/handoffStateAdapter.js'
import AnalysisScreen from './AnalysisScreen.jsx'
import LoginGate from './LoginGate.jsx'

// handoff.js가 sync script로 먼저 실행되므로, 모듈 최상위에서 즉시 호출해
// window.__HANDOFF_REACT_ENABLED__ = true 를 최대한 일찍 설정.
// (handoff.js의 IIFE는 이미 실행됐지만, 이후 window.nav 패치 이전에
//  installHandoffCompatibility가 selectKnowledgeType 등을 덮어써 React 이벤트로 라우팅.)
installHandoffCompatibility()
import ChatScreen from './ChatScreen.jsx'
import TodoScreen from './TodoScreen.jsx'

const USE_REACT_SETTINGS = (() => {
  try {
    return localStorage.getItem('opsradar_react_settings') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_REPORTS = (() => {
  try {
    return localStorage.getItem('opsradar_react_reports') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_CALENDAR = (() => {
  try {
    return localStorage.getItem('opsradar_react_calendar') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_ISSUES = (() => {
  try {
    return localStorage.getItem('opsradar_react_issues') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_DASHBOARD = (() => {
  try {
    return localStorage.getItem('opsradar_react_dashboard') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_KNOWLEDGE = (() => {
  try {
    return localStorage.getItem('opsradar_react_knowledge') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_ANALYSIS = (() => {
  try {
    return localStorage.getItem('opsradar_react_analysis') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_CHAT = (() => {
  try {
    return localStorage.getItem('opsradar_react_chat') !== 'off'
  } catch (_) {
    return true
  }
})()

const USE_REACT_TODO = (() => {
  try {
    return localStorage.getItem('opsradar_react_todo') !== 'off'
  } catch (_) {
    return true
  }
})()

function mountReactSettings() {
  const el = document.getElementById('s-settings')
  if (!el) return

  const root = createRoot(el)
  // key 를 쓰지 않는다(remount 금지): 재렌더 시 SettingsScreen state(테마)와
  // memo 된 멤버 패널 DOM(vanilla 가 채운 #memberAdminList)이 보존되어야 깜빡임이 없다.
  const render = () => root.render(
    <StrictMode>
      <SettingsScreen />
    </StrictMode>,
  )

  render()

  // 설정 화면이 활성화될 때 프로필을 최신으로 갱신(가벼운 update, remount 아님).
  // memo 멤버 패널은 재렌더에서 skip → vanilla 리스트 그대로 유지.
  // window.nav 래핑 없이 동작 → 다른 화면 흐름과 무관.
  const observer = new MutationObserver(() => {
    if (el.classList.contains('active')) render()
  })
  observer.observe(el, { attributes: true, attributeFilter: ['class'] })
}

// 보고서(s-reports) — 스트랭글러 2번째.
// 설정과 달리 화면 전체가 vanilla 소유라 React 는 동일 구조를 한 번만 렌더한다.
// nav('reports') 가 매번 initReportsScreen() 로 리스너/목록을 (재)바인딩하므로,
// React 는 MutationObserver 로 재렌더하지 않는다(재렌더 시 vanilla 가 채운 DOM 을
// 되돌릴 위험 → memo + 1회 렌더로 완전 회피).
function mountReactReports() {
  const el = document.getElementById('s-reports')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <ReportsScreen />
    </StrictMode>,
  )
}

// 캘린더(s-calendar) — 스트랭글러 3번째. 보고서와 동일: 화면 전체 vanilla 소유라
// React 는 구조를 memo 로 1회만 렌더하고, nav('calendar') 가 renderCalendar()/
// updateCalendarHeader()/showCalBanner() 로 이 노드에 바인딩·채운다. 재렌더 0(MutationObserver 미사용).
// 셀당 "+N 더보기" 후처리는 CalendarScreen 내부의 #calGrid 데코레이터가 담당(renderCalendar 무수정).
function mountReactCalendar() {
  const el = document.getElementById('s-calendar')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <CalendarScreen />
    </StrictMode>,
  )
}

// 이슈 로그(s-issues) — 보고서/캘린더와 동일: 화면 전체 vanilla 소유라 memo 로 1회만 렌더(재렌더 0).
// nav('issues') 가 renderIssues() 를, workflow-v2 가 setTimeout/interval 로 configureRoleScreen
// (반려탭 주입)을 React 마운트 후 실행 → 그 React 노드에 바인딩한다.
// 탭은 IssuesScreen 내부에서 dangerouslySetInnerHTML 로 리터럴 onclick 을 보존(workflow-v2 셀렉터 대상).
function mountReactIssues() {
  const el = document.getElementById('s-issues')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <IssuesScreen />
    </StrictMode>,
  )
}

// 대시보드(s-dashboard) — 보고서/캘린더와 동일: 화면 전체 vanilla 소유라 memo 로 1회만 렌더(재렌더 0).
// renderDashboardLive(4중 몽키패치)가 nav('dashboard')/init/reload 에서 카운트·리스크그리드·AI리스트·
// 멤버뷰를 채우고, applyRoleVisibility 가 .ops-role-switch 제거 + switchDbRole 로 뷰 .active 토글.
// ⚠️ 재렌더하면 vanilla 가 제거한 role-switch 가 되살아나고 뷰 상태가 꼬임 → 반드시 1회 렌더만.
function mountReactDashboard() {
  const el = document.getElementById('s-dashboard')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <DashboardScreen />
    </StrictMode>,
  )
}

// 인수인계 센터(s-knowledge) — HandoverCenterPage(staged-workflow 이관).
// React state 로 홈/상세/아카이브를 관리. fetchHandoffCandidates()가 /api/v1/todos·issues 실호출.
// installHandoffCompatibility()로 vanilla handoff.js의 selectKnowledgeType/openHandoffPreview
// 전역 함수를 React 이벤트로 브릿징 → 기존 sidebar nav·app.js 호출자 무수정.
function mountReactKnowledge() {
  const el = document.getElementById('s-knowledge')
  if (!el) return
  // handover.css의 #s-knowledge[data-react-owned="true"] 규칙 적용을 위해 속성 설정.
  el.dataset.reactOwned = 'true'
  createRoot(el).render(
    <StrictMode>
      <HandoverCenterPage />
    </StrictMode>,
  )
}

// 운영 로그 분석(s-analysis) — 캘린더/보고서와 동일: 화면 전체 vanilla 소유라
// React 는 구조를 memo 로 1회만 렌더하고, inline 핸들러(onclick 등)가 기존 전역 함수를 그대로 호출한다.
// ⚠️ 재렌더 0(key/MutationObserver 미사용): workflow-v2.js(ensureQueues→#workflowQueueCenter) 와
// role-workflow-enhancements.js(ensureApprovalCenter→#analysisApprovalCenter) 가 런타임에
// `#s-analysis .content` 로 패널을 prepend 한다. React 가 재렌더하면 이 주입 패널이 사라지므로
// 절대 1회 렌더 이후 다시 그리지 않는다.
function mountReactAnalysis() {
  const el = document.getElementById('s-analysis')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <AnalysisScreen />
    </StrictMode>,
  )
}

// AI Assistant(s-chat) — 운영분석/캘린더와 동일: 화면 전체 vanilla 소유라
// React 는 구조를 memo 로 1회만 렌더하고, inline 핸들러(onclick="sendMsg()" 등)가 기존 전역
// 함수를 그대로 호출한다. nav('chat') 가 initChatSessions()→renderCurrentChatMessages() 로
// 이 노드의 #chatArea/#chatSessionList 를 채운다.
// ⚠️ 재렌더 0(key/MutationObserver 미사용): 메시지는 #chatArea 에 appendChild 로 쌓이므로,
// React 가 재렌더하면 진행 중 대화가 intro 로 리셋된다. 1회 렌더 이후 절대 다시 그리지 않는다.
function mountReactChat() {
  const el = document.getElementById('s-chat')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <ChatScreen />
    </StrictMode>,
  )
}

// Todo(s-todo) — Todo 탭/목록/카드/상세는 React state 로 렌더한다(다른 화면들과 달리 React 가 상태 관리).
// 기존 renderTodos()/switchTodoTab()/openDashboardTodoTab() 호출자는 app.js compatibility wrapper 로
// React 이벤트를 발생시켜 유지한다. 다른 화면 흐름은 그대로.
function mountReactTodo() {
  const el = document.getElementById('s-todo')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <TodoScreen />
    </StrictMode>,
  )
}

// 로그인 게이트(s2단계) — 9개 화면의 "1회 렌더" 셸과 분리된 별도 React 트리로 #root 에 마운트.
// 자체 useState 로 세션을 관리하므로 다른 화면의 memo/re-render 0 설계에 영향 0.
function mountLoginGate() {
  const el = document.getElementById('root')
  if (!el) return
  createRoot(el).render(
    <StrictMode>
      <LoginGate />
    </StrictMode>,
  )
}

function bootstrap() {
  mountLoginGate()
  if (USE_REACT_SETTINGS) mountReactSettings()
  if (USE_REACT_REPORTS) mountReactReports()
  if (USE_REACT_CALENDAR) mountReactCalendar()
  if (USE_REACT_ISSUES) mountReactIssues()
  if (USE_REACT_DASHBOARD) mountReactDashboard()
  if (USE_REACT_KNOWLEDGE) mountReactKnowledge()
  if (USE_REACT_ANALYSIS) mountReactAnalysis()
  if (USE_REACT_CHAT) mountReactChat()
  if (USE_REACT_TODO) mountReactTodo()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
} else {
  bootstrap()
}
