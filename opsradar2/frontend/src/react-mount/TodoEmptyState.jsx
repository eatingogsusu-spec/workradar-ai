export default function TodoEmptyState({ viewMode }) {
  if (viewMode === 'card') {
    return (
      <div id="todoEmpty" style={{ display: 'block', flex: 1 }}>
        <div style={{ gridColumn: '1/-1', padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
          <i className="ti ti-checkbox" style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}></i>
          이 탭에 항목이 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div id="todoEmpty" style={{ display: 'block', flex: 1 }}>
      <div className="onboarding-guide">
        <i
          className="ti ti-checkbox"
          style={{ fontSize: '36px', color: 'var(--text3)', display: 'block', marginBottom: '12px' }}
        ></i>
        <h3>아직 Todo가 없습니다</h3>
        <p>
          운영 로그 파일을 업로드하면 AI가 자동으로 Todo를 추출합니다.
          <br />
          수동으로 직접 등록할 수도 있습니다.
        </p>
        <div className="og-steps">
          <div className="og-step">
            <div className="og-num">1</div>운영 로그 분석 화면에서 파일 업로드
          </div>
          <div className="og-step">
            <div className="og-num">2</div>AI 분석 완료 후 Todo 자동 추출
          </div>
          <div className="og-step">
            <div className="og-num">3</div>여기서 확인 후 승인 또는 반려
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <div className="tbtn primary" onClick={() => window.nav?.('analysis')}>
            <i className="ti ti-file-analysis"></i> 파일 업로드하러 가기
          </div>
          <div className="tbtn" onClick={() => window.openManualModal?.()}>
            <i className="ti ti-plus"></i> 수동 등록
          </div>
        </div>
      </div>
    </div>
  )
}
