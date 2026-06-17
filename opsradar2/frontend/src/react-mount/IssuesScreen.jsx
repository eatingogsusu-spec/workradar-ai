// 이슈 로그(s-issues) 화면의 React 버전 (스트랭글러 — 보고서/캘린더 패턴 + 탭 리터럴 onclick 보존).
//
// 기존 #s-issues HTML 을 class·구조·텍스트까지 100% 복제(픽셀 동일). 동작은 전부 vanilla 소유:
//   app.js(renderIssues/selectIssue) + role-workflow-enhancements.js(renderIssues 몽키패치) +
//   workflow-v2.js(반려탭 주입·renderPendingRisks·renderRejectedRisks)가 이 React 노드를 채운다.
//   nav('issues') 가 매번 renderIssues() 를 호출하고, workflow-v2 가 setTimeout/interval 로
//   configureRoleScreen→ensureIssueRejectedTab 을 React 마운트 *후* 실행한다.
//   → React 는 구조를 memo 로 "1회만" 렌더하고 절대 재렌더하지 않는다(MutationObserver 미사용).
//     재렌더하면 vanilla 가 채운 #issueList / 주입한 "반려" 탭이 날아간다.
//
// ⚠️ 핵심 함정: workflow-v2 가 탭을 리터럴 onclick 속성 문자열로 찾는다
//   - configureIssueTabs: tabs.querySelector(".tab[onclick*=\"'candidate'\"]")
//   - switchIssueTab 래퍼: node.getAttribute("onclick").includes("'candidate'")
//   React 의 onClick 은 onclick 속성을 만들지 않으므로, .tabs 만 dangerouslySetInnerHTML 로
//   리터럴 onclick 을 보존한다(여분 래퍼 회피 위해 나머지는 JSX 프래그먼트).
//   #issueCreateModal 은 body 레벨이라 #s-issues 밖 → 전환 무관.
import { memo } from 'react'

// 탭은 리터럴 onclick 보존이 필수 → 정적 HTML 그대로(workflow-v2 의 onclick 속성 셀렉터 대상).
const TABS_HTML =
  '<div class="tab active" onclick="switchIssueTab(\'inprogress\')">진행중인 이슈 ' +
  '<span class="badge b-danger" id="i-prog-cnt">0</span></div>' +
  '<div class="tab" onclick="switchIssueTab(\'candidate\')">승인 대기 이슈 ' +
  '<span class="badge b-warn" id="i-cand-cnt">0</span></div>'

const IssuesScreen = memo(function IssuesScreen() {
  return (
    <>
      <div className="topbar">
        <div className="topbar-title">이슈 로그</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="tbtn primary" onClick={() => window.openIssueCreateModal && window.openIssueCreateModal()}>
            <i className="ti ti-plus"></i> 수동 등록
          </div>
          <div className="chip" data-current-date="short">오늘 날짜</div>
        </div>
      </div>
      {/* 컨텍스트 배너 */}
      <div className="ctx-banner" id="issuectxBanner">
        <i className="ti ti-circle-check"></i>
        <span id="issuectxText">Todo가 생성되었습니다. Todo 화면에서 확인하세요.</span>
        <div
          className="tbtn"
          onClick={() => window.nav && window.nav('todo')}
          style={{ marginLeft: 'auto', fontSize: '10px', padding: '3px 8px', color: 'var(--success)', borderColor: 'var(--success)' }}
        >
          Todo 확인 →
        </div>
      </div>
      {/* 탭: 리터럴 onclick 보존(workflow-v2 가 onclick 속성으로 탐색). 반려탭은 vanilla 가 .tabs 에 append. */}
      <div className="tabs" dangerouslySetInnerHTML={{ __html: TABS_HTML }}></div>
      <div className="body-wrap">
        {/* #issueList: vanilla(renderIssues/renderPendingRisks/renderRejectedRisks)가 채운다. React 무접촉. */}
        <div
          className="issue-list"
          id="issueList"
          style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        ></div>
        <div className="detail-panel">
          <div className="detail-empty" id="issueDetailEmpty">
            <i className="ti ti-hand-click"></i>
            <span>이슈를 클릭하면<br />상세 내용이 표시됩니다</span>
          </div>
          {/* 상세/액션: vanilla(selectIssue/renderIssueDetail, role-enh 가 비-리드 시 숨김)가 소유. */}
          <div id="issueDetailContent" style={{ display: 'none', padding: '14px', overflowY: 'auto', flex: 1 }}></div>
          <div
            id="issueDetailActions"
            style={{ display: 'none', padding: '12px 14px', borderTop: '1px solid var(--border)', flexDirection: 'column', gap: '6px' }}
          ></div>
        </div>
      </div>
    </>
  )
})

export default IssuesScreen
