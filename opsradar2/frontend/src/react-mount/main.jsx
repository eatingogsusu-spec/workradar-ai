// Strangler-fig React entry (see MIGRATION_LOG.md).
//
// 전환된 화면을 기존 바닐라 노드 안에 React로 렌더한다. 현재: 설정(s-settings),
// 보고서(s-reports), 캘린더(s-calendar) 3개. 아직 안 옮긴 화면은 전부 바닐라가 그대로 소유한다.
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

function bootstrap() {
  if (USE_REACT_SETTINGS) mountReactSettings()
  if (USE_REACT_REPORTS) mountReactReports()
  if (USE_REACT_CALENDAR) mountReactCalendar()
  if (USE_REACT_ISSUES) mountReactIssues()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
} else {
  bootstrap()
}
