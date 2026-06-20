// 캘린더(s-calendar) 화면의 React 버전 (스트랭글러 3번째 — 보고서 패턴).
//
// 기존 #s-calendar HTML 을 verbatim 복제(class·id·구조·inline style 동일, 픽셀 동일).
// 동작은 전부 vanilla 재사용: nav('calendar') → renderCalendar()/updateCalendarHeader()/
// showCalBanner() 가 이 React 노드(같은 id)에 바인딩·채움. app.js / api-integration.js 무수정.
// React 는 memo 로 1회만 렌더(재렌더 0, MutationObserver 미사용) → vanilla 가 채운 #calGrid 보존.
//
// 디자인 개선(역할 무관): 하루 일정이 많으면 칸이 깨지므로 셀당 태그 최대 2개 + 초과 시
// "+N 더보기". renderCalendar 는 무수정 — #calGrid 에 MutationObserver(childList) 를 걸어
// vanilla 가 셀을 (재)그린 직후 표시만 후처리. "+N"/셀 클릭은 기존 openCalModal 로 전체 표시.
import { memo, useEffect } from 'react'

const MAX_TAGS = 2

function capTags(grid) {
  grid.querySelectorAll('.cal-cell').forEach((cell) => {
    const wrap = cell.querySelector('.cal-tags')
    if (!wrap) return
    // 멱등: 이전 후처리 흔적 초기화
    wrap.querySelectorAll('.cal-more-badge').forEach((b) => b.remove())
    const tags = Array.from(wrap.querySelectorAll('.cal-tag')).filter(
      (t) => !t.classList.contains('cal-more-badge'),
    )
    tags.forEach((t) => { t.style.display = '' })
    if (tags.length > MAX_TAGS) {
      tags.forEach((t, i) => { if (i >= MAX_TAGS) t.style.display = 'none' })
      const more = document.createElement('span')
      more.className = 'cal-tag cal-more-badge'
      more.textContent = `+${tags.length - MAX_TAGS} 더보기`
      more.style.cursor = 'pointer'
      more.style.opacity = '0.8'
      wrap.appendChild(more) // 셀 클릭 버블 → 기존 openCalModal(d) 가 전체 일정 표시
    }
  })
}

function CalendarScreen() {
  useEffect(() => {
    const grid = document.getElementById('calGrid')
    if (!grid) return
    const run = () => capTags(grid)
    run()
    // childList(직계 .cal-cell 추가/제거)만 관찰 → 후처리(셀 내부 변경)는 재트리거 안 함(루프 방지).
    const obs = new MutationObserver(run)
    obs.observe(grid, { childList: true })
    return () => obs.disconnect()
  }, [])

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="topbar-title">캘린더 — 운영 리스크 예측</div>
          <span id="calUpdatedBadge" className="badge b-success" style={{ display: 'none' }}>방금 업데이트됨</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="tbtn primary" onClick={() => window.openAISuggestModal?.()} style={{ gap: '5px' }}>
            <i className="ti ti-sparkles"></i> AI 추천 일정 생성
          </div>
          <div className="tbtn">← 4월</div><div className="chip">2026년 5월</div><div className="tbtn">6월 →</div>
        </div>
      </div>
      {/* AI 추천 일정 모달 */}
      <div className="modal-overlay" id="aiSuggestModal">
        <div className="modal slide-up" style={{ width: '400px' }}>
          <div className="modal-title">AI 추천 일정 생성</div>
          <div className="modal-sub">운영 데이터 기반으로 AI가 추천하는 일정을 선택하세요.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ background: 'var(--danger-soft)', border: '1px solid rgba(224,62,62,.12)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', transition: 'all .15s' }} onClick={() => window.addAISuggestEvent?.('긴급 대응 회의', 'High Risk 이슈 기반')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><span className="badge b-danger">High Risk 기반</span></div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>High Risk 이슈 대응 회의 생성</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>현재 미해결 이슈를 기반으로 긴급 대응 회의를 추천합니다.</div>
            </div>
            <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(66,99,235,.12)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', transition: 'all .15s' }} onClick={() => window.addAISuggestEvent?.('Todo 마감 점검', 'Todo 마감 집중 기반')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><span className="badge b-accent">마감 집중 기반</span></div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>Todo 마감 일정 추가</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>이번 주 마감 집중 구간에 점검 일정을 자동 추가합니다.</div>
            </div>
            <div style={{ background: 'var(--warn-soft)', border: '1px solid rgba(196,124,0,.12)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', cursor: 'pointer', transition: 'all .15s' }} onClick={() => window.addAISuggestEvent?.('인수인계 미팅', '부재자 인수인계 기반')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}><span className="badge b-warn">부재 기반</span></div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', marginBottom: '2px' }}>부재자 인수인계 일정 생성</div>
              <div style={{ fontSize: '10px', color: 'var(--text3)' }}>팀원 부재 전 인수인계 미팅을 자동으로 추천합니다.</div>
            </div>
          </div>
          <div className="modal-actions"><div className="tbtn" onClick={() => window.closeModal?.('aiSuggestModal')}>닫기</div></div>
        </div>
      </div>
      <div id="calEventBanner" style={{ display: 'flex', background: 'var(--success-soft)', borderBottom: '1px solid rgba(26,158,106,.15)', padding: '10px 16px', fontSize: '11px', color: 'var(--success)', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <i className="ti ti-calendar-plus" style={{ fontSize: '16px' }}></i><span id="calBannerText"></span>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(66,99,235,.15)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '11px', color: 'var(--text2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px', fontWeight: 500, color: 'var(--accent)' }}><i className="ti ti-sparkles" style={{ fontSize: '13px' }}></i> AI 추론 — 5월 리스크 예측</div>
            <span id="calAIText">운영 로그 업로드 후 AI가 이번 달 리스크 예측을 자동으로 생성합니다.</span>
          </div>
          <div className="cal-grid" id="calGrid">
            <div className="cal-dow">월</div><div className="cal-dow">화</div><div className="cal-dow">수</div><div className="cal-dow">목</div><div className="cal-dow">금</div><div className="cal-dow weekend">토</div><div className="cal-dow weekend">일</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text2)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}></div>High Risk</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text2)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--warn-soft)', border: '1px solid var(--warn)' }}></div>주의</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text2)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'var(--surface2)' }}></div>부재</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--success)' }}><div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(26,158,106,.15)', border: '1px solid rgba(26,158,106,.3)' }}></div>신규 등록</div>
          </div>
        </div>
        <div className="cal-side">
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}><i className="ti ti-alert-triangle" style={{ fontSize: '13px', color: 'var(--text2)' }}></i> 리스크 구간</div>
            <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '11px' }}><div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: '2px' }}>5/21~22 (목~금)</div><div style={{ color: 'var(--text)' }}>마감 4건 + 부재 겹침</div><span className="badge b-danger" style={{ marginTop: '4px', display: 'inline-block' }}>최고 위험</span></div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: '5px' }}><i className="ti ti-user-off" style={{ fontSize: '13px', color: 'var(--text2)' }}></i> 부재 현황</div>
            <div id="calAbsenceList">
              <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '11px' }}><div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>5/19 이성우</div><div style={{ color: 'var(--text)' }}>외부 일정 — 업무 공백</div></div>
              <div style={{ padding: '6px 0', fontSize: '11px' }}><div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>5/21 관리자</div><div style={{ color: 'var(--text)' }}>외부 일정 — 업무 지연</div></div>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)', margin: '14px 0 8px', display: 'flex', alignItems: 'center', gap: '5px' }}><i className="ti ti-flag" style={{ fontSize: '13px', color: 'var(--text2)' }}></i> 마일스톤</div>
            <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: '11px' }}><div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>5/29</div><div style={{ color: 'var(--text)' }}>4주차 시연</div><span className="badge b-accent" style={{ marginTop: '4px', display: 'inline-block' }}>—</span></div>
            <div style={{ padding: '7px 0', fontSize: '11px' }}><div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>6/26</div><div style={{ color: 'var(--text)' }}>MVP 최종 시연</div><span className="badge b-accent" style={{ marginTop: '4px', display: 'inline-block' }}>—</span></div>
          </div>
          <div className="cal-mini-chat" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div className="mini-chat-hd"><i className="ti ti-sparkles" style={{ fontSize: '13px', color: 'var(--accent)' }}></i><span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--accent)' }}>일정 등록</span></div>
            <div className="mini-log" id="miniLog">
              <div style={{ fontSize: '10px', color: 'var(--text3)', lineHeight: 1.5 }}>일정을 입력하면 내용을 검토하고 수정한 뒤 등록합니다.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '4px' }}>
                <div className="sq" style={{ fontSize: '9px', padding: '2px 6px' }} onClick={() => window.miniChat?.('김도윤 6/15-19 휴가')}>김도윤 6/15-19 휴가</div>
                <div className="sq" style={{ fontSize: '9px', padding: '2px 6px' }} onClick={() => window.miniChat?.('6/25 10:00 주간 운영 회의')}>6/25 10:00 주간 운영 회의</div>
              </div>
            </div>
            <div className="mini-input-row">
              <input className="mini-input" id="miniInput" placeholder="예: 김도윤 6/15-19 휴가" onKeyDown={(e) => { if (e.key === 'Enter') window.miniChat?.() }} />
              <button className="mini-send" title="일정 해석" onClick={() => window.miniChat?.()}><i className="ti ti-send" style={{ fontSize: '12px' }}></i></button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default memo(CalendarScreen)
