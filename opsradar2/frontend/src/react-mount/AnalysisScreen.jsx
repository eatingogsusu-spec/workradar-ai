// 운영 로그 분석(s-analysis) 화면의 React 버전 (스트랭글러 4번째 — 보고서/캘린더 패턴).
//
// (A) dangerouslySetInnerHTML 방식: 기존 #s-analysis 내부 HTML 을 verbatim 주입한다.
// inline onclick/onchange/ondragover/ondragleave/ondrop/style 을 전부 그대로 보존하므로,
// 브라우저가 innerHTML 파싱 시 이를 네이티브 이벤트로 등록 → 기존 전역 함수
// (startAnalysis/resetUpload/toggleHistory/onFileSelect/ondov/ondl/handleUploadDrop/
//  openAnalysisTodoReview/openAnalysisRiskReview/applyDashboard/resetFlow 등)를 그대로 호출.
// React 가 관리하는 상태는 0개다.
//
// ⚠️ 재렌더 절대 금지(memo + 재렌더 0, MutationObserver 미사용):
//   - workflow-v2.js   ensureQueues()        → `#s-analysis .content` 에 #workflowQueueCenter prepend
//   - role-workflow-enhancements.js ensureApprovalCenter() → `#s-analysis .content` 에 #analysisApprovalCenter prepend
//   이 두 패널은 런타임에 vanilla 가 .content 자식으로 끼워넣는다. React 가 한 번이라도
//   재렌더하면 .content innerHTML 이 초기 HTML 로 되돌아가 이 주입 패널이 사라진다.
//   → memo 로 1회만 렌더하고 main.jsx 에서 재렌더를 절대 트리거하지 않는다.
//
// 구조 보존(픽셀 동일): #s-analysis 는 .screen(flex column) 컨테이너이고 직계 자식은
// .topbar 와 .content 두 개다. createRoot(#s-analysis) 는 자식으로 렌더하므로, 래퍼 div 를
// 끼우면 .screen 의 flex 레이아웃이 깨진다. 따라서 프래그먼트로 .topbar/.content 를 각각
// 직접 렌더하고 그 안쪽만 dangerouslySetInnerHTML 로 채운다(원본 직계 구조 그대로).
//
// 폴백: localStorage.opsradar_react_analysis = 'off' (+새로고침) → React 미마운트, 바닐라 복귀.
import { memo } from 'react'

// index.html #s-analysis 의 <div class="topbar"> 내부 (verbatim)
const TOPBAR_INNER = `
    <div style="display:flex;align-items:center;gap:10px">
      <div class="topbar-title">운영 로그 분석</div>
      <div id="stepBar" style="display:none;align-items:center;gap:6px;font-size:10px;color:var(--text3);font-family:var(--mono)">
        <span id="s1lbl" class="badge b-accent">① 업로드</span>
        <span>→</span><span id="s2lbl">② 분석</span>
        <span>→</span><span id="s3lbl">③ 결과</span>
      </div>
    </div>
    <div style="display:flex;gap:8px"><div class="tbtn" onclick="toggleHistory()"><i class="ti ti-history"></i> 업로드 이력</div><div class="chip" data-current-date="short">오늘 날짜</div></div>
  `

// index.html #s-analysis 의 <div class="content"> 내부 (verbatim)
const CONTENT_INNER = `
    <div style="background:var(--accent-soft);border:1px solid rgba(66,99,235,.12);border-radius:var(--radius);padding:10px 14px;font-size:11px;color:var(--text2);display:flex;align-items:center;gap:8px" id="analysisGuide">
      <i class="ti ti-info-circle" style="font-size:14px;color:var(--accent)"></i>
      운영 기록 파일을 업로드하면 AI가 자동으로 업무 항목을 추출하고 위험 이슈를 탐지합니다.
    </div>
    <div id="uploadSection">
      <div class="upload-zone" id="uploadZone" ondragover="ondov(event)" ondragleave="ondl(event)" ondrop="handleUploadDrop(event)">
        <input type="file" accept=".txt,.md,.markdown,.pdf,.csv,.docx" multiple onchange="onFileSelect(event)">
        <i class="ti ti-cloud-upload" style="font-size:30px;color:var(--text3);display:block;margin-bottom:10px"></i>
        <p style="font-size:12px;color:var(--text2)">파일을 드래그하거나 클릭하여 업로드</p>
        <span style="font-size:11px;color:var(--text3);display:block;margin-top:4px">지원 형식: txt · md · csv · pdf · docx</span>
      </div>
      <div id="fileList" style="display:none;margin-top:10px">
        <div id="fileItems"></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <div class="tbtn" onclick="resetUpload()"><i class="ti ti-x"></i> 취소</div>
          <div class="tbtn primary" onclick="startAnalysis()"><i class="ti ti-sparkles"></i> AI 분석 시작</div>
        </div>
      </div>
    </div>
          <div id="uploadErrorCard" class="upload-error-card" style="display:none"></div>
    <div id="analysisSection" style="display:none">
      <div class="card" style="border-left:3px solid var(--accent)">
        <div class="card-hd"><div class="card-hd-l"><i class="ti ti-sparkles" style="color:var(--accent)"></i> AI 분석 진행 중</div><div class="badge b-accent" id="analysisBadge">분석 중...</div></div>
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--success-soft);border-radius:var(--radius-sm);margin-bottom:14px">
          <i class="ti ti-circle-check" style="font-size:16px;color:var(--success);flex-shrink:0"></i>
          <div><div style="font-size:12px;font-weight:500;color:var(--success)">파일 업로드 완료</div><div style="font-size:10px;color:var(--text3);margin-top:1px" id="uploadedFname">AI가 업무 내용을 분석하고 있습니다...</div></div>
        </div>
        <div class="flow-wrap">
          <div class="flow-step"><div class="flow-icon fi-wait" id="ficon1"><i class="ti ti-checkbox" style="font-size:11px"></i></div><div class="flow-body"><div class="flow-title" id="ftitle1">업무 항목 추출 중</div><div class="flow-sub" id="fsub1">회의록·채팅에서 Todo 항목 감지 중...</div></div></div>
          <div class="flow-step"><div class="flow-icon fi-wait" id="ficon2"><i class="ti ti-alert-triangle" style="font-size:11px"></i></div><div class="flow-body"><div class="flow-title" id="ftitle2">위험 이슈 확인 중</div><div class="flow-sub" id="fsub2">리스크 키워드 및 Blocked 상태 탐지 대기</div></div></div>
          <div class="flow-step"><div class="flow-icon fi-wait" id="ficon3"><i class="ti ti-file-description" style="font-size:11px"></i></div><div class="flow-body"><div class="flow-title" id="ftitle3">운영 요약 생성 중</div><div class="flow-sub" id="fsub3">이슈 확인 완료 후 주간 요약 자동 생성</div></div></div>
        </div>
      </div>
    </div>
    <div id="resultSection" style="display:none;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--success);border-radius:var(--radius);padding:14px 16px" class="fade-up">
      <div class="card-hd"><div class="card-hd-l"><i class="ti ti-sparkles" style="color:var(--success)"></i> 분석 완료 <span class="badge b-success" style="margin-left:4px">완료</span></div><div style="font-size:10px;color:var(--text3);font-family:var(--mono)" id="resultFname"></div></div>
      <div class="three-col" style="margin-bottom:14px">
        <div style="text-align:center;padding:12px 10px;background:var(--surface2);border-radius:var(--radius-sm);cursor:pointer" onclick="openAnalysisTodoReview()"><div style="font-size:24px;font-weight:700;color:var(--accent);font-family:var(--mono)" id="rTodo">0</div><div style="font-size:10px;color:var(--text3);margin-top:3px">Todo 추출</div><div style="font-size:9px;color:var(--accent);margin-top:2px">클릭하여 확인 →</div></div>
        <div style="text-align:center;padding:12px 10px;background:var(--surface2);border-radius:var(--radius-sm);cursor:pointer" onclick="openAnalysisRiskReview()"><div style="font-size:24px;font-weight:700;color:var(--danger);font-family:var(--mono)" id="rIssue">0</div><div style="font-size:10px;color:var(--text3);margin-top:3px">리스크 탐지</div><div style="font-size:9px;color:var(--danger);margin-top:2px">클릭하여 확인 →</div></div>
        <div style="text-align:center;padding:12px 10px;background:var(--surface2);border-radius:var(--radius-sm)"><div style="font-size:24px;font-weight:700;color:var(--warn);font-family:var(--mono)" id="rBlocked">0</div><div style="font-size:10px;color:var(--text3);margin-top:3px">Blocked</div></div>
      </div>
      <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:6px">출처 기반 추출 근거</div>
      <div class="chunk-box"><div class="chunk-meta"><i class="ti ti-file-text" style="font-size:11px;color:var(--accent)"></i><span id="rChunkMeta"></span></div><div id="rChunkContent"></div></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
        <div style="display:flex;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);font-size:11px;align-items:flex-start">
          <i class="ti ti-file-description" style="font-size:13px;color:var(--accent);flex-shrink:0;margin-top:1px"></i>
          <div><div style="color:var(--text3);font-size:10px;margin-bottom:2px">출처 문서</div><div id="rSrcDoc" style="color:var(--text)">—</div></div>
        </div>
        <div style="display:flex;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);font-size:11px;align-items:flex-start">
          <i class="ti ti-list-search" style="font-size:13px;color:var(--accent);flex-shrink:0;margin-top:1px"></i>
          <div><div style="color:var(--text3);font-size:10px;margin-bottom:2px">관련 구간</div><div id="rSrcRange" style="color:var(--text)">—</div></div>
        </div>
        <div style="display:flex;gap:8px;padding:7px 10px;background:var(--surface2);border-radius:var(--radius-sm);font-size:11px;align-items:flex-start">
          <i class="ti ti-brain" style="font-size:13px;color:var(--accent);flex-shrink:0;margin-top:1px"></i>
          <div><div style="color:var(--text3);font-size:10px;margin-bottom:2px">AI 판단 근거</div><div id="rSrcReason" style="color:var(--text)">—</div></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <div class="tbtn" onclick="openAnalysisTodoReview()" style="color:var(--accent)"><i class="ti ti-checkbox"></i> Todo 확인</div>
        <div class="tbtn" onclick="openAnalysisRiskReview()" style="color:var(--danger)"><i class="ti ti-alert-triangle"></i> 이슈 확인</div>
        <div class="tbtn primary" onclick="applyDashboard()"><i class="ti ti-layout-dashboard"></i> Dashboard 반영 →</div>
        <div class="tbtn" onclick="resetFlow()" style="margin-left:auto"><i class="ti ti-plus"></i> 다른 파일 분석</div>
      </div>
    </div>
    <div id="historySection" style="display:none">
      <div class="card"><div class="card-hd"><div class="card-hd-l"><i class="ti ti-history"></i> 업로드 이력</div><div style="font-size:11px;color:var(--accent);cursor:pointer" onclick="toggleHistory()">닫기</div></div><div id="historyList"></div></div>
    </div>
  `

function AnalysisScreen() {
  return (
    <>
      <div className="topbar" dangerouslySetInnerHTML={{ __html: TOPBAR_INNER }} />
      <div className="content" dangerouslySetInnerHTML={{ __html: CONTENT_INNER }} />
    </>
  )
}

// memo: props 가 없으므로 부모가 재렌더해도 이 컴포넌트는 다시 렌더되지 않는다.
// (main.jsx 는 애초에 재렌더를 트리거하지 않지만, 이중 안전장치로 memo 적용.)
export default memo(AnalysisScreen)
