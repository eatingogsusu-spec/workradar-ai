// ════════════════════════════════════════════════
// 전역 상태
// ════════════════════════════════════════════════
const G = {
  currentScreen: 'dashboard',
  currentTodoTab: 'inprogress',
  currentIssueTab: 'inprogress',
  selectedTodoId: null,
  selectedIssueId: null,
  selectedCalDay: null,
  todoChecked: {},
  todoSearch: { ai: '', inprogress: '', done: '', rejected: '' },
  todoSearchField: { ai: 'all', inprogress: 'all', done: 'all', rejected: 'all' },
  todoPage: { ai: 1, inprogress: 1, done: 1, rejected: 1 },
  editTargetId: null,
  createIssueId: null,
  confirmIssueId: null,
  chatTyping: false,
  uploadedFiles: [],
  createdTodosFromIssue: [],
  calEvents: [],
  newCalEvents: [],
  analysisHistory: [],
};
window.G = G;

// ── Todo 데이터
const todos = [];

// ── 이슈 데이터
const issues = [];

// ── AI 응답
const chatResponses = {};

function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
function escapeHtml(text) {
  return normalizeText(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function getApiBase(){
  return window.OPSRADAR_API_BASE || '/api/v1';
}
async function requestApi(path, options={}){
  if(window.opsRadarApi && typeof window.opsRadarApi.request === 'function'){
    return window.opsRadarApi.request(path, options);
  }
  const isForm = options.body instanceof FormData;
  const headers = isForm ? (options.headers || {}) : {'Content-Type':'application/json', ...(options.headers || {})};
  const res = await fetch(`${getApiBase()}${path}`, {...options, headers});
  if(!res.ok) throw new Error(`API 요청 실패: ${res.status}`);
  if(res.status === 204) return null;
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}
function sourceLabel(source){
  if(!source) return '';
  if(typeof source === 'string') return source;
  const title = source.title || source.type || '운영 데이터';
  const count = source.count ?? source.total ?? null;
  return count !== null && count !== undefined ? `${title} (${count})` : title;
}
function normalizeSources(src){
  if(!src) return [];
  return (Array.isArray(src) ? src : [src]).map(sourceLabel).filter(Boolean);
}
function normalizeRenderedText(root) {
  const base = root || document.body;
  if (!base) return;
  const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const normalized = normalizeText(node.nodeValue);
    if (normalized !== node.nodeValue) node.nodeValue = normalized;
  });
}

// ════════════════════════════════════════════════
// 네비게이션
// ════════════════════════════════════════════════
function switchDbRole(role){
  const isMember = role === 'member';
  const adminView = document.getElementById('db-admin-view');
  const memberView = document.getElementById('db-member-view');
  const pmTab = document.getElementById('db-tab-pm');
  const memberTab = document.getElementById('db-tab-member');
  if(adminView) adminView.classList.toggle('active', !isMember);
  if(memberView) memberView.classList.toggle('active', isMember);
  if(pmTab) pmTab.classList.toggle('active', !isMember);
  if(memberTab) memberTab.classList.toggle('active', isMember);
}
window.switchDbRole = switchDbRole;
function getHandoffPreviewData(type){
  const generatedAt = new Date().toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' });
  const map = {
    onboarding: {
      title:'신규 입사자 온보딩 브리핑', target:'신규 입사자 온보딩',
      sections:[
        ['프로젝트 개요','WorkRader는 운영 로그, Todo, Risk, Calendar, 인수인계 문맥을 AI가 연결해 운영 상태를 추론하는 SaaS형 운영 인텔리전스 시스템입니다.'],
        ['현재 진행 업무','결제 API 안정화, 등록된 우선 작업 없음, 운영 로그 기반 Todo 추출 정확도 개선이 진행 중입니다.'],
        ['최근 주요 결정','High Risk는 Dashboard에서 먼저 확인하고, AI 생성 Todo는 승인 후 실행 관리로 넘기는 흐름을 유지합니다.'],
        ['반복 발생 이슈','운영 이벤트, 운영 리스크, Risk 데이터 없음가 반복적으로 관찰됩니다.'],
        ['미해결 Risk','운영 데이터 연결 대기, Blocked Todo 0건, 승인 대기 0건이 남아 있습니다.'],
        ['다음 담당자 주의사항','오전 스탠드업 전 High Risk 카드와 내 Todo를 먼저 확인하고, 출처 문서 기반으로 의사결정 근거를 남기세요.'],
        ['관련 문서','연결된 문서가 없습니다.'],
        ['우선 확인해야 할 Todo','등록된 Todo 없음, DB 모니터링 임계치 조정, 등록된 Todo 없음']
      ]
    },
    absence: {
      title:'부재자 업무 인수인계', target:'부재자 업무 인수인계',
      sections:[
        ['현재 진행 업무','결제 API 대응 Todo 2건과 등록된 우선 작업 없음 작업이 진행 중입니다.'],
        ['긴급 대응 필요 항목','운영 데이터 확인, DB connection pool 임계치 조정, 배포 실패 원인 재점검이 필요합니다.'],
        ['승인 대기 건','AI 생성 Todo 0건, 승인 대기 항목 0건이 승인 대기 중입니다.'],
        ['이번 주 일정','수요일 등록된 일정 없음, 금요일 P1 리스크 점검이 예정되어 있습니다.'],
        ['반복 발생 이슈','야간 인수인계 문서와 오전 실행 큐가 분리되어 실행 누락이 발생할 수 있습니다.'],
        ['미해결 Risk','담당자 부재 기간 동안 High Risk 대응 owner가 불명확해질 가능성이 있습니다.'],
        ['다음 담당자 주의사항','회의 전 승인 대기 Todo를 먼저 정리하고, 캘린더 변경 사항을 인수인계 센터에 반영하세요.'],
        ['관련 문서','연결된 문서가 없습니다.']
      ]
    },
    offboard: {
      title:'담당자 변경/퇴직 인수인계', target:'담당자 변경·퇴직 인수인계',
      sections:[
        ['장기 진행 업무','운영 로그 분석 정확도 개선, RAG 근거 연결, 배포 자동화 안정화가 장기 진행 중입니다.'],
        ['최근 주요 결정','High Risk 탐지는 결제 API, DB connection, 배포 파이프라인을 우선순위로 삼습니다.'],
        ['반복 이슈','릴리즈 직전 승인 지연, 야간 브리핑 누락, 외부 운영 이벤트이 반복됩니다.'],
        ['암묵적 운영 룰','장애성 이슈는 Todo 승인 전에도 캘린더 리스크 일정으로 먼저 등록합니다.'],
        ['핵심 문서','연결된 문서가 없습니다.'],
        ['미완료 Risk','결제 API 백업 경로 검토와 QA 자동화 적용이 아직 완료되지 않았습니다.'],
        ['다음 담당자 주의사항','기존 담당자의 캘린더, 승인 대기 Todo, 최근 7일 AI Assistant 질의 이력을 함께 확인하세요.'],
        ['생성일', generatedAt]
      ]
    }
  };
  const data = map[type] || map.onboarding;
  if(!data.sections.some(s=>s[0]==='생성일')) data.sections.push(['생성일', generatedAt]);
  return data;
}
function generateHandoffPreview(type){
  const selected = type || G.currentKnowledgeType || 'onboarding';
  const data = getHandoffPreviewData(selected);
  renderHandoffPreview(data);
  showToast('인수인계 문서 미리보기를 생성했습니다.','success');
}
function renderHandoffPreview(data){
  const body = data.sections.map(([label,value]) => `
    <div class="handoff-preview-row">
      <div class="handoff-preview-label text-content">${escapeHtml(label)}</div>
      <div class="handoff-preview-value text-content">${escapeHtml(value)}</div>
    </div>`).join('');
  let panel = document.getElementById('handoffPreviewPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'handoffPreviewPanel';
    panel.className = 'handoff-slide-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <div class="handoff-slide-backdrop" onclick="closeHandoffPreview()"></div>
    <aside class="handoff-slide-sheet" role="dialog" aria-modal="true" aria-label="인수인계 문서 미리보기">
      <div class="handoff-slide-head">
        <div>
          <div class="handoff-preview-eyebrow">AI GENERATED PREVIEW</div>
          <div class="handoff-preview-title text-content">${escapeHtml(data.title)}</div>
        </div>
        <button class="handoff-slide-close" onclick="closeHandoffPreview()" aria-label="닫기"><i class="ti ti-x"></i></button>
      </div>
      <div class="handoff-slide-meta"><span class="badge b-accent text-content">${escapeHtml(data.target)}</span><span><i class="ti ti-clock"></i> ${new Date().toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' })}</span></div>
      <div class="handoff-slide-body">
        <div class="handoff-preview-body">${body}</div>
      </div>
      <div class="handoff-slide-actions">
        <div class="tbtn" onclick="generateHandoffPreview(G.currentKnowledgeType || 'onboarding')"><i class="ti ti-refresh"></i> 다시 생성</div>
        <div class="tbtn primary" onclick="showToast('미리보기 문서가 임시 저장되었습니다.','success')"><i class="ti ti-device-floppy"></i> 임시 저장</div>
      </div>
    </aside>`;
  requestAnimationFrame(() => panel.classList.add('show'));
}
function closeHandoffPreview(){
  const panel = document.getElementById('handoffPreviewPanel');
  if(panel) panel.classList.remove('show');
}
const REPORT_STORAGE_KEY = 'opsradar_reports_v1';
function getReportTypeLabel(type){ return type === 'monthly' ? '월간 보고서' : '주간 보고서'; }
function getActiveReportPeriod(){ const active = document.querySelector('#s-reports [data-report-type].active'); return active?.dataset.reportType === 'monthly' ? 'monthly' : (G.currentReportPeriod === 'monthly' ? 'monthly' : 'weekly'); }
function getReportStatusLabel(status){ return ({ draft:'초안', complete:'완료', shared:'공유됨' })[status] || '초안'; }
function getReportStatusClass(status){ return status === 'shared' ? 'report-status-shared' : (status === 'complete' ? 'report-status-complete' : 'report-status-draft'); }
function getReportAuthor(){
  try{
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    if(stored && (stored.name || stored.username)) return stored.name || stored.username;
  }catch(e){}
  const role = localStorage.getItem('role') || (G.currentDbRole === 'member' ? 'member' : 'admin');
  return role === 'member' ? '팀원' : '관리자';
}
function getReportPeriodRange(type){
  const today = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
  if(type === 'monthly'){
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth()+1, 0);
    return `${fmt(start)} ~ ${fmt(end)}`;
  }
  const day = today.getDay() || 7;
  const start = new Date(today); start.setDate(today.getDate() - day + 1);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return `${fmt(start)} ~ ${fmt(end)}`;
}
function getReportDefaultTitle(type){
  const today = new Date();
  if(type === 'monthly') return `${today.getFullYear()}년 ${today.getMonth()+1}월 월간 보고서`;
  const week = Math.ceil(today.getDate() / 7);
  return `${today.getFullYear()}년 ${today.getMonth()+1}월 ${week}주차 주간 보고서`;
}
function getReportSeedData(){
  const now = new Date().toISOString();
  const empty = '데이터 연결 후 표시됩니다.';
  return [
    { id:'sample-weekly-report', type:'weekly', title:'최근 주간 운영 보고서', period:getReportPeriodRange('weekly'), createdAt:now, author:getReportAuthor(), status:'draft', issues:0, doneTodos:0, pendingTodos:0, sections:{completed:[empty],inProgress:[empty],technical:[empty],risk:[empty],retrospective:[empty],nextPlan:[empty]}, docs:['연결된 문서가 없습니다.'] },
    { id:'sample-monthly-report', type:'monthly', title:'최근 월간 운영 보고서', period:getReportPeriodRange('monthly'), createdAt:now, author:getReportAuthor(), status:'draft', issues:0, doneTodos:0, pendingTodos:0, sections:{completed:[empty],inProgress:[empty],technical:[empty],risk:[empty],retrospective:[empty],nextPlan:[empty]}, docs:['연결된 문서가 없습니다.'] }
  ];
}
function loadStoredReports(){
  try{
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if(raw) return JSON.parse(raw).filter(Boolean);
  }catch(e){}
  return getReportSeedData();
}
function persistReports(reports){
  try{ localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports || [])); }catch(e){}
}
function fetchReports(){
  G.savedReports = loadStoredReports();
  return G.savedReports;
}
function filterReportsByType(type){
  const selected = type || G.currentReportPeriod || 'weekly';
  const query = (document.getElementById('reportSearchInput')?.value || '').trim().toLowerCase();
  return fetchReports().filter(report => {
    const matchesType = report.type === selected;
    const haystack = `${report.title || ''} ${report.author || ''} ${report.period || ''} ${getReportStatusLabel(report.status)}`.toLowerCase();
    return matchesType && (!query || haystack.includes(query));
  });
}
function renderReportList(reports){
  const list = document.getElementById('reportList');
  const count = document.getElementById('reportListCount');
  if(!list) return;
  const data = reports || filterReportsByType(G.currentReportPeriod || 'weekly');
  if(count) count.textContent = `${data.length}건`;
  if(!data.length){
    list.innerHTML = '<div class="report-empty-state">아직 생성된 보고서가 없습니다. 운영 로그 분석 후 주간 보고서를 생성해보세요.</div>';
    renderReportDetail(null);
    return;
  }
  if(!G.selectedReportId || !data.some(r => r.id === G.selectedReportId)) G.selectedReportId = data[0].id;
  list.innerHTML = data.map(report => `
    <article class="report-item ${report.id === G.selectedReportId ? 'active' : ''}" onclick="selectReport('${escapeHtml(report.id)}')">
      <div class="report-item-top">
        <div class="report-item-title text-content">${escapeHtml(report.title || '운영 보고서')}</div>
        <span class="badge ${getReportStatusClass(report.status)}">${getReportStatusLabel(report.status)}</span>
      </div>
      <div class="report-item-meta text-content">${escapeHtml(getReportTypeLabel(report.type))} · ${escapeHtml(report.period || '-')}<br>생성일 ${escapeHtml(formatReportDate(report.createdAt))} · ${escapeHtml(report.author || getReportAuthor())}</div>
      <div class="report-item-stats">
        <span class="report-stat-chip">주요 이슈 ${Number(report.issues || 0)}건</span>
        <span class="report-stat-chip">완료 Todo ${Number(report.doneTodos || 0)}건</span>
        <span class="report-stat-chip">미완료 Todo ${Number(report.pendingTodos || 0)}건</span>
      </div>
    </article>`).join('');
  renderReportDetail(data.find(r => r.id === G.selectedReportId) || data[0]);
}
function formatReportDate(value){
  if(!value) return '-';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' });
}
function formatReportDateTime(value){
  if(!value) return '-';
  const d = new Date(value);
  if(Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' });
}
function selectReport(reportId, silent){
  const report = fetchReports().find(item => item.id === reportId);
  G.selectedReportId = report ? report.id : null;
  renderReportDetail(report || null);
  if(!silent) renderReportList();
}
function normalizeReportSections(input){
  if(!input) return { completed:[], inProgress:[], technical:[], risk:[], retrospective:[], nextPlan:[] };
  if(Array.isArray(input)){
    const keyMap = { '완료된 업무':'completed', '진행 중인 업무':'inProgress', 'AI 및 기술적 상세 내용':'technical', '리스크 관리 및 해결 방안':'risk', '팀 회고':'retrospective', '차주 계획':'nextPlan' };
    return input.reduce((acc,[title,items]) => { acc[keyMap[title] || title] = Array.isArray(items) ? items : [items]; return acc; }, {});
  }
  return input;
}
function reportSectionHtml(title, items){
  const list = Array.isArray(items) ? items : (items ? [items] : ['데이터 연결 후 표시됩니다.']);
  return `<section class="report-doc-section"><h4>${escapeHtml(title)}</h4><ul>${list.map(item=>`<li class="text-content">${escapeHtml(item)}</li>`).join('')}</ul></section>`;
}
function renderReportDetail(report){
  const detail = document.getElementById('reportDetail');
  const editorWrap = document.getElementById('reportEditorWrap');
  if(editorWrap) editorWrap.style.display = 'none';
  if(!detail) return;
  detail.style.display = 'block';
  if(!report){
    detail.className = 'report-detail-empty';
    detail.innerHTML = '아직 생성된 보고서가 없습니다. 운영 로그 분석 후 주간 보고서를 생성해보세요.';
    return;
  }
  const sections = normalizeReportSections(report.sections);
  detail.className = 'report-detail-doc';
  detail.innerHTML = `
    <div class="report-doc-head">
      <div>
        <div class="report-eyebrow">${escapeHtml(getReportTypeLabel(report.type))}</div>
        <div class="report-doc-title text-content">${escapeHtml(report.title || '운영 보고서')}</div>
        <div class="report-doc-meta">
          <span>기간 ${escapeHtml(report.period || '-')}</span>
          <span>생성일 ${escapeHtml(formatReportDateTime(report.createdAt))}</span>
          <span>작성자 ${escapeHtml(report.author || getReportAuthor())}</span>
          <span class="${getReportStatusClass(report.status)}">${getReportStatusLabel(report.status)}</span>
        </div>
      </div>
      <div class="report-doc-actions">
        <button class="tbtn" type="button" onclick="editReport('${escapeHtml(report.id)}')"><i class="ti ti-pencil"></i> 수정</button>
        <button class="tbtn" type="button" style="color:var(--danger)" onclick="deleteReport('${escapeHtml(report.id)}')"><i class="ti ti-trash"></i> 삭제</button>
        <button class="tbtn" type="button" onclick="shareReport('${escapeHtml(report.id)}')"><i class="ti ti-share"></i> 공유</button>
      </div>
    </div>
    ${reportSectionHtml('완료된 업무', sections.completed)}
    ${reportSectionHtml('진행 중인 업무', sections.inProgress)}
    ${reportSectionHtml('AI 및 기술적 상세 내용', sections.technical)}
    ${reportSectionHtml('리스크 관리 및 해결 방안', sections.risk)}
    ${reportSectionHtml('팀 회고', sections.retrospective)}
    ${reportSectionHtml('차주 계획', sections.nextPlan)}
    ${reportSectionHtml('관련 문서 / 출처', report.docs || ['연결된 문서가 없습니다.'])}`;
}
function getReportDraftData(type){
  const selected = type || G.currentReportPeriod || 'weekly';
  const cleanDraft = (typeof window.getReportDraftData === 'function' && window.getReportDraftData !== getReportDraftData) ? window.getReportDraftData() : null;
  if(cleanDraft && Array.isArray(cleanDraft.sections)){
    return { title:getReportDefaultTitle(selected), type:selected, period:getReportPeriodRange(selected), sections:cleanDraft.sections };
  }
  return {
    title:getReportDefaultTitle(selected), type:selected, period:getReportPeriodRange(selected), sections:[
      ['완료된 업무',['데이터 연결 후 표시됩니다.']],
      ['진행 중인 업무',['데이터 연결 후 표시됩니다.']],
      ['AI 및 기술적 상세 내용',['데이터 연결 후 표시됩니다.']],
      ['리스크 관리 및 해결 방안',['데이터 연결 후 표시됩니다.']],
      ['팀 회고',['데이터 연결 후 표시됩니다.']],
      ['차주 계획',['데이터 연결 후 표시됩니다.']]
    ]
  };
}
function createReportDraft(type){
  const selected = type === 'monthly' ? 'monthly' : (getActiveReportPeriod() || 'weekly');
  let base = null;
  try{ if(typeof window.getReportDraftData === 'function') base = window.getReportDraftData(); }catch(e){}
  const fallbackSections = [
    ['완료된 업무',['데이터 연결 후 표시됩니다.']],
    ['진행 중인 업무',['데이터 연결 후 표시됩니다.']],
    ['AI 및 기술적 상세 내용',['데이터 연결 후 표시됩니다.']],
    ['리스크 관리 및 해결 방안',['데이터 연결 후 표시됩니다.']],
    ['팀 회고',['데이터 연결 후 표시됩니다.']],
    ['차주 계획',['데이터 연결 후 표시됩니다.']]
  ];
  return { title:getReportDefaultTitle(selected), type:selected, period:getReportPeriodRange(selected), sections:Array.isArray(base?.sections) ? base.sections : fallbackSections };
}
function generateReportDraft(){
  const type = getActiveReportPeriod();
  G.currentReportPeriod = type;
  const data = createReportDraft(type);
  renderReportDraft(data);
  showToast(`${getReportTypeLabel(type)} 초안을 생성했습니다.`, 'success');
}
function renderReportDraft(data){
  const detail = document.getElementById('reportDetail');
  const editorWrap = document.getElementById('reportEditorWrap');
  const editor = document.getElementById('reportEditor') || document.querySelector('#s-reports [contenteditable="true"]');
  if(!editor || !editorWrap) return;
  if(detail) detail.style.display = 'none';
  editorWrap.style.display = 'flex';
  const sectionHtml = data.sections.map(([title,items]) => `
    <h3 class="text-content" style="font-size:13px;font-weight:700;color:var(--text);margin:14px 0 6px">${escapeHtml(title)}</h3>
    <ul style="padding-left:18px;margin:0 0 8px;color:var(--text2)">${(Array.isArray(items)?items:[items]).map(item=>`<li class="text-content" style="margin:4px 0">${escapeHtml(item)}</li>`).join('')}</ul>`).join('');
  editor.innerHTML = `
    <div class="text-content" style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:10px">${escapeHtml(data.title)}</div>
    <p style="margin-bottom:12px;color:var(--text2)">${escapeHtml(getReportTypeLabel(data.type))} 초안입니다. 필요 시 본문을 직접 수정한 뒤 저장할 수 있습니다.</p>
    ${sectionHtml}`;
  G.currentReportDraft = data;
  G.selectedReportId = null;
  document.querySelectorAll('#reportList .report-item').forEach(item => item.classList.remove('active'));
}
async function saveReport(report){
  const editor = document.getElementById('reportEditor') || document.querySelector('#s-reports [contenteditable="true"]');
  const draft = report || G.currentReportDraft || createReportDraft(G.currentReportPeriod || 'weekly');
  if(!window.opsRadarApi){
    showToast('DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.','warn');
    return null;
  }

  const sections = normalizeReportSections(draft.sections);
  const content = editor ? editor.innerHTML : (draft.html || '');

  try{
    let reportId = draft.apiId;
    if(!reportId){
      const generated = await window.opsRadarApi.request('/reports/generate', {
        method:'POST',
        body:JSON.stringify({ period:draft.type === 'monthly' ? 'monthly' : 'weekly' })
      });
      reportId = generated.report_id;
    }

    await window.opsRadarApi.request(`/reports/${reportId}`, {
      method:'PATCH',
      body:JSON.stringify({ content })
    });

    const payload = {
      id: reportId,
      apiId: reportId,
    type: draft.type || getActiveReportPeriod(),
    title: draft.title || getReportDefaultTitle(draft.type || getActiveReportPeriod()),
    period: draft.period || getReportPeriodRange(draft.type || getActiveReportPeriod()),
    createdAt: draft.createdAt || new Date().toISOString(),
    author: draft.author || getReportAuthor(),
    status: draft.status || 'draft',
    issues: Number(draft.issues || issues.length || 0),
    doneTodos: Number(draft.doneTodos || todos.filter(t=>t.status==='done').length || 0),
    pendingTodos: Number(draft.pendingTodos || todos.filter(t=>t.status!=='done').length || 0),
    sections,
    docs: draft.docs || ['연결된 문서가 없습니다.'],
    html: content
    };
    G.currentReportDraft = null;
    G.selectedReportId = payload.id;
    await window.opsRadarApi.loadReports();
    renderReportDetail(payload);
    showToast('보고서가 DB에 저장되었습니다.','success');
    return payload;
  }catch(error){
    console.warn('Report save API failed', error);
    showToast('보고서 저장에 실패했습니다.','warn');
    return null;
  }
}
function editReport(reportId){
  const report = fetchReports().find(item => item.id === reportId);
  if(!report) return;
  G.currentReportDraft = report;
  renderReportDraft({ title:report.title, type:report.type, period:report.period, sections:Object.entries(normalizeReportSections(report.sections)).map(([key,items]) => [{completed:'완료된 업무',inProgress:'진행 중인 업무',technical:'AI 및 기술적 상세 내용',risk:'리스크 관리 및 해결 방안',retrospective:'팀 회고',nextPlan:'차주 계획'}[key] || key, items]) });
}
function setReportPeriod(period){
  G.currentReportPeriod = period === 'monthly' ? 'monthly' : 'weekly';
  document.querySelectorAll('#s-reports [data-report-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.reportType === G.currentReportPeriod));
  G.selectedReportId = null;
  const editorWrap = document.getElementById('reportEditorWrap');
  if(editorWrap) editorWrap.style.display = 'none';
  renderReportList();
}
function focusReportEditor(){
  const editor = document.getElementById('reportEditor') || document.querySelector('#s-reports [contenteditable="true"]');
  if(editor) editor.focus();
  return editor;
}
function formatReport(command){
  const editor = focusReportEditor();
  if(!editor) return;
  try{
    if(command === 'h1') document.execCommand('formatBlock', false, 'h1');
    else if(command === 'h2') document.execCommand('formatBlock', false, 'h2');
    else if(command === 'list') document.execCommand('insertUnorderedList', false, null);
    else document.execCommand(command, false, null);
    showToast('보고서 편집 서식을 적용했습니다.', 'success');
  }catch(e){ showToast('브라우저 편집 명령을 적용할 수 없습니다.', 'info'); }
}
function shareReport(reportId){
  const reports = fetchReports();
  const target = reports.find(item => item.id === reportId) || reports.find(item => item.id === G.selectedReportId);
  if(target){ target.status = 'shared'; persistReports(reports); renderReportList(); renderReportDetail(target); }
  G.sharedReports = G.sharedReports || [];
  G.sharedReports.unshift({ id:'mock-share-' + Date.now(), reportId:target?.id || null, sharedAt:new Date().toISOString() });
  showToast('보고서 공유 링크를 생성했습니다. 실제 API 연결 전까지 mock 처리됩니다.', 'success');
}
function initReportsScreen(){
  if(!G.currentReportPeriod) G.currentReportPeriod = 'weekly';
  document.querySelectorAll('#s-reports [data-report-type]').forEach(btn => btn.classList.toggle('active', btn.dataset.reportType === G.currentReportPeriod));
  fetchReports();
  renderReportList();
  bindRemainingActionButtons();
  initDocumentGenerationActions();
}
function openIssueManualFallback(){ openIssueCreateModal(); }
function bindRemainingActionButtons(){
  const issueManual = Array.from(document.querySelectorAll('#s-issues .topbar .tbtn.primary')).find(btn => (btn.textContent || '').includes('수동 등록'));
  if(issueManual && !issueManual.dataset.boundAction){ issueManual.dataset.boundAction = '1'; issueManual.addEventListener('click', openIssueManualFallback); }
  document.querySelectorAll('#s-reports [data-report-type]').forEach(btn => {
    if(!btn.dataset.periodBound){ btn.dataset.periodBound = '1'; btn.addEventListener('click', () => setReportPeriod(btn.dataset.reportType)); }
  });
  document.querySelectorAll('#s-reports .report-editor-toolbar .tbtn').forEach(btn => {
    const text = (btn.textContent || '').trim();
    if(btn.dataset.formatBound) return;
    if(text === 'B'){ btn.dataset.formatBound = '1'; btn.addEventListener('click', () => formatReport('bold')); }
    else if(text === 'I'){ btn.dataset.formatBound = '1'; btn.addEventListener('click', () => formatReport('italic')); }
    else if(text === 'H1'){ btn.dataset.formatBound = '1'; btn.addEventListener('click', () => formatReport('h1')); }
    else if(text === 'H2'){ btn.dataset.formatBound = '1'; btn.addEventListener('click', () => formatReport('h2')); }
    else if(btn.querySelector('.ti-list')){ btn.dataset.formatBound = '1'; btn.addEventListener('click', () => formatReport('list')); }
  });
  document.querySelectorAll('#s-reports .report-editor-actions .tbtn').forEach(btn => {
    const text = (btn.textContent || '').trim();
    if(text.includes('공유') && !btn.dataset.shareReportBound){ btn.dataset.shareReportBound = '1'; btn.addEventListener('click', () => shareReport()); }
  });
}
function initDocumentGenerationActions(){
  const knowledgeButtons = Array.from(document.querySelectorAll('#s-knowledge .tbtn'));
  knowledgeButtons.forEach(btn => {
    if(btn.textContent && btn.textContent.includes('문서 생성 미리보기') && !btn.dataset.previewBound){
      btn.dataset.previewBound = '1';
      btn.addEventListener('click', () => generateHandoffPreview(G.currentKnowledgeType || 'onboarding'));
    }
  });
  const reportTopButton = document.querySelector('#s-reports .topbar .tbtn.primary');
  if(reportTopButton && !reportTopButton.dataset.reportBound){ reportTopButton.dataset.reportBound = '1'; reportTopButton.addEventListener('click', generateReportDraft); }
  document.querySelectorAll('#s-reports .report-editor-actions .tbtn').forEach(btn => {
    if(btn.textContent && btn.textContent.includes('저장') && !btn.dataset.saveReportBound){ btn.dataset.saveReportBound = '1'; btn.addEventListener('click', () => saveReport()); }
  });
}
window.fetchReports = fetchReports;
window.renderReportList = renderReportList;
window.selectReport = selectReport;
window.renderReportDetail = renderReportDetail;
window.createReportDraft = createReportDraft;
window.saveReport = saveReport;
window.filterReportsByType = filterReportsByType;
function nav(screen) {
  // 플로팅 패널 닫기
  document.getElementById('floatPanel')?.classList.remove('show');
  document.getElementById('notifPanel')?.classList.remove('show');

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(s => s.classList.remove('active'));
  // 방어: 노드가 없으면(잘못된 화면명/미마운트) 그 부분만 건너뛰고 nav는 끝까지 진행(throw 금지).
  const screenEl = document.getElementById('s-' + screen);
  if (screenEl) screenEl.classList.add('active');
  else console.warn('nav: screen node not found: s-' + screen);
  const navEl = document.getElementById('nav-' + screen);
  if (navEl) navEl.classList.add('active');
  G.currentScreen = screen;
  const floatAI = document.getElementById('floatAI');
  if(floatAI) floatAI.style.display = screen === 'chat' ? 'none' : '';

  // 방어: 화면별 init이 에러나도 nav 자체는 멈추지 않게 감싼다(에러는 console.warn으로만).
  try {
    if (screen === 'todo') renderTodos();
    if (screen === 'issues') renderIssues();
    if (screen === 'calendar') { renderCalendar(); showCalBanner(); }
    if (screen === 'settings') updateSettingsPage();
    if (screen === 'reports') initReportsScreen();
    if (screen === 'chat') initChatSessions();
    if (screen === 'knowledge') {
      setTimeout(initDocumentGenerationActions, 0);
      setTimeout(bindRemainingActionButtons, 0);
      // 버튼 전체 초기화 후 온보딩으로 바로 시작
      ['onboarding','absence','offboard'].forEach(t => {
        const btn = document.getElementById('kbtn-'+t);
        if (btn) btn.removeAttribute('style');
      });
      renderKnowledgeAbsence();
      selectKnowledgeType('onboarding');
    }
  } catch (e) {
    console.warn('nav: screen init failed for "' + screen + '":', e);
  }
}

// ════════════════════════════════════════════════
// 흐름 1 — 파일 업로드 → 분석
// ════════════════════════════════════════════════
function ondov(e){e.preventDefault();document.getElementById('uploadZone').classList.add('dragover')}
function ondl(e){document.getElementById('uploadZone').classList.remove('dragover')}
function handleUploadDrop(e){e.preventDefault();document.getElementById('uploadZone').classList.remove('dragover');handleFiles(Array.from(e.dataTransfer.files))}
function onFileSelect(e){handleFiles(Array.from(e.target.files))}

function getUploadErrorMessage(reason){
  const messages = {
    empty:'파일 내용이 비어 있습니다.',
    unsupported:'지원하지 않는 파일 형식입니다.',
    structure:'날짜, 작성자, 내용 구분을 찾기 어렵습니다.',
    pdfImage:'이미지로만 구성된 PDF는 내용을 읽기 어려울 수 있습니다.',
    general:'업무 기록 구조를 인식하지 못했습니다.'
  };
  return messages[reason] || messages.general;
}
function validateUploadedFile(file){
  if(!file) return { ok:false, reason:'general' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const allowed = ['txt','md','markdown','csv','docx','pdf'];
  if(!allowed.includes(ext)) return { ok:false, reason:'unsupported' };
  if(file.size === 0) return { ok:false, reason:'empty' };
  return { ok:true, reason:null };
}
function readTextFile(file){
  return new Promise(resolve => {
    if(!file || !/\.(txt|csv)$/i.test(file.name)){ resolve(''); return; }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}
function looksLikeClaimsCsv(text){
  const value = normalizeText(text).trim();
  if(!value) return false;
  const firstLine = value.split(/\r?\n/).find(line => line.trim());
  if(!firstLine) return false;
  const headers = firstLine
    .split(',')
    .map(col => col.trim().replace(/^"|"$/g, '').toLowerCase());
  const required = ['claim_id', 'defect_type', 'claim_status'];
  return required.every(name => headers.includes(name));
}
function looksLikeBusinessRecord(text){
  const value = normalizeText(text).trim();
  if(!value) return false;
  const hasDate = /\d{4}[-.]\d{1,2}[-.]\d{1,2}|Date\s*:|날짜\s*:/.test(value);
  const hasSpeaker = /[가-힣A-Za-z0-9._%+-]+\s*:|From\s*:|참석자\s*:|작성자\s*:/.test(value);
  const hasContent = /Todo\s*:|Content\s*:|결정사항\s*:|안건\s*:|필요|확인|수정|대응|진행/.test(value);
  return hasDate && (hasSpeaker || hasContent);
}
async function validateUploadedFiles(files){
  for(const file of files){
    const basic = validateUploadedFile(file);
    if(!basic.ok) return basic;
    if(/\.(txt|csv)$/i.test(file.name)){
      const text = await readTextFile(file);
      if(/\.csv$/i.test(file.name) && looksLikeClaimsCsv(text)) continue;
      if(!looksLikeBusinessRecord(text)) return { ok:false, reason:'structure' };
    }
  }
  return { ok:true };
}
function showUploadError(reason){
  const card = document.getElementById('uploadErrorCard');
  if(!card) return;
  const friendly = getUploadErrorMessage(reason);
  card.innerHTML = `
    <div class="upload-error-head">
      <div class="upload-error-icon"><i class="ti ti-alert-triangle"></i></div>
      <div><div class="upload-error-title">파일을 분석할 수 없습니다.</div><div class="upload-error-desc">지원하지 않는 파일 형식이거나, 업무 기록 구조를 인식하지 못했습니다.<br>날짜, 작성자, 내용이 포함된 파일로 다시 업로드해주세요.</div></div>
    </div>
    <div class="upload-error-reasons">
      <div class="upload-error-reason"><i class="ti ti-point"></i><span>${escapeHtml(friendly)}</span></div>
      <div class="upload-error-reason"><i class="ti ti-point"></i><span>날짜/작성자/내용 구분이 어려울 수 있습니다.</span></div>
      <div class="upload-error-reason"><i class="ti ti-point"></i><span>이미지형 PDF는 텍스트 확인이 어려울 수 있습니다.</span></div>
      <div class="upload-error-reason"><i class="ti ti-point"></i><span>업무 기록이 아닌 일반 문서는 분석 정확도가 낮습니다.</span></div>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-top:4px">지원 파일 형식</div>
    <div class="upload-supported"><span>txt</span><span>md</span><span>csv</span><span>docx</span><span>pdf</span></div>
    <div class="upload-error-actions"><div class="tbtn primary" onclick="retryUpload()"><i class="ti ti-upload"></i> 다시 업로드</div><div class="tbtn" onclick="showUploadGuide()"><i class="ti ti-file-description"></i> 지원 양식 보기</div></div>`;
  card.style.display = 'block';
  document.getElementById('analysisGuide').style.display = 'flex';
  document.getElementById('analysisSection').style.display = 'none';
  document.getElementById('resultSection').style.display = 'none';
}
function hideUploadError(){ const card=document.getElementById('uploadErrorCard'); if(card) card.style.display='none'; }
function resetUploadInput(){
  document.querySelectorAll('#uploadZone input[type="file"]').forEach(input => { input.value = ''; });
}
function retryUpload(){
  resetUpload();
  hideUploadError();
  setTimeout(() => document.querySelector('#uploadZone input[type="file"]')?.click(), 0);
}
function showUploadGuide(){ openModal('uploadGuideModal'); }
window.validateUploadedFile = validateUploadedFile;
window.showUploadError = showUploadError;
window.resetUploadInput = resetUploadInput;
window.showUploadGuide = showUploadGuide;
window.retryUpload = retryUpload;

async function handleFiles(files) {
  if (!files.length) return;
  hideUploadError();
  G.uploadedFiles = files;
  const validation = await validateUploadedFiles(files);
  const items = document.getElementById('fileItems');
  items.innerHTML = files.map(f => `<div class="file-row ${validation.ok ? '' : 'error'}"><i class="ti ti-file-text" style="font-size:16px;color:${validation.ok ? 'var(--accent)' : 'var(--danger)'}"></i><div style="flex:1;font-weight:500;color:var(--text)">${escapeHtml(f.name)}</div><div style="font-size:10px;color:var(--text3);font-family:var(--mono)">${(f.size/1024).toFixed(1)}KB</div><span class="badge ${validation.ok ? 'b-gray' : 'b-danger'}">${validation.ok ? '대기' : '확인 필요'}</span></div>`).join('');
  document.getElementById('fileList').style.display = 'block';
  document.getElementById('stepBar').style.display = 'flex';
  setStepBar(1);
  if(!validation.ok) showUploadError(validation.reason);
}

async function startAnalysis() {
  if (!G.uploadedFiles.length) { showUploadError('general'); return; }
  hideUploadError();
  const validation = await validateUploadedFiles(G.uploadedFiles);
  if(!validation.ok){ showUploadError(validation.reason); return; }
  document.getElementById('uploadSection').style.display = 'none';
  document.getElementById('analysisSection').style.display = 'block';
  document.getElementById('analysisGuide').style.display = 'none';
  const fname = G.uploadedFiles[0].name;
  document.getElementById('uploadedFname').textContent = `AI가 업무 내용을 분석하고 있습니다... · ${fname}`;
  setStepBar(2);
  runFlowStep(1, fname);
}

function runFlowStep(step, fname) {
  const icons = ['ti-checkbox','ti-alert-triangle','ti-file-description'];
  const activeTitles = ['업무 항목 추출 중...','위험 이슈 확인 중...','운영 요약 생성 중...'];
  const doneTitles = ['업무 항목 추출 완료','위험 이슈 확인 완료','운영 요약 생성 완료'];
  const doneSubs = ['업무 항목 추출 완료','위험 이슈 확인 완료','운영 요약 생성 완료'];
  const delays = [1800, 2000, 1800];

  setFlow(step, 'active', activeTitles[step-1], 'AI 분석 진행 중...', 's-active');
  setTimeout(() => {
    setFlow(step, 'done', doneTitles[step-1], doneSubs[step-1], 's-done');
    if (step < 3) runFlowStep(step+1, fname);
    else {
      document.getElementById('analysisBadge').textContent = '완료';
      document.getElementById('analysisBadge').className = 'badge b-success';
      showAnalysisResult(fname);
    }
  }, delays[step-1]);
}

function setFlow(n, state, title, sub, subCls) {
  const icon = document.getElementById('ficon'+n);
  icon.className = 'flow-icon fi-'+state;
  icon.innerHTML = state==='active' ? '<i class="ti ti-loader-2 spin" style="font-size:11px"></i>' : '<i class="ti ti-check" style="font-size:11px"></i>';
  document.getElementById('ftitle'+n).textContent = title;
  const s = document.getElementById('fsub'+n);
  s.textContent = sub; s.className = 'flow-sub '+subCls;
}

function showAnalysisResult(fname) {
  setStepBar(3);
  const key = fname.includes('meeting')||fname.includes('회의') ? 'meeting' : fname.includes('chat')||fname.includes('채팅') ? 'chat' : 'issue';
  const data = {
    meeting:{t:5,i:2,b:1,cm:'회의록 · 1페이지 · chunk #1',cc:'운영 회의. 운영 API 응답 지연 <span class="chunk-hl">5초 초과</span>. <span class="chunk-hl">이성우 추가 시간 필요</span>.',reason:'회의록에서 지연·초과·필요 키워드 반복 감지'},
    chat:{t:3,i:2,b:1,cm:'채팅 로그 · chunk #6',cc:'이성우: <span class="chunk-hl">운영 API 타임아웃</span>이 계속 발생합니다. <span class="chunk-hl">재시도 로직</span> 필요.',reason:'채팅 로그에서 API 타임아웃 반복 언급 감지'},
    issue:{t:2,i:3,b:1,cm:'이슈 로그 · chunk #8',cc:'운영 API 응답 지연 <span class="chunk-hl">5초 초과</span>. 담당: <span class="chunk-hl">이성우</span>. <span class="chunk-hl">재시도 로직 추가 필요</span>.',reason:'이슈 로그에서 5초 초과 지연 및 담당자 미조치 패턴 감지'}
  };
  const d = data[key] || data.meeting;
  document.getElementById('resultFname').textContent = fname;
  document.getElementById('rChunkMeta').textContent = d.cm;
  document.getElementById('rChunkContent').innerHTML = d.cc;
  // 출처 상세 (수정 5)
  document.getElementById('rSrcDoc').textContent = d.cm.split(' · ')[0] || '—';
  document.getElementById('rSrcRange').textContent = d.cm.split(' · ')[1] || '—';
  document.getElementById('rSrcReason').textContent = d.reason || '반복 지연 표현 및 리스크 키워드 감지';
  countUp('rTodo', d.t, 800); countUp('rIssue', d.i, 1000); countUp('rBlocked', d.b, 600);
  const rs = document.getElementById('resultSection');
  rs.style.display = 'block';
  G.analysisHistory.unshift({name:fname,type:key,date:formatOpsDate('short'),todo:d.t,issue:d.i,blocked:d.b});
  showToast('분석이 완료되었습니다.');
  addNotif(`"${fname.slice(0,20)}..." 분석 완료. Todo와 이슈를 확인하세요.`, 'success');
}

function countUp(id, target, dur) {
  const el = document.getElementById(id); let cur = 0;
  const step = target/(dur/50);
  const t = setInterval(()=>{cur=Math.min(cur+step,target);el.textContent=Math.floor(cur);if(cur>=target)clearInterval(t)},50);
}

function applyDashboard() { showToast('Dashboard에 반영되었습니다.'); setTimeout(()=>nav('dashboard'),1000); }

function resetFlow() {
  G.uploadedFiles = [];
  document.getElementById('uploadSection').style.display = 'block';
  document.getElementById('analysisSection').style.display = 'none';
  document.getElementById('resultSection').style.display = 'none';
  document.getElementById('fileList').style.display = 'none';
  document.getElementById('analysisGuide').style.display = 'flex';
  document.getElementById('stepBar').style.display = 'none';
  document.getElementById('analysisBadge').textContent = '분석 중...';
  document.getElementById('analysisBadge').className = 'badge b-accent';
  [1,2,3].forEach(n=>{const ic=document.getElementById('ficon'+n);ic.className='flow-icon fi-wait';ic.innerHTML=`<i class="ti ${['ti-checkbox','ti-alert-triangle','ti-file-description'][n-1]}" style="font-size:11px"></i>`;});
}

function resetUpload(){G.uploadedFiles=[];document.getElementById('fileList').style.display='none';document.getElementById('stepBar').style.display='none';document.getElementById('uploadSection').style.display='block';document.getElementById('analysisSection').style.display='none';document.getElementById('resultSection').style.display='none';document.getElementById('analysisGuide').style.display='flex';hideUploadError();resetUploadInput();}
function setStepBar(n){['s1lbl','s2lbl','s3lbl'].forEach((id,i)=>{const el=document.getElementById(id);el.className=i+1===n?'badge b-accent':'';el.style.color=i+1===n?'':'';})}
function toggleHistory(){const s=document.getElementById('historySection');s.style.display=s.style.display==='none'?'block':'none';if(typeof window.renderHistory==='function')window.renderHistory();else renderHistory();}
function renderHistory(){document.getElementById('historyList').innerHTML=(G.analysisHistory.length?G.analysisHistory.map(h=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:11px"><i class="ti ti-file-text" style="font-size:14px;color:var(--accent)"></i><div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(h.name)}</div><div style="display:flex;gap:4px"><span class="badge b-accent" style="font-size:9px">Todo ${h.todo}</span><span class="badge b-danger" style="font-size:9px">Risk ${h.issue}</span></div><div style="font-size:10px;color:var(--text3);font-family:var(--mono)">${escapeHtml(h.date)}</div>${h.documentId?`<button type="button" title="삭제" onclick="deleteDocumentFromHistory('${escapeHtml(h.documentId)}')" style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0 2px;font-size:13px;line-height:1"><i class="ti ti-trash"></i></button>`:''}</div>`).join(''):'<div style="font-size:11px;color:var(--text3);padding:12px;text-align:center">업로드 이력이 없습니다.</div>');}

function analysisTodoKey(item){return String(item?.apiId||item?.id||'');}
function analysisTodoAssigneeOptions(selected){
  const names=(window.opsRadarMembers||[]).filter(m=>(m.status||'active')==='active').map(m=>m.name).filter(Boolean);
  const base=['<option value="">미지정</option>'].concat(names.map(name=>`<option value="${escapeHtml(name)}" ${name===selected?'selected':''}>${escapeHtml(name)}</option>`));
  if(selected && !names.includes(selected))base.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)}</option>`);
  return base.join('');
}
function getAnalysisTodoItems(){return Array.isArray(G.analysisTodoReview)?G.analysisTodoReview:[];}
function openAnalysisTodoReview(){
  const items=getAnalysisTodoItems();
  if(!items.length){showToast('확인할 Todo 목록이 없습니다.','info');return;}
  G.analysisTodoChecked=G.analysisTodoChecked||{};
  items.forEach(item=>{const key=analysisTodoKey(item);if(G.analysisTodoChecked[key]===undefined)G.analysisTodoChecked[key]=true;});
  document.getElementById('analysisTodoCloseConfirm').style.display='none';
  document.getElementById('analysisTodoModal').classList.add('show');
  renderAnalysisTodoReview();
}
function renderAnalysisTodoReview(){
  const list=document.getElementById('analysisTodoList');if(!list)return;
  const items=getAnalysisTodoItems();
  if(!items.length){list.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">남은 Todo 후보가 없습니다.</div>';updateAnalysisTodoCheckedCount();return;}
  list.innerHTML=items.map((item,idx)=>{
    const key=analysisTodoKey(item);const checked=G.analysisTodoChecked?.[key]!==false;
    const title=cleanTodoTitle(item.title);const desc=briefTodoText(item);const assignee=item.assignee||item.recommendedAssignee||'';
    return `<div style="border:1px solid var(--border);background:var(--surface2);border-radius:var(--radius-sm);padding:10px;display:grid;grid-template-columns:24px 1fr 170px;gap:10px;align-items:start">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleAnalysisTodoChecked('${escapeHtml(key)}',this.checked)" style="accent-color:var(--accent);margin-top:6px">
      <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
        <input class="form-input" value="${escapeHtml(title)}" oninput="updateAnalysisTodoField(${idx},'title',this.value)" placeholder="Todo 제목">
        <textarea class="form-input" rows="2" style="resize:vertical" oninput="updateAnalysisTodoField(${idx},'description',this.value)" placeholder="간략한 업무내용">${escapeHtml(desc)}</textarea>
      </div>
      <div><div class="form-label">추천 담당자</div><select class="form-input" onchange="updateAnalysisTodoField(${idx},'assignee',this.value)">${analysisTodoAssigneeOptions(assignee)}</select></div>
    </div>`;
  }).join('');
  updateAnalysisTodoCheckedCount();
}
function updateAnalysisTodoField(idx,field,value){const item=getAnalysisTodoItems()[idx];if(!item)return;item[field]=value;}
function toggleAnalysisTodoChecked(key,checked){G.analysisTodoChecked=G.analysisTodoChecked||{};G.analysisTodoChecked[key]=checked;updateAnalysisTodoCheckedCount();}
function setAllAnalysisTodoChecked(checked){G.analysisTodoChecked=G.analysisTodoChecked||{};getAnalysisTodoItems().forEach(item=>{G.analysisTodoChecked[analysisTodoKey(item)]=checked;});renderAnalysisTodoReview();}
function selectedAnalysisTodos(){return getAnalysisTodoItems().filter(item=>G.analysisTodoChecked?.[analysisTodoKey(item)]!==false);}
function updateAnalysisTodoCheckedCount(){const el=document.getElementById('analysisTodoCheckedCount');if(el)el.textContent=selectedAnalysisTodos().length;}
async function moveCheckedAnalysisTodosToProgress(){
  const selected=selectedAnalysisTodos();if(!selected.length){showToast('선택된 Todo가 없습니다.','info');return;}
  try{
    await Promise.all(selected.filter(item=>item.apiId).map(item=>window.opsRadarApi.request(`/todos/${item.apiId}`,{method:'PATCH',body:JSON.stringify({title:cleanTodoTitle(item.title),description:briefTodoText(item),assignee:item.assignee||item.recommendedAssignee||null,status:'in_progress',approval_status:'approved'})})));
    const selectedKeys=new Set(selected.map(analysisTodoKey));
    G.analysisTodoReview=getAnalysisTodoItems().filter(item=>!selectedKeys.has(analysisTodoKey(item)));
    selectedKeys.forEach(key=>delete G.analysisTodoChecked[key]);
    if(window.opsRadarApi)await window.opsRadarApi.loadTodos();
    showToast(`${selected.length}개 Todo를 진행 Todo로 이동했습니다.`,'success');
    renderAnalysisTodoReview();
    if(!getAnalysisTodoItems().length)closeModal('analysisTodoModal');
    nav('todo');switchTodoTab('inprogress');
  }catch(error){console.warn('analysis todo approve failed',error);showToast('진행 Todo 이동에 실패했습니다.','warn');}
}
async function deleteCheckedAnalysisTodos(){
  const selected=selectedAnalysisTodos();if(!selected.length){showToast('선택된 Todo가 없습니다.','info');return;}
  try{
    await Promise.all(selected.filter(item=>item.apiId).map(item=>window.opsRadarApi.request(`/todos/${item.apiId}`,{method:'DELETE'})));
    const selectedKeys=new Set(selected.map(analysisTodoKey));
    G.analysisTodoReview=getAnalysisTodoItems().filter(item=>!selectedKeys.has(analysisTodoKey(item)));
    selectedKeys.forEach(key=>delete G.analysisTodoChecked[key]);
    if(window.opsRadarApi)await window.opsRadarApi.loadTodos();
    showToast(`${selected.length}개 Todo를 삭제했습니다.`,'info');
    renderAnalysisTodoReview();
    if(!getAnalysisTodoItems().length)closeModal('analysisTodoModal');
  }catch(error){console.warn('analysis todo delete failed',error);showToast('Todo 삭제에 실패했습니다.','warn');}
}
function requestCloseAnalysisTodoModal(){
  if(getAnalysisTodoItems().length){document.getElementById('analysisTodoCloseConfirm').style.display='block';return;}
  closeModal('analysisTodoModal');
}
function confirmCloseAnalysisTodoModal(ok){
  if(ok){document.getElementById('analysisTodoCloseConfirm').style.display='none';closeModal('analysisTodoModal');return;}
  document.getElementById('analysisTodoCloseConfirm').style.display='none';
}
function openDashboardTodoTab(tabName){
  const tabMap={ai:'ai',pending:'ai',inprogress:'inprogress',progress:'inprogress',done:'done',completed:'done',rejected:'rejected'};
  const targetTab=tabMap[tabName]||'ai';
  nav('todo');
  switchTodoTab(targetTab);
}
function analysisRiskKey(item){return String(item?.apiId||item?.id||item?.title||'');}
function getAnalysisRiskItems(){return Array.isArray(G.analysisRiskReview)?G.analysisRiskReview:[];}
function seedAnalysisRiskItems(){
  if(getAnalysisRiskItems().length)return;
  const source=Array.isArray(issues)&&issues.length?issues.filter(item=>item.type!=='resolved'):[];
  G.analysisRiskReview=source.map(item=>({...item}));
}
function openAnalysisRiskReview(){
  seedAnalysisRiskItems();
  const items=getAnalysisRiskItems();
  G.analysisRiskChecked=G.analysisRiskChecked||{};
  items.forEach(item=>{const key=analysisRiskKey(item);if(G.analysisRiskChecked[key]===undefined)G.analysisRiskChecked[key]=true;});
  const confirmEl=document.getElementById('analysisRiskCloseConfirm');
  if(confirmEl)confirmEl.style.display='none';
  const modal=document.getElementById('analysisRiskModal');
  if(!modal){showToast('리스크 검토 기능은 현재 연결 준비 중입니다.','info');return;}
  modal.classList.add('show');
  renderAnalysisRiskReview();
}
function renderAnalysisRiskReview(){
  const list=document.getElementById('analysisRiskList');if(!list)return;
  const items=getAnalysisRiskItems();
  if(!items.length){
    list.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">검토할 Risk 후보가 없습니다. 운영 로그 분석 후 다시 확인해주세요.</div>';
    updateAnalysisRiskCheckedCount();
    return;
  }
  list.innerHTML=items.map((item,idx)=>{
    const key=analysisRiskKey(item);const checked=G.analysisRiskChecked?.[key]!==false;
    const title=escapeHtml(item.title||`Risk 후보 ${idx+1}`);
    const severity=escapeHtml(item.severity||item.level||'medium');
    const desc=escapeHtml(item.reason||item.desc||item.description||'운영 로그 기반으로 검토가 필요한 Risk 후보입니다.');
    const assignee=escapeHtml(item.assignee||'미지정');
    return `<div style="border:1px solid var(--border);background:var(--surface2);border-radius:var(--radius-sm);padding:10px;display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start">
      <input type="checkbox" ${checked?'checked':''} onchange="toggleAnalysisRiskChecked('${escapeHtml(key)}',this.checked)" style="accent-color:var(--danger);margin-top:5px">
      <div style="min-width:0">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><strong style="font-size:12px;color:var(--text)">${title}</strong><span class="badge b-danger">${severity}</span><span class="badge b-gray">${assignee}</span></div>
        <div class="text-content" style="font-size:11px;color:var(--text2);line-height:1.6">${desc}</div>
      </div>
    </div>`;
  }).join('');
  updateAnalysisRiskCheckedCount();
}
function toggleAnalysisRiskChecked(key,checked){G.analysisRiskChecked=G.analysisRiskChecked||{};G.analysisRiskChecked[key]=checked;updateAnalysisRiskCheckedCount();}
function setAllAnalysisRiskChecked(checked){G.analysisRiskChecked=G.analysisRiskChecked||{};getAnalysisRiskItems().forEach(item=>{G.analysisRiskChecked[analysisRiskKey(item)]=checked;});renderAnalysisRiskReview();}
function selectedAnalysisRisks(){return getAnalysisRiskItems().filter(item=>G.analysisRiskChecked?.[analysisRiskKey(item)]!==false);}
function updateAnalysisRiskCheckedCount(){const el=document.getElementById('analysisRiskCheckedCount');if(el)el.textContent=selectedAnalysisRisks().length;}
async function moveCheckedAnalysisRisksToConfirmed(){
  const selected=selectedAnalysisRisks();
  if(!selected.length){showToast('선택된 Risk 후보가 없습니다.','info');return;}
  try{
    await Promise.all(selected.filter(item=>item.apiId).map(item=>window.opsRadarApi.request(`/issues/${item.apiId}`,{method:'PATCH',body:JSON.stringify({approval_status:'approved'})})));
  }catch(e){console.warn('analysis risk approve failed',e);showToast('이슈 저장에 실패했습니다.','warn');return;}
  const selectedKeys=new Set(selected.map(analysisRiskKey));
  selected.forEach(item=>{
    const existing=issues.find(issue=>issue.id===item.id||issue.apiId===item.apiId);
    if(existing){existing.type='confirmed';existing.status=existing.status||'open';}
    else issues.unshift({...item,id:item.id||Date.now()+Math.random(),type:'confirmed',status:item.status||'open'});
  });
  G.analysisRiskReview=getAnalysisRiskItems().filter(item=>!selectedKeys.has(analysisRiskKey(item)));
  selectedKeys.forEach(key=>delete G.analysisRiskChecked[key]);
  if(window.opsRadarApi)await window.opsRadarApi.loadIssues();
  renderAnalysisRiskReview();
  renderIssues();
  showToast(`${selected.length}개 Risk 후보를 확정 이슈로 이동했습니다.`,'success');
  if(!getAnalysisRiskItems().length)closeModal('analysisRiskModal');
  nav('issues');switchIssueTab('inprogress');
}
function deleteCheckedAnalysisRisks(){
  const selected=selectedAnalysisRisks();
  if(!selected.length){showToast('선택된 Risk 후보가 없습니다.','info');return;}
  const selectedKeys=new Set(selected.map(analysisRiskKey));
  G.analysisRiskReview=getAnalysisRiskItems().filter(item=>!selectedKeys.has(analysisRiskKey(item)));
  selectedKeys.forEach(key=>delete G.analysisRiskChecked[key]);
  renderAnalysisRiskReview();
  showToast(`${selected.length}개 Risk 후보를 삭제했습니다.`,'info');
  if(!getAnalysisRiskItems().length)closeModal('analysisRiskModal');
}
function requestCloseAnalysisRiskModal(){
  const confirmEl=document.getElementById('analysisRiskCloseConfirm');
  if(getAnalysisRiskItems().length&&confirmEl){confirmEl.style.display='block';return;}
  closeModal('analysisRiskModal');
}
function confirmCloseAnalysisRiskModal(ok){
  const confirmEl=document.getElementById('analysisRiskCloseConfirm');
  if(ok){if(confirmEl)confirmEl.style.display='none';closeModal('analysisRiskModal');return;}
  if(confirmEl)confirmEl.style.display='none';
}
window.openAnalysisTodoReview=openAnalysisTodoReview;
window.renderAnalysisTodoReview=renderAnalysisTodoReview;
window.openDashboardTodoTab=openDashboardTodoTab;
window.openAnalysisRiskReview=openAnalysisRiskReview;
window.renderAnalysisRiskReview=renderAnalysisRiskReview;
window.requestCloseAnalysisRiskModal=requestCloseAnalysisRiskModal;
window.setAllAnalysisRiskChecked=setAllAnalysisRiskChecked;
window.confirmCloseAnalysisRiskModal=confirmCloseAnalysisRiskModal;
window.moveCheckedAnalysisRisksToConfirmed=moveCheckedAnalysisRisksToConfirmed;
window.deleteCheckedAnalysisRisks=deleteCheckedAnalysisRisks;
// ════════════════════════════════════════════════
// 흐름 2 — Todo 승인/반려
// ════════════════════════════════════════════════
function getFilteredTodos(){
  const statuses={ai:'pending',inprogress:'approved',rejected:'rejected',done:'done'};
  const query=normalizeText(G.todoSearch?.[G.currentTodoTab]||'').toLowerCase().trim();
  const field=G.todoSearchField?.[G.currentTodoTab]||'all';
  return todos.filter(t=>t.status===statuses[G.currentTodoTab])
    .filter(t=>{
      if(!query)return true;
      const values={title:t.title||'',description:t.description||'',assignee:todoAssigneeLabel(t),all:`${t.title||''} ${t.description||''} ${todoAssigneeLabel(t)}`};
      return String(values[field]||values.all).toLowerCase().includes(query);
    })
    .sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))||b.id-a.id);
}
function todoPageItems(list){const page=Math.max(1,G.todoPage?.[G.currentTodoTab]||1);return list.slice((page-1)*12,page*12);}
function formatTodoCreatedAt(value){return value?String(value).slice(0,10):'-';}
function updateTodoDateColumns(){
  const created=document.getElementById('todoCreatedHeader');const updated=document.getElementById('todoUpdatedHeader');
  if(created)created.style.display=G.currentTodoTab==='ai'?'none':'table-cell';
  if(updated)updated.style.display=G.currentTodoTab==='inprogress'?'table-cell':'none';
}
function setTodoSearch(value){G.todoSearch[G.currentTodoTab]=value;G.todoPage[G.currentTodoTab]=1;renderTodos();}
function setTodoSearchField(value){G.todoSearchField[G.currentTodoTab]=value;G.todoPage[G.currentTodoTab]=1;renderTodos();}
function setTodoPage(page){G.todoPage[G.currentTodoTab]=page;renderTodos();}
function renderTodoPager(total){
  const pager=document.getElementById('todoPager');if(!pager)return;
  const pages=Math.max(1,Math.ceil(total/12));const page=Math.min(G.todoPage[G.currentTodoTab]||1,pages);G.todoPage[G.currentTodoTab]=page;
  pager.innerHTML=pages<=1?'':Array.from({length:pages},(_,i)=>`<button class="todo-page-btn ${page===i+1?'active':''}" onclick="setTodoPage(${i+1})">${i+1}</button>`).join('');
}

function cleanTodoTitle(title){return normalizeText(title||'').replace(/^\s*\[[^\]]+\]\s*/,'').trim()||'Untitled';}
function briefTodoText(t){const raw=normalizeText(t.description||'').replace(/\s+/g,' ').trim();const base=raw||`${cleanTodoTitle(t.title)} 관련 업무 진행 및 결과 확인`;return base.length>72?base.slice(0,69)+'...':base;}
function todoAssigneeLabel(t){return t.assignee||(t.status==='pending'?t.recommendedAssignee:null)||'미지정';}

function renderTodos() {
  const list = getFilteredTodos();
  const pageList = todoPageItems(list);
  const body = document.getElementById('todoBody');
  const empty = document.getElementById('todoEmpty');
  const search=document.getElementById('todoSearchInput');if(search&&search.value!==G.todoSearch[G.currentTodoTab])search.value=G.todoSearch[G.currentTodoTab]||'';
  const field=document.getElementById('todoSearchField');if(field&&field.value!==G.todoSearchField[G.currentTodoTab])field.value=G.todoSearchField[G.currentTodoTab]||'all';
  updateTodoDateColumns();
  renderTodoPager(list.length);
  if (!list.length){body.innerHTML='';empty.style.display='block';updateTodoCounts();return;}
  empty.style.display='none';
  body.innerHTML = pageList.map(t=>{
    const title=cleanTodoTitle(t.title);
    const brief=briefTodoText(t);
    const assignee=todoAssigneeLabel(t);
    return `<tr class="todo-tr ${G.selectedTodoId===t.id?'selected':''} ${t.status}" onclick="toggleTodoRow(event,${t.id})">
      <td class="todo-check-cell"><input type="checkbox" class="row-chk" id="chk-${t.id}" ${G.todoChecked[t.id]?'checked':''} onclick="event.stopPropagation();toggleTodoCheck(event,${t.id},true)" style="accent-color:var(--accent);cursor:pointer"></td>
      <td class="todo-main-cell"><div class="todo-title ${t.status==='rejected'?'done-text':''} text-content" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span>${escapeHtml(title)}</span>${t.status==='pending'&&!t.assignee&&t.recommendedAssignee?`<span class="badge b-accent" title="${escapeHtml(t.recommendationReason||'업무 내용 기반 추천')}"><i class="ti ti-sparkles"></i> 추천: ${escapeHtml(t.recommendedAssignee)}</span>`:''}</div><div class="todo-src text-content">[담당자: ${escapeHtml(assignee)}] ${escapeHtml(brief)}</div></td>
      <td class="todo-center-cell todo-created-at" style="display:${G.currentTodoTab==='ai'?'none':'table-cell'}">${formatTodoCreatedAt(t.createdAt)}</td>
      <td class="todo-center-cell todo-created-at" style="display:${G.currentTodoTab==='inprogress'?'table-cell':'none'}">${formatTodoCreatedAt(t.updatedAt)}</td>
      <td class="todo-center-cell">${statusB(t.status)}</td>
      <td class="todo-action-cell">${actionB(t)}</td>
    </tr>`;
  }).join('');
  updateTodoCounts();
}

function priB(p){return{high:'<span class="badge b-danger" style="white-space:nowrap">높음</span>',medium:'<span class="badge b-warn" style="white-space:nowrap">중간</span>',low:'<span class="badge b-gray" style="white-space:nowrap">낮음</span>'}[p]||''}
function statusB(s){return{pending:'<span class="badge b-warn" style="white-space:nowrap">승인 대기</span>',approved:'<span class="badge b-accent" style="white-space:nowrap">진행중</span>',done:'<span class="badge b-success" style="white-space:nowrap">완료</span>',rejected:'<span class="badge b-gray" style="white-space:nowrap">반려됨</span>'}[s]||''}
function confC(c){if(c===null)return'var(--text3)';if(c>=85)return'var(--success)';if(c>=70)return'var(--warn)';return'var(--danger)';}
function actionB(t){
  if(t.status==='pending')return`<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-approve" onclick="approveTodo(${t.id})">승인</div><div class="ab ab-edit" onclick="openEditModal(${t.id})">수정</div><div class="ab ab-reject" onclick="rejectTodo(${t.id})">반려</div></div>`;
  if(t.status==='approved')return`<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-approve" style="background:var(--success);border-color:var(--success)" onclick="doneTodo(${t.id})">완료</div><div class="ab ab-edit" onclick="openEditModal(${t.id})">수정</div><div class="ab ab-undo" onclick="undoTodo(${t.id})">↩</div></div>`;
  if(t.status==='rejected')return`<div class="action-btns" onclick="event.stopPropagation()"><div class="ab ab-undo" onclick="undoTodo(${t.id})">↩ 되돌리기</div></div>`;
  return '';
}

function toggleTodoRow(event, id) {
  if (event?.target?.closest('.action-btns, input, button, select, textarea, a')) return;
  toggleTodoCheck(event, id);
}

function toggleTodoCheck(event, id, fromCheckbox = false) {
  if (event?.target?.closest('.action-btns')) return;
  const chk = document.getElementById('chk-' + id);
  G.todoChecked[id] = fromCheckbox && chk ? chk.checked : !G.todoChecked[id];
  if (chk) chk.checked = G.todoChecked[id];
  if (fromCheckbox) event.stopPropagation();
}

function selectTodo(id){G.selectedTodoId=id;renderTodos();renderTodoDetail(id);}
function renderTodoDetail(id){
  const t=todos.find(x=>x.id===id);if(!t)return;
  document.getElementById('todoDetailEmpty').style.display='none';
  const dc=document.getElementById('todoDetailContent');
  dc.style.display='flex';dc.style.flexDirection='column';
  dc.innerHTML=`<div style="padding:14px;flex:1;overflow-y:auto">
    <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:12px;line-height:1.5">${escapeHtml(cleanTodoTitle(t.title))}</div>
    <div class="detail-grid">
      <div class="detail-cell"><div class="detail-label">우선순위</div>${priB(t.priority)}</div>
      <div class="detail-cell"><div class="detail-label">상태</div>${statusB(t.status)}</div>
      <div class="detail-cell"><div class="detail-label">담당자</div><div style="font-size:11px;font-weight:500;color:var(--text)">${t.assignee||'미지정'}</div>${t.status==='pending'&&!t.assignee&&t.recommendedAssignee?`<div style="font-size:10px;color:var(--accent);margin-top:4px"><i class="ti ti-sparkles"></i> 승인 시 ${escapeHtml(t.recommendedAssignee)} 배정</div>`:''}</div>
    </div>
    ${t.chunk?`<div class="detail-section">출처 청크 원문</div><div class="chunk-box"><div class="chunk-meta"><i class="ti ti-file-text" style="font-size:11px;color:var(--accent)"></i>${t.src} · ${t.srcChunk}</div>${t.chunk}</div>`:''}
    <div class="detail-section">AI 분석 근거</div>
    ${t.grounds.map(g=>`<div class="detail-item"><i class="ti ti-point"></i>${g}</div>`).join('')}
    ${t.status==='pending'&&!t.assignee&&t.recommendedAssignee?`<div class="detail-section">AI 추천 담당자</div><div class="detail-item"><i class="ti ti-user-check"></i><strong>${escapeHtml(t.recommendedAssignee)}</strong> · ${escapeHtml(t.recommendationReason||'업무 내용 기반 추천')}</div>`:''}${t.risk?`<div class="detail-section">왜 위험한가</div><div class="risk-box">${t.risk}</div>`:''}
  </div>
  <div style="padding:12px 14px;border-top:1px solid var(--border);display:flex;gap:5px">
    ${t.status==='pending'?`<div class="tbtn primary" style="flex:1;justify-content:center;background:var(--success);border-color:var(--success)" onclick="approveTodo(${t.id})">승인</div><div class="tbtn" style="flex:1;justify-content:center" onclick="openEditModal(${t.id})">수정</div><div class="tbtn" style="flex:1;justify-content:center;color:var(--danger)" onclick="rejectTodo(${t.id})">반려</div>`:
    t.status==='approved'?`<div class="tbtn primary" style="flex:1;justify-content:center;background:var(--success);border-color:var(--success)" onclick="doneTodo(${t.id})">완료</div><div class="tbtn" style="flex:1;justify-content:center" onclick="openEditModal(${t.id})">수정</div><div class="tbtn" style="flex:1;justify-content:center" onclick="undoTodo(${t.id})">↩ 되돌리기</div>`:
    `<div class="tbtn" style="flex:1;justify-content:center" onclick="undoTodo(${t.id})">↩ 되돌리기</div>`}
  </div>`;
}

function approveTodo(id){
  const t=todos.find(x=>x.id===id);
  if(!t.assignee&&t.recommendedAssignee)t.assignee=t.recommendedAssignee;
  t.status='approved';
  showToast(`✅ "${t.title.slice(0,20)}..." 승인되었습니다.`,'success');
  addNotif(`"${t.title.slice(0,24)}..." Todo가 승인되었습니다.`, 'success');
  afterTodoAction(id);
}
function rejectTodo(id){const t=todos.find(x=>x.id===id);t.status='rejected';showToast('반려 처리되었습니다.','warn');afterTodoAction(id);}
function doneTodo(id){const t=todos.find(x=>x.id===id);t.status='done';showToast(`🎉 완료 처리되었습니다.`,'success');afterTodoAction(id);}
function undoTodo(id){const t=todos.find(x=>x.id===id);t.status='pending';showToast('승인 대기로 되돌렸습니다.','info');afterTodoAction(id);}
function afterTodoAction(id){renderTodos();if(G.selectedTodoId===id)renderTodoDetail(id);updateTodoCounts();}
function checkedTodoIds(){return Object.keys(G.todoChecked).filter(id=>G.todoChecked[id]).map(Number);}
function clearTodoChecks(ids){(ids||Object.keys(G.todoChecked)).forEach(id=>{G.todoChecked[id]=false;});const chkAll=document.getElementById('chkAll');if(chkAll)chkAll.checked=false;}
function bulkApprove(){const checkedIds=checkedTodoIds();const targets=todos.filter(t=>t.status==='pending'&&checkedIds.includes(t.id));if(!targets.length){showToast('체크된 AI 제안 Todo가 없습니다.','info');return;}targets.forEach(t=>{if(!t.assignee&&t.recommendedAssignee)t.assignee=t.recommendedAssignee;t.status='approved';});clearTodoChecks(checkedIds);showToast(`✅ ${targets.length}건 체크항목 승인되었습니다.`,'success');renderTodos();updateTodoCounts();}
function bulkReject(){const checkedIds=checkedTodoIds();const targets=todos.filter(t=>t.status==='pending'&&checkedIds.includes(t.id));if(!targets.length){showToast('체크된 AI 제안 Todo가 없습니다.','info');return;}targets.forEach(t=>{t.status='rejected';});clearTodoChecks(checkedIds);showToast(`${targets.length}건 체크항목 반려되었습니다.`,'warn');renderTodos();updateTodoCounts();}
function bulkUndoApprove(){const checkedIds=checkedTodoIds();const targets=todos.filter(t=>t.status==='approved'&&checkedIds.includes(t.id));if(!targets.length){showToast('체크된 진행 Todo가 없습니다.','info');return;}targets.forEach(t=>{t.status='pending';t.assignee=null;});clearTodoChecks(checkedIds);showToast(`↩ ${targets.length}건 체크항목 되돌리기 완료`,'info');renderTodos();updateTodoCounts();}
function toggleAllChk(el){document.querySelectorAll('.row-chk').forEach(c=>{c.checked=el.checked; const id=String(c.id||'').replace('chk-',''); if(id) G.todoChecked[id]=el.checked;});}
function updateTodoCounts(){
  const ai=todos.filter(t=>t.status==='pending').length;
  const ip=todos.filter(t=>t.status==='approved').length;
  const dn=todos.filter(t=>t.status==='done').length;
  const rj=todos.filter(t=>t.status==='rejected').length;
  document.getElementById('t-ai-cnt').textContent=ai;
  document.getElementById('t-in-cnt').textContent=ip;
  document.getElementById('t-done-cnt').textContent=dn;
  const rej=document.getElementById('t-rej-cnt');if(rej)rej.textContent=rj;
  document.getElementById('pendingCount').textContent=ai;
  ['t-ai-cnt','t-in-cnt','t-done-cnt','t-rej-cnt'].forEach((id)=>{const el=document.getElementById(id);if(!el)return;el.className=(id==='t-ai-cnt'&&ai>0)?'badge b-warn':'badge b-gray';});
}
function switchTodoTab(tab){G.currentTodoTab=tab;G.todoPage[tab]=1;G.selectedTodoId=null;document.getElementById('todoDetailEmpty').style.display='flex';document.getElementById('todoDetailContent').style.display='none';document.querySelectorAll('#s-todo .tab').forEach((el,i)=>{el.classList.toggle('active',['inprogress','ai','done','rejected'][i]===tab);});const notice=document.getElementById('todoAINotice');const isAi=tab==='ai';const isProgress=tab==='inprogress';notice.style.display=(isAi||isProgress)?'flex':'none';document.getElementById('todoNoticeIcon').className=isAi?'ti ti-sparkles':'ti ti-rotate-2';document.getElementById('todoNoticeText').textContent=isAi?'AI가 추출한 Todo 제안입니다. 검토 후 승인 또는 반려해주세요.':'체크한 진행 Todo를 AI 제안으로 되돌릴 수 있습니다.';document.getElementById('todoBulkApproveBtn').style.display=isAi?'flex':'none';document.getElementById('todoBulkRejectBtn').style.display=isAi?'flex':'none';document.getElementById('todoBulkUndoBtn').style.display=isProgress?'flex':'none';renderTodos();}
function openEditModal(id){G.editTargetId=id;const t=todos.find(x=>x.id===id);document.getElementById('editTitle').value=cleanTodoTitle(t.title);document.getElementById('editDescription').value=briefTodoText(t);document.getElementById('editAssignee').value=t.assignee||t.recommendedAssignee||((window.opsRadarMembers||[])[0]?.name)||'이성우';document.getElementById('editModal').classList.add('show');}
function saveEdit(){const t=todos.find(x=>x.id===G.editTargetId);t.title=document.getElementById('editTitle').value.trim();t.description=document.getElementById('editDescription').value.trim();t.assignee=document.getElementById('editAssignee').value;closeModal('editModal');renderTodos();if(G.selectedTodoId===G.editTargetId)renderTodoDetail(G.editTargetId);showToast('수정되었습니다.','info');}
function openManualModal(){document.getElementById('manualModal').classList.add('show');}
async function saveManual(){
  const title=document.getElementById('manualTitle').value.trim();
  if(!title)return;
  if(!window.opsRadarApi){showToast('DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.','warn');return;}
  try{
    await window.opsRadarApi.request('/todos',{
      method:'POST',
      body:JSON.stringify({
        title,
        assignee:document.getElementById('manualAssignee').value||null,
        priority:document.getElementById('manualPriority').value||'medium',
        source:'manual',
        status:'pending'
      })
    });
    closeModal('manualModal');
    document.getElementById('manualTitle').value='';
    if(G.currentTodoTab!=='ai')switchTodoTab('ai');
    await window.opsRadarApi.loadTodos();
    showToast('Todo가 DB에 등록되었습니다.','success');
  }catch(error){
    console.warn('Todo create API failed',error);
    showToast('Todo 등록에 실패했습니다.','warn');
  }
}

// ════════════════════════════════════════════════
// 흐름 3 — 이슈 → 대응 Todo 생성
// ════════════════════════════════════════════════
function switchIssueTab(tab){G.currentIssueTab=tab;G.selectedIssueId=null;hideIssueDetail();document.querySelectorAll('#s-issues .tab').forEach((el,i)=>el.classList.toggle('active',['inprogress','candidate'][i]===tab));renderIssues();}
function renderIssues(){
  const list=G.currentIssueTab==='inprogress'
    ?issues.filter(i=>i.type==='confirmed'||i.type==='resolved')
    :issues.filter(i=>i.type===G.currentIssueTab);
  const el=document.getElementById('issueList');
  if(!list.length){el.innerHTML=`<div style="padding:40px;text-align:center;color:var(--text3);font-size:12px"><i class="ti ti-check" style="font-size:28px;display:block;margin-bottom:8px"></i>이 탭에 항목이 없습니다.</div>`;return;}
  el.innerHTML=list.map(issue=>{
    const hasTodo=G.createdTodosFromIssue.some(t=>t.issueId===issue.id);
    const isCandidate=issue.type==='candidate';
    const issueIdArg = JSON.stringify(issue.id);
    return `<div class="issue-card ${G.selectedIssueId===issue.id?'selected':''} ${isCandidate?'candidate':''}" onclick="selectIssue(${issueIdArg})">
      <div class="issue-hd">
        ${isCandidate?`<span class="badge b-warn">후보</span><span style="font-size:10px;font-family:var(--mono);color:var(--warn);font-weight:500">${issue.confidence}%</span>`:`<span class="badge ${issue.severity==='high'?'b-danger':issue.severity==='medium'?'b-warn':'b-gray'}">${issue.severity==='high'?'High':'Medium'}</span>`}
        <div class="issue-title">${issue.title}</div>
        ${issue.status==='in_progress'?'<span class="badge b-warn">In Progress</span>':issue.status==='open'?'<span class="badge b-gray">Open</span>':'<span class="badge b-success">Resolved</span>'}
        ${hasTodo?'<span class="badge b-success" style="font-size:9px">Todo 생성됨</span>':''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
        <span class="badge b-gray">${issue.src||'자동 감지'}</span>
        ${issue.days>0?`<span class="badge b-gray">${issue.days}일째</span>`:''}
        ${issue.assignee?`<span class="badge b-gray">담당: ${issue.assignee}</span>`:'<span class="badge b-danger" style="font-size:9px">담당자 미지정</span>'}
      </div>
      <div class="issue-desc">${issue.desc}</div>
      <div class="issue-footer">
        <div style="font-size:10px;color:var(--text3)">AI 자동 탐지</div>
        <div style="display:flex;gap:5px">
          ${isCandidate?`<div class="tbtn primary" style="font-size:10px;padding:4px 8px;background:var(--danger);border-color:var(--danger)" onclick="event.stopPropagation();openConfirmIssue(${issueIdArg})">이슈 확정</div><div class="tbtn" style="font-size:10px;padding:4px 8px;color:var(--text3)" onclick="event.stopPropagation();doRemoveIssue(${issueIdArg})">무시</div>`:
          issue.type==='resolved'?'':
          `<div class="tbtn" style="font-size:10px;padding:4px 8px" onclick="event.stopPropagation();openTodoCreate(${issueIdArg})"><i class="ti ti-plus"></i> 대응 Todo 생성</div>`}
        </div>
      </div>
    </div>`;
  }).join('');
  const progCnt=document.getElementById('i-prog-cnt');if(progCnt)progCnt.textContent=issues.filter(i=>i.type==='confirmed'||i.type==='resolved').length;
  const candCnt=document.getElementById('i-cand-cnt');if(candCnt)candCnt.textContent=issues.filter(i=>i.type==='candidate').length;
  const pendingCnt=document.getElementById('i-pending-cnt');if(pendingCnt)pendingCnt.textContent=issues.filter(i=>i.type==='candidate').length;
}

function selectIssue(id){G.selectedIssueId=id;renderIssues();renderIssueDetail(id);}
function renderIssueDetail(id){
  const issue=issues.find(i=>i.id===id);if(!issue)return;
  document.getElementById('issueDetailEmpty').style.display='none';
  const dc=document.getElementById('issueDetailContent');
  dc.style.display='block';dc.className='fade-up';
  const hasTodo=G.createdTodosFromIssue.some(t=>t.issueId===id);
  dc.innerHTML=`
    <div style="font-size:12px;font-weight:500;color:var(--text);margin-bottom:10px;line-height:1.5">${issue.title}</div>
    ${issue.chunk?`<div class="detail-section">출처 청크</div><div class="chunk-box"><div class="chunk-meta"><i class="ti ti-file-text" style="font-size:11px;color:var(--accent)"></i>${issue.src}</div>${issue.chunk}</div>`:''}
    ${issue.domino.length?`<div class="detail-section">도미노 영향</div><div class="domino"><div class="domino-lbl">왜 위험한가</div>${issue.domino.map(d=>`<div>→ ${d}</div>`).join('')}<div class="domino-final" style="margin-top:4px">→ ${issue.dominoFinal}</div></div>`:''}
    ${issue.history.length?`<div class="detail-section">상태 변화 이력</div>${issue.history.map(h=>`<div class="history-row"><div class="history-date">${h.date}</div><span class="badge ${h.s==='Open'?'b-gray':h.s==='Resolved'?'b-success':'b-warn'}">${h.s}</span><div class="${h.cls}" style="flex:1;font-size:10px;color:${h.cls?'inherit':'var(--text3)'}">${h.note}</div></div>`).join('')}`:''}
    ${hasTodo?`<div class="detail-section">생성된 대응 Todo</div>${G.createdTodosFromIssue.filter(t=>t.issueId===id).map(t=>`<div style="background:var(--success-soft);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px;color:var(--success);display:flex;align-items:center;gap:6px;margin-bottom:4px"><i class="ti ti-checkbox" style="font-size:12px"></i>${escapeHtml(cleanTodoTitle(t.title))}</div>`).join('')}`:''}`;
  const actions=document.getElementById('issueDetailActions');
  actions.style.display='flex';
  if(issue.type==='confirmed'&&issue.status!=='resolved'){
    actions.innerHTML=`<div class="tbtn primary" onclick="openTodoCreate(${id})" style="justify-content:center"><i class="ti ti-plus"></i> 대응 Todo 생성</div><div style="display:flex;gap:5px;margin-top:4px"><div class="tbtn" style="flex:1;justify-content:center;color:var(--success)" onclick="resolveIssue(${id})"><i class="ti ti-check"></i> 해결 완료</div><div class="tbtn" style="flex:1;justify-content:center;color:var(--warn)" onclick="revertIssue(${id})">↩ 되돌리기</div></div>`;
  } else if(issue.type==='candidate'){
    actions.innerHTML=`<div class="tbtn primary" onclick="openConfirmIssue(${id})" style="justify-content:center;background:var(--danger);border-color:var(--danger)"><i class="ti ti-alert-triangle"></i> 이슈 확정</div><div class="tbtn" onclick="doRemoveIssue(${id})" style="justify-content:center;color:var(--text3);margin-top:4px">무시</div>`;
  } else { actions.style.display='none'; }
}

function hideIssueDetail(){document.getElementById('issueDetailEmpty').style.display='flex';document.getElementById('issueDetailContent').style.display='none';document.getElementById('issueDetailActions').style.display='none';}

function openTodoCreate(issueId){
  G.createIssueId=issueId;
  const issue=issues.find(i=>i.id===issueId);
  document.getElementById('tcModalSub').textContent=`이슈: ${issue.title.slice(0,40)}...`;
  document.getElementById('tcModalFrom').textContent=`이 Todo는 "${issue.title.slice(0,30)}..." 이슈와 연결됩니다.`;
  document.getElementById('tcTitle').value=issue.suggestTodo||'';
  document.getElementById('tcDescription').value=`${issue.title} 대응을 위한 원인 확인 및 조치 결과 공유`;
  document.getElementById('tcAssignee').value=issue.suggestAssignee||((window.opsRadarMembers||[])[0]?.name)||'이성우';
  document.getElementById('tcPriority').value=issue.suggestPriority||'high';
  document.getElementById('tcDue').value=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  document.getElementById('todoCreateModal').classList.add('show');
}

async function confirmTodoCreate(){
  const title=document.getElementById('tcTitle').value.trim();
  if(!title)return;
  const description=document.getElementById('tcDescription').value.trim();
  const assignee=document.getElementById('tcAssignee').value;
  const priority=document.getElementById('tcPriority').value;
  const due=document.getElementById('tcDue').value;
  closeModal('todoCreateModal');
  showTransition('이슈 기반 대응 Todo를 생성하고 있습니다');
  setTimeout(async ()=>{
    try{
      const issue=issues.find(i=>i.id===G.createIssueId);
      const apiIssueId=getIssueApiId(issue);
      if(apiIssueId){
        await requestApi(`/issues/${apiIssueId}/todos`, {
          method:'POST',
          body:JSON.stringify({title,description,assignee,priority,due_at:due||null,status:'in_progress',approval_status:'approved'})
        });
        if(window.opsRadarApi)await window.opsRadarApi.reload();
      }else{
        todos.unshift({id:Date.now()+1,title,description,src:`이슈 #${G.createIssueId}`,srcChunk:'이슈 연결',assignee,priority,confidence:null,status:'approved',type:'manual',chunk:null,grounds:['이슈 기반 생성'],risk:''});
      }
      G.createdTodosFromIssue.push({id:Date.now(),issueId:G.createIssueId,title,description,assignee,priority,dueDate:due,status:'approved'});
      document.getElementById('todoFromIssueBanner').style.display='inline-flex';
      document.getElementById('todoBadge').style.display='inline-block';
      renderIssues();
      if(G.selectedIssueId===G.createIssueId)renderIssueDetail(G.createIssueId);
      nav('todo');switchTodoTab('inprogress');
      showToast(`"${title.slice(0,20)}..." Todo가 생성되었습니다.`,'success');
      addNotif(`이슈 기반 대응 Todo "${title.slice(0,20)}..."가 생성되었습니다.`, 'success');
      showCtxBanner('todo', `이슈 #${G.createIssueId}에서 생성된 Todo가 최상단에 추가되었습니다.`);
      updateTodoCounts();
    }catch(e){
      alert('Todo 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }finally{
      hideTransition();
    }
  },1200);
}

function getIssueApiId(issue){
  if(!issue)return null;
  if(issue.apiId)return issue.apiId;
  return typeof issue.id==='string'&&/^[0-9a-f-]{36}$/i.test(issue.id)?issue.id:null;
}
async function resolveIssue(id){const issue=issues.find(i=>i.id===id);const apiId=getIssueApiId(issue);if(apiId){try{await requestApi(`/issues/${apiId}/resolve`,{method:'PATCH'});}catch(e){showToast('이슈 저장에 실패했습니다.','warn');return;}}issue.status='resolved';issue.type='resolved';renderIssues();hideIssueDetail();showToast('이슈가 해결 완료 처리되었습니다.','success');}
async function revertIssue(id){const issue=issues.find(i=>i.id===id);if(!issue)return;const apiId=getIssueApiId(issue);if(apiId){try{await requestApi(`/issues/${apiId}`,{method:'PATCH',body:JSON.stringify({approval_status:'pending',status:'open'})});}catch(e){showToast('이슈 저장에 실패했습니다.','warn');return;}}issue.type='candidate';issue.status='open';issue.approvalStatus='pending';renderIssues();hideIssueDetail();switchIssueTab('candidate');showToast('이슈가 승인 대기로 되돌려졌습니다.','info');}
function openConfirmIssue(id){G.confirmIssueId=id;const issue=issues.find(i=>i.id===id);document.getElementById('confirmIssueText').textContent=`"${issue.title}"을 확정 이슈로 전환합니다. 대응 Todo를 생성할 수 있습니다.`;document.getElementById('confirmIssueModal').classList.add('show');}

async function doConfirmIssue(){const issue=issues.find(i=>i.id===G.confirmIssueId);if(issue){const apiId=getIssueApiId(issue);if(apiId){try{await requestApi(`/issues/${apiId}`,{method:'PATCH',body:JSON.stringify({approval_status:'approved'})});}catch(e){showToast('이슈 저장에 실패했습니다.','warn');return;}}issue.type='confirmed';closeModal('confirmIssueModal');switchIssueTab('inprogress');showToast('이슈가 확정되었습니다.','warn');}}
async function dismissIssue(){await doRemoveIssue(G.confirmIssueId);closeModal('confirmIssueModal');}
async function doRemoveIssue(id){const idx=issues.findIndex(i=>i.id===id);const issue=idx===-1?null:issues[idx];const apiId=getIssueApiId(issue);if(apiId){try{await requestApi(`/issues/${apiId}`,{method:'PATCH',body:JSON.stringify({approval_status:'rejected'})});}catch(e){showToast('이슈 저장에 실패했습니다.','warn');return;}}if(idx!==-1)issues.splice(idx,1);renderIssues();hideIssueDetail();showToast('이슈 후보가 무시되었습니다.','info');}

function persistIssues(){
  try{ localStorage.setItem('opsradar_issues', JSON.stringify(issues)); }catch(e){}
}
function normalizeIssueStatus(status){
  if(status === 'blocked') return 'in_progress';
  if(status === 'resolved') return 'resolved';
  if(status === 'in_progress') return 'in_progress';
  return 'open';
}
function toIssueModel(data){
  const now = new Date();
  return {
    id: data.id || Date.now(),
    title: normalizeText(data.title || '제목 없는 이슈'),
    desc: normalizeText(data.description || data.desc || ''),
    severity: data.severity || 'high',
    status: normalizeIssueStatus(data.status),
    type: data.status === 'resolved' ? 'resolved' : 'confirmed',
    assignee: normalizeText(data.assignee || ''),
    src: normalizeText(data.source_document || data.src || '수동 등록'),
    days: data.days || 0,
    confidence: data.confidence || 100,
    chunk: data.source_document ? `관련 문서: ${escapeHtml(data.source_document)}` : '',
    domino: normalizeText(data.domino_impact || data.dominoImpact || '').split(/\n|→/).map(v=>v.trim()).filter(Boolean),
    dominoFinal: normalizeText(data.domino_impact || data.dominoImpact || '운영 영향 분석 대기'),
    history: [{ date: now.toLocaleDateString('ko-KR'), s: 'Open', note: '수동 등록', cls: '' }],
    suggestTodo: `${normalizeText(data.title || '이슈')} 대응 Todo`,
    suggestAssignee: normalizeText(data.assignee || ((window.opsRadarMembers||[])[0]?.name) || '이성우'),
    suggestPriority: data.severity === 'low' ? 'low' : data.severity === 'medium' ? 'medium' : 'high'
  };
}
async function createIssue(issueData){
  const body = {
    title: normalizeText(issueData.title),
    description: normalizeText(issueData.description),
    severity: issueData.severity,
    status: issueData.status,
    assignee: normalizeText(issueData.assignee),
    domino_impact: normalizeText(issueData.domino_impact),
    source_document: normalizeText(issueData.source_document)
  };
  try{
    const saved = await requestApi('/issues', {
      method:'POST',
      body: JSON.stringify(body)
    });
    return toIssueModel({...body, ...saved});
  }catch(e){
    throw e;
  }
}
async function fetchIssues(){
  try{
    const data = await requestApi('/issues');
    const list = Array.isArray(data) ? data : (data.issues || data.items || data.results || []);
    issues.splice(0, issues.length, ...list.map(toIssueModel));
    persistIssues();
    return issues;
  }catch(e){}
  try{
    const saved = JSON.parse(localStorage.getItem('opsradar_issues') || '[]');
    if(Array.isArray(saved) && saved.length) issues.splice(0, issues.length, ...saved.map(toIssueModel));
  }catch(e){}
  return issues;
}
function fetchDashboard(){
  updateIssueDashboard();
}
function updateIssueDashboard(){
  const confirmed = issues.filter(i => i.type === 'confirmed');
  const high = confirmed.filter(i => i.severity === 'high' && i.status !== 'resolved');
  const issueCount = document.getElementById('issueCount');
  if(issueCount) issueCount.textContent = String(high.length);
  const cards = Array.from(document.querySelectorAll('#db-admin-view .ops-risk-card'));
  high.slice(0,3).forEach((issue, idx) => {
    const card = cards[idx];
    if(!card) return;
    const title = card.querySelector('h3');
    const desc = card.querySelector('p');
    const badge = card.querySelector('.badge');
    const meta = card.querySelector('.ops-risk-meta');
    const domino = card.querySelector('.ops-domino span');
    const detailBtn = Array.from(card.querySelectorAll('button')).find(btn => btn.textContent.includes('상세 보기'));
    if(title) title.textContent = issue.title;
    if(desc) desc.textContent = issue.desc || '설명이 없습니다.';
    if(badge){ badge.textContent = issue.severity === 'high' ? 'HIGH' : issue.severity.toUpperCase(); badge.className = issue.severity === 'high' ? 'badge b-danger' : issue.severity === 'medium' ? 'badge b-warn' : 'badge b-gray'; }
    if(meta) meta.innerHTML = `<span>${issue.status}</span><span>${issue.days || 0}일 경과</span>`;
    if(domino) domino.textContent = issue.dominoFinal || '도미노 영향 분석 대기';
    if(detailBtn) detailBtn.setAttribute('onclick', `openIssueDetail('manual-${issue.id}')`);
    ISSUE_DETAIL_MOCK[`manual-${issue.id}`] = {
      id:`manual-${issue.id}`,
      title:issue.title,
      severity:issue.severity.toUpperCase(),
      status:issue.status,
      elapsed:`${issue.days || 0}일`,
      assignee:issue.assignee || '미지정',
      reason:issue.desc || '수동 등록된 이슈입니다.',
      dominoImpact:issue.dominoFinal || '도미노 영향 분석 대기',
      relatedTodos:[issue.suggestTodo || `${issue.title} 대응 Todo`],
      relatedDocs:[issue.src || '수동 등록'],
      actions:['대응 Todo 생성','담당자 지정','상태 변경']
    };
  });
}
function openIssueCreateModal(){
  const modal = document.getElementById('issueCreateModal');
  if(!modal) return;
  ['issueTitle','issueDescription','issueAssignee','issueSourceDocument','issueDominoImpact'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const sev = document.getElementById('issueSeverity'); if(sev) sev.value='high';
  const st = document.getElementById('issueStatus'); if(st) st.value='open';
  modal.classList.add('show');
  setTimeout(()=>document.getElementById('issueTitle')?.focus(), 0);
}
function closeIssueCreateModal(){ closeModal('issueCreateModal'); }
async function saveIssueCreate(){
  const title = document.getElementById('issueTitle')?.value.trim();
  if(!title){ alert('이슈 제목을 입력해주세요.'); return; }
  const payload = {
    title,
    description: document.getElementById('issueDescription')?.value.trim() || '',
    severity: document.getElementById('issueSeverity')?.value || 'high',
    status: document.getElementById('issueStatus')?.value || 'open',
    assignee: document.getElementById('issueAssignee')?.value.trim() || '',
    domino_impact: document.getElementById('issueDominoImpact')?.value.trim() || '',
    source_document: document.getElementById('issueSourceDocument')?.value.trim() || ''
  };
  try{
    const issue = await createIssue(payload);
    issues.unshift(issue);
    persistIssues();
    closeIssueCreateModal();
    G.currentIssueTab = issue.type === 'candidate' ? 'candidate' : 'inprogress';
    document.querySelectorAll('#s-issues .tab').forEach((el,i)=>el.classList.toggle('active',['inprogress','candidate'][i]===G.currentIssueTab));
    renderIssues();
    fetchDashboard();
    showToast('이슈가 등록되었습니다.', 'success');
  }catch(e){
    alert('이슈 등록에 실패했습니다. 입력값을 확인해주세요.');
  }
}
window.createIssue = createIssue;
window.openIssueCreateModal = openIssueCreateModal;
window.closeIssueCreateModal = closeIssueCreateModal;
window.saveIssueCreate = saveIssueCreate;
window.fetchIssues = fetchIssues;
window.fetchDashboard = fetchDashboard;
setTimeout(async () => { await fetchIssues(); renderIssues(); fetchDashboard(); }, 0);

// ════════════════════════════════════════════════
// 캘린더
// ════════════════════════════════════════════════
function renderCalendar(){
  const grid=document.getElementById('calGrid');
  grid.querySelectorAll('.cal-cell').forEach(c=>c.remove());
  [27,28,29,30].forEach(d=>{const div=document.createElement('div');div.className='cal-cell other';div.innerHTML=`<div class="cal-date">${d}</div>`;grid.appendChild(div);});
  for(let d=1;d<=31;d++){
    const ev=G.calEvents.find(e=>e.d===d);
    const isNew=G.newCalEvents.some(e=>e.calDate===d);
    const isSelected=G.selectedCalDay===d;
    const div=document.createElement('div');
    div.className=`cal-cell${ev?.today?' today':''}${ev?.risk?' risk':''}${isNew?' new-event':''}${isSelected?' cal-selected':''}`;
    div.innerHTML=`<div class="cal-date">${d}</div><div class="cal-tags">${ev?ev.tags.map(t=>`<span class="cal-tag ${t.c}">${t.t}</span>`).join(''):''}</div>${ev?.risk?'<div class="risk-dot"></div>':''}`;
    div.addEventListener('click', ()=>openCalModal(d));
    grid.appendChild(div);
    if(d===31)for(let x=1;x<=4;x++){const e=document.createElement('div');e.className='cal-cell other';e.innerHTML=`<div class="cal-date">${x}</div>`;grid.appendChild(e);}
  }
}

function showCalBanner(){
  if(!G.newCalEvents.length)return;
  const last=G.newCalEvents[G.newCalEvents.length-1];
  const banner=document.getElementById('calEventBanner');
  document.getElementById('calBannerText').innerHTML=`<strong>${last.person} · ${last.date} · ${last.type}</strong>이 캘린더에 추가되었습니다.`;
  banner.style.display='flex';
  const badge=document.getElementById('calUpdatedBadge');badge.style.display='inline-flex';setTimeout(()=>badge.style.display='none',3000);
  const names=[...new Set(G.newCalEvents.map(e=>e.person))].join(', ');
  document.getElementById('calAIText').textContent=`5/22(금) 마감 4건 집중. ${names} 부재 일정 추가됨. AI 리스크 재계산 완료.`;
  G.newCalEvents.filter(e=>e.type!=='회의').forEach(e=>{const div=document.createElement('div');div.style.cssText='padding:6px 0;border-top:1px solid var(--border);font-size:11px';div.innerHTML=`<div style="font-size:10px;color:var(--success);font-family:var(--mono)">${e.date} ${e.person} ✦ 신규</div><div style="color:var(--text)">${e.type} — ${e.impact}</div>`;document.getElementById('calAbsenceList').appendChild(div);});
}

function registerCalEvent(parsed, calDate){
  if(calDate){const ex=G.calEvents.find(e=>e.d===calDate);const nt={t:`${parsed.person} ${parsed.type}`,c:'ct-new'};if(ex)ex.tags.push(nt);else G.calEvents.push({d:calDate,tags:[nt]});G.newCalEvents.push({...parsed,calDate});}
  document.getElementById('calBadge').style.display='inline-block';
  if(G.currentScreen==='calendar')renderCalendar();
}

function renderKnowledgeAbsence(){
  if(!G.newCalEvents.length)return;
  const list=document.getElementById('knowledgeAbsence');
  G.newCalEvents.filter(e=>e.type!=='회의').forEach(e=>{const div=document.createElement('div');div.style.cssText='background:var(--surface2);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px';div.innerHTML=`<div style="font-weight:500;color:var(--text);margin-bottom:2px">${e.person} <span style="font-size:9px;color:var(--success)">✦ 신규</span></div><div style="color:var(--text3);font-size:10px;font-family:var(--mono)">${e.date} ${e.type}</div><span class="badge b-warn" style="margin-top:4px;display:inline-block">${e.impact}</span>`;list.appendChild(div);});
}

function miniChat(text){
  const input=document.getElementById('miniInput');const msg=text||input.value.trim();if(!msg)return;input.value='';
  const log=document.getElementById('miniLog');
  const u=document.createElement('div');u.className='mini-bubble mini-bubble-user';u.textContent=msg;log.appendChild(u);log.scrollTop=log.scrollHeight;
  setTimeout(async ()=>{
    const parsed=parseScheduleMsg(msg);
    const reply=(msg.includes('부재')||msg.includes('외부 일정'))?`✅ ${parsed.person} ${parsed.date} ${parsed.type}을 캘린더에 등록했습니다.`:'✅ 일정을 캘린더에 추가했습니다.';
    const dateMatch=msg.match(/(\d+)\/(\d+)/);
    try{
      if(!dateMatch || !window.opsRadarCreateCalendarEvent || !window.opsRadarApi) throw new Error('Calendar API is not ready');
      const month=Number(dateMatch[1])-1;
      const day=Number(dateMatch[2]);
      await window.opsRadarCreateCalendarEvent({title:`${parsed.person} ${parsed.type}`,day,month,year:G.currentCalYear,color:parsed.type==='부재'?'ct-gray':'ct-info'});
      await window.opsRadarApi.loadCalendar();
      G.newCalEvents.push({...parsed,calDate:day,y:G.currentCalYear,m:month});
      renderCalendar(G.currentCalYear,G.currentCalMonth);
      const a=document.createElement('div');a.className='mini-bubble mini-bubble-ai';a.textContent=reply;log.appendChild(a);log.scrollTop=log.scrollHeight;
      showToast(reply);
    }catch(error){
      console.warn('Mini calendar create API failed',error);
      const a=document.createElement('div');a.className='mini-bubble mini-bubble-ai';a.textContent='일정 등록에 실패했습니다. DB 연결을 확인해주세요.';log.appendChild(a);log.scrollTop=log.scrollHeight;
      showToast('캘린더 등록에 실패했습니다.','warn');
    }
  },300);
}

function openCalModal(d) {
  G.selectedCalDay = d;
  renderCalendar();
  const ev = G.calEvents.find(e => e.d === d);
  const tags = ev ? ev.tags : [];
  document.getElementById('calModalDate').textContent = `5월 ${d}일`;
  const list = document.getElementById('calModalList');
  list.innerHTML = tags.length
    ? tags.map((t, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius-sm)">
          <span class="cal-tag ${t.c}" style="flex:1">${t.t}</span>
          <div onclick="deleteCalTag(${d},${i})" style="cursor:pointer;color:var(--text3);font-size:14px;padding:2px 6px;border-radius:4px;border:1px solid var(--border)" title="삭제">✕</div>
        </div>`).join('')
    : `<div style="font-size:11px;color:var(--text3);text-align:center;padding:16px 0">등록된 일정이 없습니다.</div>`;
  document.getElementById('calModalInput').value = '';
  calSelectedColor = 'ct-info';
  document.getElementById('calColorDot').style.background = 'var(--accent)';
  document.getElementById('calColorLabel').textContent = '일반';
  openModal('calModal');
}

let calSelectedColor = 'ct-info';

function toggleColorPicker() {
  const dd = document.getElementById('calColorDropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

function pickColor(value, label, color) {
  calSelectedColor = value;
  document.getElementById('calColorDot').style.background = color;
  document.getElementById('calColorLabel').textContent = label;
  document.getElementById('calColorDropdown').style.display = 'none';
}

function addCalTag() {
  const d = G.selectedCalDay;
  const text = document.getElementById('calModalInput').value.trim();
  const color = calSelectedColor;
  if (!text) return;
  let ev = G.calEvents.find(e => e.d === d);
  if (ev) {
    ev.tags.push({t: text, c: color});
  } else {
    G.calEvents.push({d, tags: [{t: text, c: color}]});
  }
  renderCalendar();
  openCalModal(d);
  showToast(`5월 ${d}일 일정이 추가됐습니다.`, 'info');
}

function deleteCalTag(d, idx) {
  const ev = G.calEvents.find(e => e.d === d);
  if (!ev) return;
  ev.tags.splice(idx, 1);
  if (ev.tags.length === 0) G.calEvents = G.calEvents.filter(e => e.d !== d);
  renderCalendar();
  openCalModal(d);
  showToast('일정이 삭제됐습니다.', 'info');
}

function parseScheduleMsg(msg){
  const people=['이성우','박주원','김희진','김성호','관리자'];
  const person=people.find(p=>msg.includes(p))||'미확인';
  const dm=msg.match(/(\d+\/\d+|\d+월\s*\d+일)/);const date=dm?dm[0]:'날짜 미확인';
  const type=msg.includes('외부 일정')?'외부 일정':msg.includes('휴가')?'휴가':msg.includes('회의')||msg.includes('미팅')?'회의':'부재';
  return{person,date,type,impact:type==='회의'?'팀 진행상황 점검':`${person} 담당 업무 공백 예상`};
}

function isScheduleCreateRequest(msg){
  return /부재|휴가|외근|외부 일정|일정\s*(추가|등록|생성)|캘린더에|회의\s*(추가|등록|잡아|생성)|미팅\s*(추가|등록|잡아|생성)/.test(msg);
}

function assistantScheduleTodos(prompt){
  const member=(window.opsRadarMembers||[]).map(m=>m.name).find(name=>prompt.includes(name))
    || ['이성우','박주원','김희진','김성호'].find(name=>prompt.includes(name));
  if(!member || !/일정|스케줄|마감|업무/.test(prompt)) return [];
  return todos.filter(todo=>todo.status==='approved' && todo.assignee===member);
}

function assistantTodoCards(prompt){
  const items=assistantScheduleTodos(prompt);
  if(!items.length) return '';
  return `<div class="assistant-todo-schedule">
    <div class="assistant-todo-schedule-title"><i class="ti ti-calendar-check"></i> 진행 Todo와 마감일</div>
    ${items.slice(0,6).map(todo=>`<div class="assistant-todo-schedule-item">
      <div><strong>${escapeHtml(cleanTodoTitle(todo.title))}</strong><span>${escapeHtml(todo.dueDate ? `마감 ${todo.dueDate}` : '마감일 미지정')}</span></div>
      <button type="button" onclick="openAssistantTodoDetail(${todo.id})">상세보기</button>
    </div>`).join('')}
  </div>`;
}

function openAssistantTodoDetail(id){
  nav('todo');
  switchTodoTab('inprogress');
  openTodoDetailModal(id);
}
window.openAssistantTodoDetail=openAssistantTodoDetail;

// ════════════════════════════════════════════════
// AI Assistant (흐름 5)
// ════════════════════════════════════════════════
const CHAT_SESSION_KEY = 'opsradar_chat_sessions';
const CHAT_CURRENT_KEY = 'opsradar_current_session_id';
function getInitialChatHtml(){
  return `
    <div class="msg chat-intro-msg"><div class="msg-av av-ai"><i class="ti ti-sparkles" style="font-size:13px"></i></div>
    <div><div class="ai-analysis-card chat-welcome-card"><div class="ai-card-kicker">OPS ASSISTANT</div><div class="ai-card-title">운영 데이터 기반으로 질문에 답변드립니다.</div><p><strong>일정 등록도 자연어로</strong> 입력하시면 캘린더에 자동 반영됩니다.</p></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
      <div class="sq" onclick="sendMsg('현재 가장 위험한 이슈는?')">현재 가장 위험한 이슈는?</div>
      <div class="sq" onclick="sendMsg('이번주 미완료 Todo 알려줘')">이번주 미완료 Todo</div>
      <div class="sq" onclick="sendMsg('이성우 5/26 부재')">이성우 5/26 부재</div>
      <div class="sq" onclick="sendMsg('이성우 다음주 화요일 외부 일정')">이성우 다음주 화요일 외부 일정</div>
    </div></div></div>`;
}
function loadChatSessions(){
  try{ const raw=localStorage.getItem(CHAT_SESSION_KEY); if(raw) return JSON.parse(raw).filter(Boolean); }catch(e){}
  return [];
}
function saveChatSessions(sessions){
  try{ localStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(sessions || [])); }catch(e){}
}
function generateSessionTitle(firstUserMessage){
  const text=normalizeText(firstUserMessage || '').trim();
  if(!text) return '새 운영 질문 기록';
  if(/캘린더|일정/.test(text)) return '캘린더 일정 분석';
  if(/위험|리스크|이슈|장애|API|DB/i.test(text)) return '운영 리스크 분석';
  if(/todo|업무|할 일/i.test(text)) return 'Todo 실행 상태 분석';
  return text.length>28 ? text.slice(0,28)+'…' : text;
}
function summarizeChatSession(session){
  const userMsgs=(session.messages||[]).filter(m=>m.role==='user').map(m=>m.content);
  if(!userMsgs.length) return '아직 질문이 없습니다.';
  return `${userMsgs[0].slice(0,42)}${userMsgs[0].length>42?'…':''}`;
}
function getCurrentChatSession(){
  const sessions=loadChatSessions();
  let id=localStorage.getItem(CHAT_CURRENT_KEY);
  let session=sessions.find(s=>s.id===id);
  if(!session){ session=createNewChatSession(false); }
  return session;
}
function createNewChatSession(showNotice=true){
  const sessions=loadChatSessions();
  const session={ id:'session_'+Date.now(), title:'새 운영 질문 기록', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), summary:'아직 요약 전입니다.', messages:[] };
  sessions.unshift(session);
  saveChatSessions(sessions.slice(0,20));
  localStorage.setItem(CHAT_CURRENT_KEY, session.id);
  G.currentChatSessionId=session.id;
  G.lastChatPrompt='';
  renderChatSessionList();
  renderCurrentChatMessages();
  if(showNotice) showToast('새 분석 세션을 시작했습니다.','success');
  return session;
}
function setCurrentChatSession(sessionId){
  const session=loadChatSessions().find(s=>s.id===sessionId);
  if(!session) return;
  localStorage.setItem(CHAT_CURRENT_KEY, session.id);
  G.currentChatSessionId=session.id;
  G.lastChatPrompt=(session.messages||[]).filter(m=>m.role==='user').slice(-1)[0]?.content || '';
  renderChatSessionList();
  renderCurrentChatMessages();
}
function saveMessageToCurrentSession(role, content, meta={}){
  if(G.restoringChat) return;
  const sessions=loadChatSessions();
  let session=sessions.find(s=>s.id===(localStorage.getItem(CHAT_CURRENT_KEY) || G.currentChatSessionId));
  if(!session){ session=createNewChatSession(false); return saveMessageToCurrentSession(role, content, meta); }
  const message={ role, content:normalizeText(content), createdAt:new Date().toISOString(), ...meta };
  session.messages=session.messages || [];
  session.messages.push(message);
  session.updatedAt=message.createdAt;
  if(role==='user' && (!session.title || session.title==='새 운영 질문 기록')) session.title=generateSessionTitle(content);
  session.summary=(session.messages.length>8) ? `${session.messages.length}개 메시지를 요약 카드로 접어 표시 중` : '요약 전';
  const next=[session, ...sessions.filter(s=>s.id!==session.id)].slice(0,20);
  saveChatSessions(next);
  localStorage.setItem(CHAT_CURRENT_KEY, session.id);
  renderChatSessionList();
}
function formatChatSessionDate(value){
  const d=new Date(value); if(Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\. /g,'.').replace(/\.$/,'');
}
function renderChatSessionList(){
  const list=document.getElementById('chatSessionList'); if(!list) return;
  const sessions=loadChatSessions();
  if(!sessions.length){ list.innerHTML='<div class="chat-session-empty">저장된 운영 질문 기록이 없습니다.</div>'; return; }
  const currentId=localStorage.getItem(CHAT_CURRENT_KEY) || G.currentChatSessionId;
  list.innerHTML=sessions.map(session=>{
    const messages=session.messages || [];
    const lastUser=[...messages].reverse().find(m=>m.role==='user');
    const summarized=messages.length>8;
    return `<article class="chat-session-item ${session.id===currentId?'active':''}" onclick="setCurrentChatSession('${escapeHtml(session.id)}')">
      <div class="chat-session-row"><div class="chat-session-title text-content">${escapeHtml(session.title || '운영 질문 기록')}</div><button class="chat-session-delete" type="button" onclick="event.stopPropagation();deleteChatSession('${escapeHtml(session.id)}')" title="세션 삭제"><i class="ti ti-trash"></i></button></div>
      <div class="chat-session-meta">${escapeHtml(formatChatSessionDate(session.createdAt))} · 메시지 ${messages.length}개</div>
      <div class="chat-session-last text-content">${escapeHtml(lastUser?.content || '아직 질문이 없습니다.')}</div>
      <div class="chat-session-badges"><span>${summarized?'요약됨':'원문'}</span><span>${escapeHtml(formatChatSessionDate(session.updatedAt || session.createdAt))} 업데이트</span></div>
    </article>`;
  }).join('');
}
function deleteChatSession(sessionId){
  if(!confirm('이 분석 세션을 삭제할까요?')) return;
  const sessions=loadChatSessions().filter(s=>s.id!==sessionId);
  saveChatSessions(sessions);
  if((localStorage.getItem(CHAT_CURRENT_KEY) || G.currentChatSessionId)===sessionId){
    if(sessions[0]) localStorage.setItem(CHAT_CURRENT_KEY,sessions[0].id); else localStorage.removeItem(CHAT_CURRENT_KEY);
  }
  if(!sessions.length) createNewChatSession(false); else { renderChatSessionList(); renderCurrentChatMessages(); }
  showToast('분석 세션을 삭제했습니다.','success');
}
function clearCurrentChatSession(){
  if(!confirm('현재 분석 세션의 대화 내용을 초기화할까요?')) return;
  const sessions=loadChatSessions();
  const currentId=localStorage.getItem(CHAT_CURRENT_KEY) || G.currentChatSessionId;
  const session=sessions.find(s=>s.id===currentId);
  if(session){ session.messages=[]; session.title='새 운영 질문 기록'; session.summary='아직 요약 전입니다.'; session.updatedAt=new Date().toISOString(); saveChatSessions(sessions); }
  renderChatSessionList();
  renderCurrentChatMessages();
}
function initChatSessions(){
  let sessions=loadChatSessions();
  if(!sessions.length) createNewChatSession(false);
  else if(!sessions.some(s=>s.id===localStorage.getItem(CHAT_CURRENT_KEY))) localStorage.setItem(CHAT_CURRENT_KEY,sessions[0].id);
  renderChatSessionList();
  renderCurrentChatMessages();
}
function renderCurrentChatMessages(){
  const area=document.getElementById('chatArea'); if(!area) return;
  const session=getCurrentChatSession();
  area.innerHTML=getInitialChatHtml();
  resetChatContextPanel();
  G.restoringChat=true;
  (session.messages||[]).forEach(message=>{
    if(message.kind==='schedule') renderScheduleAssistantMessage(message.content, message.parsed || parseScheduleMsg(message.content), message.calDate || null);
    else appendChatMsg(message.role==='assistant'?'ai':'user', message.content, message.src || null, !!message.withBtn);
  });
  G.restoringChat=false;
  enforceChatLimit();
  const latestAssistant=[...(session.messages||[])].reverse().find(m=>m.role==='assistant');
  if(latestAssistant) updateChatContextPanel(`${G.lastChatPrompt || ''} ${latestAssistant.content}`, latestAssistant.src || null);
}
function startNewChat(){ createNewChatSession(true); }
async function sendMsg(text){
  if(G.chatTyping)return;
  getCurrentChatSession();
  const input=document.getElementById('chatInput');const msg=text||input.value.trim();if(!msg)return;
  input.value='';input.style.height='auto';
  G.lastChatPrompt = msg;
  appendChatMsg('user',msg);showTyping();
  const renderLocalReply=()=>{
    removeTyping();
    const res=chatResponses[msg];
    if(res){
      if(res.type==='schedule') showScheduleConfirm(msg,res);
      else appendChatMsg('ai',res.text,res.src);
    } else if(isScheduleCreateRequest(msg)){
      const parsed=parseScheduleMsg(msg);showScheduleConfirmRaw(msg,parsed);
    } else {
      appendChatMsg('ai','운영 데이터에서 관련 정보를 찾고 있습니다. 더 구체적으로 질문해주시면 정확한 답변을 드릴 수 있습니다.',null);
    }
  };
  if(chatResponses[msg] || isScheduleCreateRequest(msg)){
    setTimeout(renderLocalReply,900+Math.random()*400);
    return;
  }
  try{
    const data=await window.opsRadarApi.request('/chat',{method:'POST',body:JSON.stringify({message:msg})});
    removeTyping();
    appendChatMsg('ai',data.answer||'AI 응답이 비어 있습니다.',data.sources||null);
  }catch(error){
    removeTyping();
    console.warn('AI chat API failed',error);
    appendChatMsg('ai','AI 연결에 실패했습니다. Azure OpenAI 설정과 서버 로그를 확인해주세요.',null);
  }
}
function inferChatContext(text, src){
  const sourceDocs = normalizeSources(src);
  const docs = sourceDocs.length ? sourceDocs : (/위험|이슈|Risk|리스크|장애|API|DB/i.test(text) ? ['운영 로그 분석 결과', '이슈 관리 현황'] : ['운영 데이터 인덱스']);
  const todoItems = /todo|업무|할 일|Todo/i.test(text) ? ['내 Todo 현황 확인', 'Blocked 업무 우선순위 점검'] : ['필요 시 Todo 생성'];
  const issueItems = /위험|이슈|Risk|리스크|장애|API|DB/i.test(text) ? ['High Risk 후보 검토', '운영 영향 범위 확인'] : [];
  return { docs, todoItems, issueItems };
}
function renderChatContextList(id, items, emptyText){
  const el=document.getElementById(id); if(!el) return;
  const list=(items||[]).filter(Boolean);
  el.innerHTML=list.length ? list.map(item=>`<div class="chat-context-item text-content"><strong>${escapeHtml(item)}</strong><span>AI 답변과 함께 확인할 운영 근거입니다.</span></div>`).join('') : `<div class="chat-context-empty">${escapeHtml(emptyText)}</div>`;
}
function updateChatContextPanel(text='', src=null){
  const ctx=inferChatContext(text, src);
  renderChatContextList('chatSourceList', ctx.docs, '질문 후 관련 출처가 표시됩니다.');
  renderChatContextList('chatTodoList', ctx.todoItems, '연결된 Todo 없음');
  renderChatContextList('chatIssueList', ctx.issueItems, '연결된 Issue 없음');
}
function resetChatContextPanel(){
  renderChatContextList('chatSourceList', [], '질문 후 관련 출처가 표시됩니다.');
  renderChatContextList('chatTodoList', [], '연결된 Todo 없음');
  renderChatContextList('chatIssueList', [], '연결된 Issue 없음');
}
function enforceChatLimit(){
  const area=document.getElementById('chatArea'); if(!area) return;
  const items=Array.from(area.querySelectorAll('.msg[data-chat-item="true"]'));
  const maxVisible=8;
  const hiddenCount=Math.max(0, items.length-maxVisible);
  items.forEach((item,idx)=>item.classList.toggle('chat-hidden', idx < hiddenCount));
  let summary=document.getElementById('chatSummaryCard');
  if(hiddenCount>0){
    if(!summary){
      summary=document.createElement('div'); summary.id='chatSummaryCard'; summary.className='chat-summary-card';
      const intro=area.querySelector('.chat-intro-msg');
      if(intro && intro.nextSibling) area.insertBefore(summary,intro.nextSibling); else area.insertBefore(summary, area.firstChild);
    }
    summary.innerHTML=`<i class="ti ti-fold"></i><div><strong>이전 대화 ${hiddenCount}개 요약</strong><span>전체 원문은 현재 분석 세션에 저장되어 있으며, 화면에는 최근 메시지만 표시합니다.</span></div>`;
    summary.style.display='flex';
  } else if(summary){ summary.style.display='none'; }
}
function renderScheduleAssistantMessage(msg, parsed, calDate){
  const area=document.getElementById('chatArea');
  const wrapper=document.createElement('div');wrapper.className='msg fade-up';wrapper.dataset.chatItem='true';
  const p=parsed || parseScheduleMsg(msg);
  wrapper.innerHTML=`<div class="msg-av av-ai"><i class="ti ti-sparkles" style="font-size:13px"></i></div>
  <div style="max-width:min(760px,100%)"><div class="ai-analysis-card"><div class="ai-card-kicker">SCHEDULE ANALYSIS</div><div class="ai-card-title">일정 정보를 운영 캘린더 항목으로 분석했습니다.</div><p>아래 내용으로 캘린더에 등록할까요?</p></div>
  <div class="confirm-card">
    <div class="confirm-row"><div class="confirm-lbl">대상</div><div class="confirm-val">${escapeHtml(p.person)}</div></div>
    <div class="confirm-row"><div class="confirm-lbl">날짜</div><div class="confirm-val">${escapeHtml(p.date)}</div></div>
    <div class="confirm-row"><div class="confirm-lbl">유형</div><div class="confirm-val">${escapeHtml(p.type)}</div></div>
    <div class="confirm-row"><div class="confirm-lbl">영향</div><div class="confirm-val" style="color:var(--warn)">${escapeHtml(p.impact)}</div></div>
    <div class="confirm-actions">
      <div class="tbtn primary" onclick="doRegisterCalEvent(this,'${p.person}','${p.date}','${p.type}','${p.impact}',${calDate||'null'})"><i class="ti ti-calendar-plus"></i> 캘린더 등록</div>
      <div class="tbtn" onclick="this.closest('.confirm-card').innerHTML='<span style=font-size:11px;color:var(--text3)>등록 취소됨</span>'">취소</div>
    </div>
  </div></div>`;
  area.appendChild(wrapper);updateChatContextPanel(msg,'Calendar 운영 일정');
}
function showScheduleConfirm(msg,res){
  renderScheduleAssistantMessage(msg, res.parsed, res.calDate || null);
  if(!G.restoringChat) saveMessageToCurrentSession('assistant', '일정 정보를 운영 캘린더 항목으로 분석했습니다.', { kind:'schedule', parsed:res.parsed, calDate:res.calDate || null, src:'Calendar 운영 일정' });
  enforceChatLimit();document.getElementById('chatArea').scrollTop=document.getElementById('chatArea').scrollHeight;
}
function showScheduleConfirmRaw(msg,parsed){showScheduleConfirm(msg,{parsed,calDate:null});}
async function doRegisterCalEvent(btn,person,date,type,impact,calDate){
  const dateMatch=String(date||'').match(/(\d+)\/(\d+)/);
  const month=dateMatch?Number(dateMatch[1])-1:G.currentCalMonth;
  const day=calDate||(dateMatch?Number(dateMatch[2]):null);
  try{
    if(!day || !window.opsRadarCreateCalendarEvent || !window.opsRadarApi) throw new Error('Calendar API is not ready');
    await window.opsRadarCreateCalendarEvent({title:`${person} ${type}`,day,month,year:G.currentCalYear,color:type==='부재'?'ct-gray':'ct-info'});
    await window.opsRadarApi.loadCalendar();
    G.newCalEvents.push({person,date,type,impact,calDate:day,y:G.currentCalYear,m:month});
    renderCalendar(G.currentCalYear,G.currentCalMonth);
    btn.closest('.confirm-card').innerHTML=`<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--success)"><i class="ti ti-circle-check" style="font-size:16px"></i><div><div style="font-weight:500">캘린더에 등록되었습니다</div><div style="font-size:10px;color:var(--text3);margin-top:2px">${escapeHtml(person)} · ${escapeHtml(date)} · ${escapeHtml(type)}</div></div><div class="tbtn" onclick="nav('calendar')" style="margin-left:auto;font-size:10px;padding:3px 8px;color:var(--accent)">캘린더 확인 →</div></div>`;
    setTimeout(()=>{if(type!=='회의')appendChatMsg('ai',`인수인계 센터에도 "${person} ${date} ${type}"이 반영되었습니다. 업무 공백 대비 인수인계 문서를 생성하시겠어요?`,null,true);},600);
    showToast(`캘린더에 등록되었습니다. ${person} · ${date}`);
  }catch(error){
    console.warn('Chat calendar create API failed',error);
    showToast('캘린더 등록에 실패했습니다.','warn');
  }
}
function appendChatMsg(role,text,src=null,withBtn=false){
  const area=document.getElementById('chatArea');const div=document.createElement('div');div.className=`msg ${role==='user'?'user':''} fade-up`;div.dataset.chatItem='true';
  if(role==='user'){
    div.innerHTML=`<div class="msg-av av-user"><i class="ti ti-user" style="font-size:13px"></i></div><div class="bubble bubble-user text-content">${escapeHtml(text)}</div>`;
    saveMessageToCurrentSession('user', text);
  } else {
    div.innerHTML=`<div class="msg-av av-ai"><i class="ti ti-sparkles" style="font-size:13px"></i></div><div><div class="ai-analysis-card"><div class="ai-card-kicker">AI OPERATION ANALYSIS</div><div class="ai-card-title">운영 데이터 기반 분석 결과</div><p class="text-content">${escapeHtml(text)}</p>${normalizeSources(src).length?`<div class="ai-card-source"><i class="ti ti-file-text" style="font-size:11px"></i> 출처: ${escapeHtml(normalizeSources(src).join(', '))}</div>`:''}</div>${assistantTodoCards(G.lastChatPrompt||'')}${withBtn?'<div style="margin-top:6px"><div class="tbtn" style="font-size:10px;padding:4px 10px;color:var(--accent)" onclick="nav(\'knowledge\')"><i class="ti ti-transfer"></i> 인수인계 문서 생성</div></div>':''}</div>`;
    updateChatContextPanel((G.lastChatPrompt || '') + ' ' + text, src);
    saveMessageToCurrentSession('assistant', text, { src, withBtn });
  }
  area.appendChild(div);enforceChatLimit();area.scrollTop=area.scrollHeight;
}
function showTyping(){G.chatTyping=true;document.getElementById('sendBtn').disabled=true;const area=document.getElementById('chatArea');const div=document.createElement('div');div.className='msg';div.id='typingIndicator';div.innerHTML=`<div class="msg-av av-ai"><i class="ti ti-sparkles" style="font-size:13px"></i></div><div class="ai-analysis-card"><div class="typing"><span></span><span></span><span></span></div></div>`;area.appendChild(div);area.scrollTop=area.scrollHeight;}
function removeTyping(){G.chatTyping=false;document.getElementById('sendBtn').disabled=false;const el=document.getElementById('typingIndicator');if(el)el.remove();}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,80)+'px';}

// ════════════════════════════════════════════════
// 인수인계 센터 — 3개 흐름
// ════════════════════════════════════════════════
let currentKType = 'onboarding';
const kChecks = { onboarding:{}, absence:{}, offboard:{} };

function selectKnowledgeType(type) {
  G.currentKnowledgeType = type;
  currentKType = type;
  ['onboarding','absence','offboard'].forEach(t => {
    const btn = document.getElementById('kbtn-'+t);
    if (!btn) return;
    btn.removeAttribute('style');
    if (t === type) {
      btn.style.background = 'var(--accent-soft)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }
  });
  renderKnowledgeFlow(type);
}

function renderKnowledgeFlow(type) {
  const flowBar = document.getElementById('knowledgeFlowSteps');
  const hint = document.getElementById('knowledgeFlowHint');
  const ctx = document.getElementById('knowledgeContextPanel');
  const content = document.getElementById('knowledgeContent');

  if (type === 'onboarding') {
    flowBar.innerHTML = kFlowSteps(['프로젝트 파악','운영 상태 확인','환경 세팅','첫 업무 시작']);
    hint.textContent = '신규 팀원이 독립적으로 업무 시작까지 걸리는 시간을 최소화합니다.';
    ctx.innerHTML = kCtxOnboarding();
    content.innerHTML = kContentOnboarding();
  } else if (type === 'absence') {
    flowBar.innerHTML = kFlowSteps(['맡은 업무 파악','업무 맥락 이해','처리 완료 보고']);
    hint.textContent = '외부 일정·휴가 기간 동안 업무 공백 없이 팀이 운영됩니다.';
    ctx.innerHTML = kCtxAbsence();
    content.innerHTML = kContentAbsence();
  } else if (type === 'briefing') {
    flowBar.innerHTML = kFlowSteps(['프로젝트 현황','주요 결정사항','리스크 현황','다음 액션']);
    hint.textContent = '프로젝트 맥락을 빠르게 파악하고 즉시 기여할 수 있도록 지원합니다.';
    ctx.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4">프로젝트<br>브리핑</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px">AI가 운영 기록을 분석해 프로젝트 전체 맥락을 5분 안에 전달합니다.</div>
      <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">브리핑 대상</div>
      <div style="background:var(--accent-soft);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px;color:var(--accent);margin-bottom:12px">
        <div style="font-weight:500">전체 팀원</div>
        <div style="font-size:10px;margin-top:2px">프로젝트 합류자 · 이해관계자 등</div>
      </div>
      <div class="tbtn primary" style="font-size:11px;width:100%;justify-content:center"><i class="ti ti-wand"></i> AI 브리핑 생성</div>`;
    content.innerHTML = `
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">1</div>
          <div class="kcard-title">프로젝트 현황 요약</div>
          <div class="kcard-sub">AI가 운영 로그 기반으로 자동 생성</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div>운영 로그, 회의록, 이슈 기록을 분석해 현재 프로젝트 상태를 한눈에 보여줍니다.</div></div>
          <div class="kb-item"><i class="ti ti-point"></i>전체 진행률 및 주차별 달성 현황</div>
          <div class="kb-item"><i class="ti ti-point"></i>팀원별 역할 및 현재 담당 업무</div>
          <div class="kb-item"><i class="ti ti-point"></i>완료된 주요 기능 목록</div>
          <div style="margin-top:12px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 현황 브리핑 생성</div></div>
        </div>
      </div>
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">2</div>
          <div class="kcard-title">주요 결정사항</div>
          <div class="kcard-sub">기술·운영 의사결정 히스토리</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-item"><i class="ti ti-point"></i>기술 스택 선택 배경 및 근거</div>
          <div class="kb-item"><i class="ti ti-point"></i>주요 아키텍처 변경 이력</div>
          <div class="kb-item"><i class="ti ti-point"></i>팀 내 합의된 개발 컨벤션</div>
          <div style="margin-top:12px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 결정사항 브리핑 생성</div></div>
        </div>
      </div>
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">3</div>
          <div class="kcard-title">리스크 현황</div>
          <div class="kcard-sub">현재 진행 중인 이슈 및 블로커</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-item"><i class="ti ti-point"></i>High Risk 이슈 목록 및 대응 현황</div>
          <div class="kb-item"><i class="ti ti-point"></i>Blocked 상태 작업 및 해제 조건</div>
          <div class="kb-item"><i class="ti ti-point"></i>일정 지연 가능성 항목</div>
          <div style="margin-top:12px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 리스크 브리핑 생성</div></div>
        </div>
      </div>`;
  } else if (type === 'emergency') {
    flowBar.innerHTML = kFlowSteps(['상황 파악','영향 범위','즉시 액션','보고']);
    hint.textContent = '긴급 상황 발생 시 핵심 정보를 즉시 파악하고 대응합니다.';
    ctx.innerHTML = `
      <div style="font-size:13px;font-weight:700;color:var(--danger);margin-bottom:8px;line-height:1.4">긴급 상황<br>브리핑</div>
      <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px">운영 장애·보안 이슈·서비스 중단 등 긴급 상황 발생 시 AI가 즉시 상황을 분석합니다.</div>
      <div style="background:var(--danger-soft);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px;color:var(--danger);margin-bottom:12px">
        <div style="font-weight:500">⚠ 현재 활성 긴급 이슈</div>
        <div style="font-size:10px;margin-top:4px">운영 API 타임아웃 (High)</div>
      </div>
      <div class="tbtn" style="font-size:11px;width:100%;justify-content:center;border-color:var(--danger);color:var(--danger)"><i class="ti ti-alert-triangle"></i> 긴급 브리핑 생성</div>`;
    content.innerHTML = `
      <div style="background:var(--danger-soft);border:1px solid rgba(224,62,62,.2);border-radius:var(--radius);padding:14px 16px">
        <div style="font-size:12px;font-weight:500;color:var(--danger);margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="ti ti-alert-triangle"></i> 긴급 상황 대응 프로세스</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.7">긴급 상황 발생 시 아래 순서대로 진행하세요. AI가 각 단계에서 필요한 정보를 자동으로 수집합니다.</div>
      </div>
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--danger-soft);color:var(--danger);border:2px solid var(--danger);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">1</div>
          <div class="kcard-title">상황 파악</div>
          <div class="kcard-sub">AI가 관련 운영 로그를 즉시 분석</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div>운영 로그와 이슈 기록을 분석해 장애 원인과 발생 시점을 자동 추적합니다.</div></div>
          <div class="kb-item"><i class="ti ti-point"></i>장애 발생 시점 및 최초 감지 경로</div>
          <div class="kb-item"><i class="ti ti-point"></i>관련 서비스 및 컴포넌트 목록</div>
          <div class="kb-item"><i class="ti ti-point"></i>유사 과거 이슈 및 해결 이력 조회</div>
          <div style="margin-top:12px"><div class="tbtn" style="font-size:11px;border-color:var(--danger);color:var(--danger)"><i class="ti ti-wand"></i> 즉시 상황 분석</div></div>
        </div>
      </div>
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">2</div>
          <div class="kcard-title">영향 범위 파악</div>
          <div class="kcard-sub">어떤 기능·팀원·일정에 영향을 미치는지</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-item"><i class="ti ti-point"></i>영향받는 기능 및 API 목록</div>
          <div class="kb-item"><i class="ti ti-point"></i>Blocked 처리될 Todo/이슈 목록</div>
          <div class="kb-item"><i class="ti ti-point"></i>일정 지연 예상 항목</div>
        </div>
      </div>
      <div class="kcard">
        <div class="kcard-hd">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">3</div>
          <div class="kcard-title">즉시 액션</div>
          <div class="kcard-sub">AI 추천 대응 방안</div>
          <i class="ti ti-chevron-down kcard-arrow"></i>
        </div>
        <div class="kcard-body">
          <div class="kb-item"><i class="ti ti-point"></i>담당자 즉시 알림 발송</div>
          <div class="kb-item"><i class="ti ti-point"></i>임시 조치 방안 (과거 유사 이슈 기반)</div>
          <div class="kb-item"><i class="ti ti-point"></i>에스컬레이션 기준 및 보고 경로</div>
          <div style="margin-top:12px"><div class="tbtn" style="font-size:11px;border-color:var(--danger);color:var(--danger)"><i class="ti ti-wand"></i> 대응 방안 생성</div></div>
        </div>
      </div>`;
  } else {
    flowBar.innerHTML = kFlowSteps(['이어받을 업무 파악','맥락·결정사항 이해','개발 환경 세팅','인수 완료 확인']);
    hint.textContent = '퇴직자의 운영 맥락과 지식이 조직에 남습니다.';
    ctx.innerHTML = kCtxOffboard();
    content.innerHTML = kContentOffboard();
  }
  // 체크리스트 이벤트 바인딩
  document.querySelectorAll('.checklist-item').forEach(el => {
    el.addEventListener('click', function() {
      this.classList.toggle('checked');
      const box = this.querySelector('.cl-box');
      box.innerHTML = this.classList.contains('checked') ? '<i class="ti ti-check" style="font-size:10px"></i>' : '';
    });
  });
  // kcard 토글 — accordion 방식 (한 번에 하나만 열림, 클릭해야만 열림)
  function bindKcards() {
    document.querySelectorAll('.kcard').forEach(el => el.classList.remove('open'));
    const allCards = Array.from(document.querySelectorAll('#knowledgeContent .kcard'));

    // 모든 숫자 원 회색으로 초기화
    function resetCircles() {
      document.querySelectorAll('.kcard .kcard-hd div[style*="border-radius:50%"]').forEach(c => {
        c.style.background = 'var(--surface2)';
        c.style.color = 'var(--text3)';
        c.style.borderColor = 'var(--border2)';
      });
    }
    resetCircles();

    document.querySelectorAll('.kcard').forEach(el => {
      el.querySelector('.kcard-hd').addEventListener('click', function() {
        const parent = el.closest('#knowledgeContent, .content, .screen');
        const isOpen = el.classList.contains('open');
        if (parent) parent.querySelectorAll('.kcard').forEach(c => c.classList.remove('open'));
        resetCircles();
        const flowBar = document.getElementById('knowledgeFlowSteps');
        const steps = flowBar ? flowBar.querySelectorAll('div[style*="border-radius:20px"]') : [];
        steps.forEach(s => { s.style.background='var(--surface)'; s.style.color='var(--text3)'; s.style.borderColor='var(--border2)'; });
        if (!isOpen) {
          el.classList.add('open');
          // 숫자 원 파란색
          const circle = el.querySelector('.kcard-hd div[style*="border-radius:50%"]');
          if (circle) { circle.style.background='var(--accent)'; circle.style.color='#fff'; circle.style.borderColor='var(--accent)'; }
          // flowBar 해당 단계 활성화
          const idx = allCards.indexOf(el);
          steps.forEach((s, i) => {
            s.style.background = i === idx ? 'var(--accent)' : 'var(--surface)';
            s.style.color = i === idx ? '#fff' : 'var(--text3)';
            s.style.borderColor = i === idx ? 'var(--accent)' : 'var(--border2)';
          });
          setTimeout(() => el.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
        }
      });
    });
  }
  bindKcards();
}

function kFlowSteps(steps, activeIndex = -1) {
  return steps.map((s,i) => {
    const isActive = i === activeIndex;
    return `
    <div style="display:flex;align-items:center;gap:4px">
      <div style="font-size:10px;padding:3px 8px;border-radius:20px;border:1px solid ${isActive?'var(--accent)':'var(--border2)'};background:${isActive?'var(--accent)':'var(--surface)'};color:${isActive?'#fff':'var(--text3)'}">
        ${isActive?'●':i+1}. ${s}
      </div>
      ${i<steps.length-1?'<span style="font-size:10px;color:var(--text3)">→</span>':''}
    </div>`;
  }).join('');
}

// ── 신규 입사자 온보딩 ──────────────────────────
function kCtxOnboarding() {
  return `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4">신규 입사자<br>온보딩</div>
    <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px">맥락 없이 투입되면 온보딩에 1~2주 낭비. WorkRader가 현재 운영 상태를 자동 정리해 줍니다.</div>
    <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">온보딩 진행률</div>
    <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:25%;background:var(--success);border-radius:3px" id="onboardingBar"></div></div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:14px">1/4 단계 완료</div>
    <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">대상 신규 팀원</div>
    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px">
      <div style="font-weight:500;color:var(--text)">신규 팀원 (예정)</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">입사일: 2026-06-01</div>
      <span class="badge b-accent" style="margin-top:4px;display:inline-block">프론트엔드</span>
    </div>`;
}

function kContentOnboarding() {
  return `
    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">1</div>
        <div class="kcard-title">프로젝트 파악</div>
        <div class="kcard-sub">서비스 정의·기술스택·팀 구성</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div><strong>왜 중요한가:</strong> 프로젝트 전체 맥락을 모르면 개별 업무가 왜 필요한지 이해 못 함.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">확인 항목</div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">WorkRader 서비스 정의 — 운영 인텔리전스 AI 시스템</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">기술 구성: FastAPI · PostgreSQL · pgvector · React · Azure OpenAI</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">업무 조직 (영업관리·구매·물류·품질 클레임·운영총괄)</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">8주 MVP 로드맵 및 현재 주차 확인</div></div>
        <div style="margin-top:12px;display:flex;gap:6px">
          <div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> AI 요약 문서 생성</div>
          <div class="tbtn" style="font-size:11px"><i class="ti ti-external-link"></i> 노션 문서</div>
        </div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">2</div>
        <div class="kcard-title">운영 상태 확인</div>
        <div class="kcard-sub">현재 이슈·Todo·리스크 현황</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-now"><i class="ti ti-alert-triangle" style="font-size:13px;flex-shrink:0"></i><div><strong>지금 당장 알아야 할 것:</strong> 현재 운영 상태가 여기에 표시됩니다. 운영 로그 업로드 후 자동 생성됩니다.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">현재 운영 현황</div>
        <div class="kb-item"><i class="ti ti-alert-triangle" style="color:var(--danger)"></i><div><div style="font-weight:500;color:var(--danger)">미해결 이슈 없음</div><div style="font-size:10px;color:var(--text3)">데이터 없음</div></div></div>
        <div class="kb-item"><i class="ti ti-checkbox" style="color:var(--accent)"></i><div><div>Todo 승인 대기 8건</div><div style="font-size:10px;color:var(--text3)">팀장 검토 필요</div></div></div>
        <div class="kb-item"><i class="ti ti-clock" style="color:var(--warn)"></i><div><div>이번 주 금요일 마감 4건 집중</div><div style="font-size:10px;color:var(--text3)">5/22 주의 구간</div></div></div>
        <div style="margin-top:12px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-layout-dashboard"></i> Dashboard에서 확인 →</div></div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">3</div>
        <div class="kcard-title">환경 세팅</div>
        <div class="kcard-sub">개발환경·계정·접속정보</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">세팅 체크리스트</div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">GitHub 계정 팀 레포 초대 (yeni0224/teamAZAG)</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">.env 파일 DATABASE_URL 설정 (리눅스 서버 IP)</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">psql -f schema.sql 실행 확인</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">FastAPI 로컬 실행 확인 (uvicorn)</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">노션 워크스페이스 접근 권한</div></div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">4</div>
        <div class="kcard-title">첫 업무 시작</div>
        <div class="kcard-sub">배정된 Todo · 참고 문서</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-next"><i class="ti ti-arrow-right" style="font-size:13px;flex-shrink:0"></i><div><strong>첫 번째 할 것:</strong> Todo 화면에서 배정된 항목 확인 후 착수. 모르는 내용은 AI Assistant에 질문.</div></div>
        <div class="kb-item"><i class="ti ti-file-text"></i>API 명세서 — 노션 DB 명세서 확인</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>더미 데이터 — dummy_data/sample_docs/ 참고</div>
        <div class="kb-item"><i class="ti ti-message-dots"></i>AI Assistant — "내가 할 업무 알려줘" 질문</div>
        <div style="margin-top:12px;display:flex;gap:6px">
          <div class="tbtn primary" style="font-size:11px" onclick="nav('todo')"><i class="ti ti-checkbox"></i> 배정된 Todo 확인 →</div>
          <div class="tbtn" style="font-size:11px" onclick="nav('chat')"><i class="ti ti-message-dots"></i> AI에게 질문</div>
        </div>
      </div>
    </div>`;
}

// ── 부재자 인수인계 ────────────────────────────
function kCtxAbsence() {
  return `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4">부재자 업무<br>인수인계</div>
    <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px">내가 임시로 맡게 된 업무를 빠르게 파악하고 공백 없이 처리할 수 있도록 안내합니다.</div>
    <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">내가 맡은 부재자 업무</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="background:var(--warn-soft);border:1px solid rgba(196,124,0,.15);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px">
        <div style="font-weight:500;color:var(--text);display:flex;align-items:center;gap:5px;margin-bottom:3px">이성우 업무 대리 <span class="badge b-warn" style="font-size:9px">진행중</span></div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">5/19 ~ 5/20 (2일)</div>
        <div style="font-size:10px;color:var(--warn);margin-top:4px">RAG 파이프라인 담당</div>
      </div>
      <div style="background:var(--warn-soft);border:1px solid rgba(196,124,0,.15);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px">
        <div style="font-weight:500;color:var(--text);display:flex;align-items:center;gap:5px;margin-bottom:3px">관리자 업무 대리 <span class="badge b-warn" style="font-size:9px">예정</span></div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">5/21 (1일)</div>
        <div style="font-size:10px;color:var(--warn);margin-top:4px">PR 승인 대리</div>
      </div>
    </div>
    <div style="margin-top:12px">
      <div class="tbtn primary" style="font-size:11px;width:100%;justify-content:center"><i class="ti ti-wand"></i> 내 인수 현황 AI 요약</div>
    </div>`;
}

function kContentAbsence() {
  return `
    <div style="background:var(--accent-soft);border:1px solid rgba(66,99,235,.15);border-radius:var(--radius);padding:12px 14px;font-size:11px;color:var(--text2)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:500;color:var(--accent)"><i class="ti ti-sparkles" style="font-size:13px"></i> AI 분석 — 내가 받은 업무 요약</div>
      부재자 인수인계 내용이 여기에 표시됩니다. 운영 로그 업로드 후 AI가 자동으로 생성합니다.
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--warn);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">1</div>
        <div class="kcard-title">맡은 업무 파악</div>
        <div class="kcard-sub">내가 처리해야 할 Todo · 이슈 목록</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-now"><i class="ti ti-alert-triangle" style="font-size:13px;flex-shrink:0"></i><div><strong>지금 당장 처리해야 할 것:</strong> 현재 진행 중인 업무와 즉시 처리 항목이 여기에 표시됩니다.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">인수받은 Todo</div>
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge b-danger">High</span>
            <span style="color:var(--text)">Azure timeout 재시도 로직 개선</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto;font-family:var(--mono)">5/19</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge b-warn">Mid</span>
            <span style="color:var(--text)">pgvector 재임베딩 테스트</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto;font-family:var(--mono)">5/20</span>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:6px">
          <div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 전체 인수 목록 보기</div>
          <div class="tbtn" style="font-size:11px" onclick="nav('todo')"><i class="ti ti-checkbox"></i> Todo로 이동</div>
        </div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">2</div>
        <div class="kcard-title">업무 맥락 이해</div>
        <div class="kcard-sub">왜 중요한지 · 현재 상태 · 내가 할 것</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div><strong>왜 중요한가:</strong> RAG 파이프라인이 멈추면 AI Assistant 전체가 동작하지 않습니다. 팀 핵심 기능입니다.</div></div>
        <div class="kb-now"><i class="ti ti-alert-triangle" style="font-size:13px;flex-shrink:0"></i><div><strong>현재 상태:</strong> Korea Central 리전 전환 후 타임아웃 60% 감소. 재시도 로직 3회 설정 완료. 추가 검증 필요.</div></div>
        <div class="kb-next"><i class="ti ti-arrow-right" style="font-size:13px;flex-shrink:0"></i><div><strong>내가 할 것:</strong> 재시도 로직 테스트 → 결과 팀 공유 → 이슈 상태 업데이트. 긴급 시 이성우에게 연락.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">참고 문서 (AI 추출)</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>issue_log_20260514_azure_timeout.txt</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>chat_logs_20260514_ai_pipeline.txt</div>
        <div style="margin-top:10px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 맥락 문서 AI 생성</div></div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">3</div>
        <div class="kcard-title">처리 완료 보고</div>
        <div class="kcard-sub">내가 처리한 내용 기록 및 원래 담당자 복귀 준비</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-next"><i class="ti ti-arrow-right" style="font-size:13px;flex-shrink:0"></i><div><strong>복귀 전 인계:</strong> 내가 처리한 내용을 기록해두면 이성우 복귀 시 AI가 자동으로 브리핑 문서를 생성합니다.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">처리 완료 체크리스트</div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">Azure timeout 재시도 로직 테스트 완료 및 결과 공유</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">처리 내용 이슈 코멘트에 기록</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">미처리 항목 이성우 복귀 시 전달 예약</div></div>
        <div style="margin-top:12px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 처리 내용 인계 문서 생성</div></div>
      </div>
    </div>`;
}

// ── 담당자 변경/퇴직 인수인계 ────────────────────────────
function kCtxOffboard() {
  return `
    <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:8px;line-height:1.4">담당자 변경/<br>퇴직 인수인계</div>
    <div style="font-size:11px;color:var(--text2);line-height:1.7;margin-bottom:16px">전임자의 업무·맥락·결정사항을 빠르게 파악하고 즉시 이어받을 수 있도록 안내합니다.</div>
    <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">인수 파악 진행도</div>
    <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:35%;background:var(--accent);border-radius:3px"></div></div>
    <div style="font-size:10px;color:var(--text3);margin-bottom:14px">35% 파악 완료</div>
    <div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:8px">전임자 정보</div>
    <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px 10px;font-size:11px;margin-bottom:12px">
      <div style="font-weight:500;color:var(--text)">이성우</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px">AI 파이프라인 담당 → 담당자 변경</div>
    </div>
    <div class="tbtn primary" style="font-size:11px;width:100%;justify-content:center"><i class="ti ti-wand"></i> 전임자 업무 AI 분석</div>`;
}

function kContentOffboard() {
  return `
    <div style="background:var(--accent-soft);border:1px solid rgba(66,99,235,.15);border-radius:var(--radius);padding:12px 14px;font-size:11px;color:var(--text2)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-weight:500;color:var(--accent)"><i class="ti ti-sparkles" style="font-size:13px"></i> AI 분석 — 내가 이어받을 업무 요약</div>
      퇴직자 인수인계 내용이 여기에 표시됩니다. 운영 로그 업로드 후 AI가 자동으로 생성합니다.
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">1</div>
        <div class="kcard-title">이어받을 업무 전체 파악</div>
        <div class="kcard-sub">AI가 전임자 운영 기록을 분석해 자동 추출</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div>AI가 전임자의 회의록·이슈·채팅 로그를 분석해 이어받아야 할 업무를 자동으로 정리합니다.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">이어받을 주요 업무</div>
        <div style="background:var(--surface2);border-radius:var(--radius-sm);padding:8px 10px;display:flex;flex-direction:column;gap:6px;font-size:11px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge b-danger">High</span>
            <span style="color:var(--text)">FastAPI + AI 파이프라인 연동</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto">미완료</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge b-danger">High</span>
            <span style="color:var(--text)">Azure timeout 재시도 로직 개선</span>
            <span style="font-size:10px;color:var(--warn);margin-left:auto">진행중</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge b-warn">Mid</span>
            <span style="color:var(--text)">pgvector 재임베딩 테스트</span>
            <span style="font-size:10px;color:var(--text3);margin-left:auto">미완료</span>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:6px">
          <div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 전체 업무 목록 생성</div>
          <div class="tbtn" style="font-size:11px" onclick="nav('todo')"><i class="ti ti-checkbox"></i> Todo로 이동</div>
        </div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">2</div>
        <div class="kcard-title">업무 맥락 & 결정사항 이해</div>
        <div class="kcard-sub">왜 이런 결정을 했는지 · 현재 상태 · 내가 할 것</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-why"><i class="ti ti-info-circle" style="font-size:13px;flex-shrink:0"></i><div><strong>왜 pgvector를 쓰는가:</strong> 문서·권한·업무 객체와 벡터 검색을 PostgreSQL에서 일관되게 관리합니다.</div></div>
        <div class="kb-now"><i class="ti ti-alert-triangle" style="font-size:13px;flex-shrink:0"></i><div><strong>현재 상태:</strong> Markdown 원문을 제목 단위로 청킹하고 프로젝트 범위에서 유사 문서를 검색합니다.</div></div>
        <div class="kb-next"><i class="ti ti-arrow-right" style="font-size:13px;flex-shrink:0"></i><div><strong>내가 먼저 할 것:</strong> ai_interface.py의 analyze_document() 확인 → FastAPI /documents/upload에 연결.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">핵심 참고 문서 (AI 추출)</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>handover_2026_05_13.txt — 기술스택·아키텍처 전반</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>project_status_2026_05_14.txt — 현재 이슈·TODO</div>
        <div class="kb-item"><i class="ti ti-file-text"></i>issue_log_20260514_azure_timeout.txt — 미해결 이슈</div>
        <div style="margin-top:10px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 맥락 브리핑 문서 생성</div></div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">3</div>
        <div class="kcard-title">개발 환경 접근 권한 확인</div>
        <div class="kcard-sub">즉시 업무 시작을 위한 환경 세팅</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-now"><i class="ti ti-alert-triangle" style="font-size:13px;flex-shrink:0"></i><div><strong>확인 필요:</strong> .env 파일의 API 키가 유효한지 확인하세요. 퇴직/변경 시 키 재발급이 필요할 수 있습니다.</div></div>
        <div style="font-size:11px;font-weight:500;color:var(--text);margin:8px 0 6px">환경 세팅 체크리스트</div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">GitHub SeongWoo 브랜치 클론 및 접근 확인</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">pip install -r requirements.txt 완료</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">.env 파일 API 키 유효성 확인</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">pgvector 임베딩 적재 상태 확인</div></div>
        <div class="checklist-item"><div class="cl-box"></div><div class="cl-text" style="flex:1">python -m app.ai.retriever 로 검색 테스트</div></div>
      </div>
    </div>

    <div class="kcard">
      <div class="kcard-hd">
        <div style="width:28px;height:28px;border-radius:50%;background:var(--surface2);color:var(--text3);border:2px solid var(--border2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;flex-shrink:0">4</div>
        <div class="kcard-title">인수 완료 확인</div>
        <div class="kcard-sub">AI가 파악 현황을 자동 점검</div>
        <i class="ti ti-chevron-down kcard-arrow"></i>
      </div>
      <div class="kcard-body">
        <div class="kb-next"><i class="ti ti-arrow-right" style="font-size:13px;flex-shrink:0"></i><div>AI가 인수 파악 완성도를 자동 평가합니다. 놓친 업무·이슈가 있으면 추가로 안내합니다.</div></div>
        <div style="margin-top:10px"><div class="tbtn primary" style="font-size:11px"><i class="ti ti-wand"></i> 인수 완성도 평가</div></div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════
// 공통 유틸
// ════════════════════════════════════════════════
function closeModal(id){document.getElementById(id).classList.remove('show');}
function openModal(id){document.getElementById(id).classList.add('show');}
function showTransition(msg){document.getElementById('transitionMsg').textContent=msg;document.getElementById('transition').classList.add('show');}
function hideTransition(){document.getElementById('transition').classList.remove('show');}

function showToast(msg,type='success'){
  const toast=document.getElementById('toast');const icon=document.getElementById('toastIcon');
  document.getElementById('toastMsg').textContent=msg;
  icon.className=`ti ${type==='success'?'ti-check':type==='warn'?'ti-x':'ti-info-circle'}`;
  icon.style.color=type==='success'?'var(--success)':type==='warn'?'var(--danger)':'var(--accent)';
  toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),2800);
}

// ════════════════════════════════════════════════
// UX 개선 1 — 플로팅 AI 버튼
// ════════════════════════════════════════════════
const floatCtx = {
  dashboard: { label:'Dashboard 기반으로 답변합니다.', qs:['현재 가장 위험한 이슈는?','이번 주 마감 현황 알려줘','팀원 부재 확인해줘'] },
  analysis:  { label:'운영 로그 분석 화면입니다.', qs:['분석된 파일 요약해줘','추출된 이슈 설명해줘'] },
  todo:      { label:'Todo 화면 기반으로 답변합니다.', qs:['내 Todo 요약해줘','승인 대기 Todo 알려줘','가장 급한 Todo는?'] },
  issues:    { label:'이슈 로그 기반으로 답변합니다.', qs:['미해결 이슈 요약해줘','담당자 미지정 이슈는?','High Risk 이슈 알려줘'] },
  calendar:  { label:'캘린더 기반으로 답변합니다.', qs:['이번 달 리스크 구간 알려줘','부재 일정 추가해줘'] },
  knowledge: { label:'인수인계 센터 기반입니다.', qs:['인수인계 문서 생성해줘','부재자 업무 이관 도와줘'] },
  reports:   { label:'보고서 화면입니다.', qs:['주간 보고서 초안 생성해줘','이번 주 운영 요약해줘'] },
  chat:      { label:'AI Assistant 화면입니다.', qs:['WorkRader 사용법 알려줘'] },
};

function toggleFloatAI() {
  const panel = document.getElementById('floatPanel');
  panel.classList.toggle('show');
  if (panel.classList.contains('show')) {
    const ctx = floatCtx[G.currentScreen] || floatCtx.dashboard;
    document.getElementById('floatCtxLabel').textContent = ctx.label;
    document.getElementById('floatSuggestions').innerHTML =
      ctx.qs.map(q => `<button class="float-sq" onclick="floatAsk('${q}')">${q}</button>`).join('');
  }
}

function floatAsk(q) {
  document.getElementById('floatPanel').classList.remove('show');
  nav('chat');
  setTimeout(() => sendMsg(q), 100);
}

function floatSend() {
  const val = document.getElementById('floatInput').value.trim();
  if (!val) return;
  document.getElementById('floatInput').value = '';
  document.getElementById('floatPanel').classList.remove('show');
  nav('chat');
  setTimeout(() => sendMsg(val), 100);
}

// ════════════════════════════════════════════════
// UX 개선 2 — 알림 센터
// ════════════════════════════════════════════════
const notifications = [];

function toggleNotif() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('show');
  document.getElementById('floatPanel').classList.remove('show');
  document.getElementById('notifDot').style.display = 'none';
}

function clearNotifs() {
  notifications.length = 0;
  renderNotifs();
}

function addNotif(msg, type='info', actionFnStr) {
  notifications.unshift({ msg, type, actionFnStr, time: Date.now() });
  renderNotifs();
  const dot = document.getElementById('notifDot');
  if (dot) dot.style.display = 'block';
}

function renderNotifs() {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (!notifications.length) {
    list.innerHTML = `<div style="padding:20px;text-align:center;font-size:12px;color:var(--text3)"><i class="ti ti-bell" style="font-size:24px;display:block;margin-bottom:8px"></i>아직 알림이 없습니다.</div>`;
    return;
  }
  const iconMap = { success:'ti-check', warn:'ti-alert-triangle', info:'ti-sparkles', danger:'ti-x' };
  const clsMap  = { success:'ni-success', warn:'ni-warn', info:'ni-info', danger:'ni-warn' };
  const timeStr = t => {
    const m = Math.floor((Date.now()-t)/60000);
    return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.floor(m/60)}시간 전`;
  };
  list.innerHTML = notifications.map(n => `
    <div class="notif-item">
      <div class="notif-icon ${clsMap[n.type]||'ni-info'}"><i class="ti ${iconMap[n.type]||'ti-sparkles'}" style="font-size:13px"></i></div>
      <div class="notif-body">
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-time">${timeStr(n.time)}</div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════════════════
// UX 개선 3 — Todo 카드뷰 토글
// ════════════════════════════════════════════════
let todoViewMode = 'table';

function switchTodoView(mode) {
  todoViewMode = mode;
  document.getElementById('vt-table').classList.toggle('active', mode==='table');
  document.getElementById('vt-card').classList.toggle('active', mode==='card');
  document.getElementById('todoTableView').style.display = mode==='table' ? 'flex' : 'none';
  document.getElementById('todoCardView').style.display  = mode==='card'  ? 'block' : 'none';
  if (mode === 'card') renderTodoCards();
}

function renderTodoCards() {
  const filtered = getFilteredTodos();
  const paged = todoPageItems(filtered);
  const grid = document.getElementById('todoCardGrid');
  if (!filtered.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text3);font-size:12px"><i class="ti ti-checkbox" style="font-size:28px;display:block;margin-bottom:8px"></i>이 탭에 항목이 없습니다.</div>`;
    return;
  }
  grid.innerHTML = paged.map(t => `
    <div class="todo-card ${G.selectedTodoId===t.id?'selected':''}" onclick="selectTodo(${t.id})">
      <div class="todo-card-meta">
        ${G.currentTodoTab==='ai'?'':`<span class="badge b-gray">등록 ${formatTodoCreatedAt(t.createdAt)}</span>`}
        ${G.currentTodoTab==='inprogress'?`<span class="badge b-gray">수정 ${formatTodoCreatedAt(t.updatedAt)}</span>`:''}
        ${statusB(t.status)}
        ${t.confidence!==null?`<span style="font-size:10px;font-family:var(--mono);color:${confC(t.confidence)}">${t.confidence}%</span>`:''}
      </div>
      <div class="todo-card-title">${escapeHtml(cleanTodoTitle(t.title))}</div>
      ${t.src?`<div class="todo-card-src">${t.src}${t.srcChunk?' · '+t.srcChunk:''}</div>`:''}
      <div style="font-size:10px;color:var(--text3);margin-bottom:8px">${t.assignee||'담당자 미지정'}</div>
      <div class="todo-card-actions">
        ${t.status==='pending'
          ? `<div class="ab ab-approve" onclick="event.stopPropagation();approveTodo(${t.id})">승인</div><div class="ab ab-reject" onclick="event.stopPropagation();rejectTodo(${t.id})" style="margin-left:auto">반려</div>`
          : t.status==='approved'
          ? `<div class="ab" style="background:var(--success);color:#fff;border-color:var(--success)" onclick="event.stopPropagation();doneTodo(${t.id})">완료</div><div class="ab ab-undo" onclick="event.stopPropagation();undoTodo(${t.id})" style="margin-left:auto">↩</div>`
          : `<div class="ab ab-undo" onclick="event.stopPropagation();undoTodo(${t.id})">↩ 되돌리기</div>`}
      </div>
    </div>`).join('');
}

function emitTodoReactEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function emitTodoRefresh(reason = 'compat') {
  emitTodoReactEvent('opsradar:todo-refresh', { reason });
}

window.opsRadarTodoBridge = {
  getSnapshot() {
    return {
      todos: todos.map((todo) => ({ ...todo })),
      G: {
        currentTodoTab: G.currentTodoTab,
        selectedTodoId: G.selectedTodoId,
        todoChecked: { ...G.todoChecked },
        todoSearch: { ...G.todoSearch },
        todoSearchField: { ...G.todoSearchField },
        todoPage: { ...G.todoPage },
      },
      viewMode: todoViewMode,
    };
  },
  setTab(tab) {
    G.currentTodoTab = tab;
    G.todoPage[tab] = 1;
    G.selectedTodoId = null;
  },
  setViewMode(mode) {
    todoViewMode = mode;
  },
  setSearch(value) {
    G.todoSearch[G.currentTodoTab] = value;
    G.todoPage[G.currentTodoTab] = 1;
  },
  setSearchField(value) {
    G.todoSearchField[G.currentTodoTab] = value;
    G.todoPage[G.currentTodoTab] = 1;
  },
  setPage(page) {
    G.todoPage[G.currentTodoTab] = page;
  },
  selectTodo(id) {
    G.selectedTodoId = id;
  },
  toggleCheck(id, checked) {
    G.todoChecked[id] = checked;
  },
  toggleAll(ids, checked) {
    ids.forEach((id) => { G.todoChecked[id] = checked; });
  },
};

window.renderTodos = renderTodos = function renderTodosCompat() {
  emitTodoRefresh('renderTodos');
};
window.renderTodoCards = renderTodoCards = function renderTodoCardsCompat() {
  emitTodoRefresh('renderTodoCards');
};
window.renderTodoDetail = renderTodoDetail = function renderTodoDetailCompat(id) {
  G.selectedTodoId = id;
  emitTodoReactEvent('opsradar:todo-select', { id });
  emitTodoRefresh('renderTodoDetail');
};
window.selectTodo = selectTodo = function selectTodoCompat(id) {
  G.selectedTodoId = id;
  emitTodoReactEvent('opsradar:todo-select', { id });
  emitTodoRefresh('selectTodo');
};
window.switchTodoView = switchTodoView = function switchTodoViewCompat(mode) {
  todoViewMode = mode;
  emitTodoReactEvent('opsradar:todo-view-change', { mode });
  emitTodoRefresh('switchTodoView');
};
window.setTodoSearch = setTodoSearch = function setTodoSearchCompat(value) {
  G.todoSearch[G.currentTodoTab] = value;
  G.todoPage[G.currentTodoTab] = 1;
  emitTodoRefresh('setTodoSearch');
};
window.setTodoSearchField = setTodoSearchField = function setTodoSearchFieldCompat(value) {
  G.todoSearchField[G.currentTodoTab] = value;
  G.todoPage[G.currentTodoTab] = 1;
  emitTodoRefresh('setTodoSearchField');
};
window.setTodoPage = setTodoPage = function setTodoPageCompat(page) {
  G.todoPage[G.currentTodoTab] = page;
  emitTodoRefresh('setTodoPage');
};
window.toggleTodoCheck = toggleTodoCheck = function toggleTodoCheckCompat(event, id, fromCheckbox = false) {
  const checked = fromCheckbox && event?.target ? event.target.checked : !G.todoChecked[id];
  G.todoChecked[id] = checked;
  if (fromCheckbox) event.stopPropagation();
  emitTodoRefresh('toggleTodoCheck');
};
window.toggleAllChk = toggleAllChk = function toggleAllChkCompat(el) {
  const filtered = todoPageItems(getFilteredTodos());
  filtered.forEach((todo) => { G.todoChecked[todo.id] = !!el.checked; });
  emitTodoRefresh('toggleAllChk');
};
window.switchTodoTab = switchTodoTab = function switchTodoTabCompat(tab) {
  G.currentTodoTab = tab;
  G.todoPage[tab] = 1;
  G.selectedTodoId = null;
  emitTodoReactEvent('opsradar:todo-tab-change', { tabId: tab });
  emitTodoRefresh('switchTodoTab');
};

// ════════════════════════════════════════════════
// UX 개선 4, 5, 6 — 배너 / 알림 트리거
// ════════════════════════════════════════════════
function showCtxBanner(screenId, msg) {
  const banner = document.getElementById(screenId+'ctxBanner');
  if (!banner) return;
  const textEl = document.getElementById(screenId+'ctxText');
  if (textEl) textEl.textContent = msg;
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 5000);
}

// ── 초기화
renderCalendar();
updateTodoCounts();

// 캘린더 AI 추천 일정 모달
function openAISuggestModal() {
  document.getElementById('aiSuggestModal').classList.add('show');
}

function addAISuggestEvent(title, reason) {
  closeModal('aiSuggestModal');
  const d = new Date(); d.setDate(d.getDate() + 2);
  const calDate = d.getDate();
  const ev = G.calEvents.find(e => e.d === calDate);
  const tag = { t: title, c: 'ct-info' };
  if (ev) ev.tags.push(tag);
  else G.calEvents.push({ d: calDate, tags: [tag] });
  G.newCalEvents.push({ person: title, date: `5/${calDate}`, type: '회의', impact: reason, calDate });
  renderCalendar();
  document.getElementById('calBadge').style.display = 'inline-block';
  addNotif(`"${title}" 일정이 캘린더에 추가되었습니다. 출처: ${reason}`, 'success');
  showToast(`✅ "${title}" 캘린더에 등록되었습니다.`, 'success');
}


// Calendar month navigation repair
function ensureCalendarState(){
  const now = new Date();
  if(typeof G.currentCalYear !== 'number') G.currentCalYear = now.getFullYear();
  if(typeof G.currentCalMonth !== 'number') G.currentCalMonth = now.getMonth();
}
function eventMatchesMonth(ev, year, month){
  if(!ev) return false;
  const evYear = typeof ev.y === 'number' ? ev.y : (typeof ev.year === 'number' ? ev.year : G.currentCalYear);
  const rawMonth = typeof ev.m === 'number' ? ev.m : (typeof ev.month === 'number' ? ev.month : G.currentCalMonth);
  const evMonth = rawMonth > 11 ? rawMonth - 1 : rawMonth;
  return evYear === year && evMonth === month;
}
function filterEventsByMonth(year, month){
  ensureCalendarState();
  const y = typeof year === 'number' ? year : G.currentCalYear;
  const m = typeof month === 'number' ? month : G.currentCalMonth;
  return (G.calEvents || []).filter(ev => eventMatchesMonth(ev, y, m));
}
function findCalEventForDay(day, year, month){
  const y = typeof year === 'number' ? year : G.currentCalYear;
  const m = typeof month === 'number' ? month : G.currentCalMonth;
  return (G.calEvents || []).find(ev => ev.d === day && eventMatchesMonth(ev, y, m));
}
function findNewCalEventForDay(day, year, month){
  const y = typeof year === 'number' ? year : G.currentCalYear;
  const m = typeof month === 'number' ? month : G.currentCalMonth;
  return (G.newCalEvents || []).some(ev => {
    const evYear = typeof ev.y === 'number' ? ev.y : G.currentCalYear;
    const rawMonth = typeof ev.m === 'number' ? ev.m : G.currentCalMonth;
    const evMonth = rawMonth > 11 ? rawMonth - 1 : rawMonth;
    return ev.calDate === day && evYear === y && evMonth === m;
  });
}
function updateCalendarHeader(){
  ensureCalendarState();
  const wrap = document.querySelector('#s-calendar .topbar > div:last-child');
  if(!wrap) return;
  const buttons = Array.from(wrap.querySelectorAll('.tbtn'));
  const prevBtn = document.getElementById('calPrevBtn') || buttons.find(btn => btn.textContent.includes('←')) || buttons[1];
  const nextBtn = document.getElementById('calNextBtn') || buttons.find(btn => btn.textContent.includes('→')) || buttons[2];
  const title = document.getElementById('calMonthTitle') || wrap.querySelector('.chip');
  const prevDate = new Date(G.currentCalYear, G.currentCalMonth - 1, 1);
  const nextDate = new Date(G.currentCalYear, G.currentCalMonth + 1, 1);
  if(prevBtn){ prevBtn.id = 'calPrevBtn'; prevBtn.textContent = `← ${prevDate.getMonth() + 1}월`; prevBtn.onclick = goToPrevMonth; prevBtn.setAttribute('role','button'); prevBtn.setAttribute('tabindex','0'); }
  if(nextBtn){ nextBtn.id = 'calNextBtn'; nextBtn.textContent = `${nextDate.getMonth() + 1}월 →`; nextBtn.onclick = goToNextMonth; nextBtn.setAttribute('role','button'); nextBtn.setAttribute('tabindex','0'); }
  if(title){ title.id = 'calMonthTitle'; title.textContent = `${G.currentCalYear}년 ${G.currentCalMonth + 1}월`; }
}
function renderCalendar(year, month){
  ensureCalendarState();
  if(typeof year === 'number') G.currentCalYear = year;
  if(typeof month === 'number') G.currentCalMonth = month > 11 ? month - 1 : month;
  const grid = document.getElementById('calGrid');
  if(!grid) return;
  grid.querySelectorAll('.cal-cell').forEach(c => c.remove());
  updateCalendarHeader();
  const yearValue = G.currentCalYear;
  const monthValue = G.currentCalMonth;
  const firstDay = new Date(yearValue, monthValue, 1).getDay();
  const lastDate = new Date(yearValue, monthValue + 1, 0).getDate();
  const prevLastDate = new Date(yearValue, monthValue, 0).getDate();
  const today = new Date();
  for(let i = firstDay - 1; i >= 0; i--){
    const div = document.createElement('div'); div.className = 'cal-cell other'; div.innerHTML = `<div class="cal-date">${prevLastDate - i}</div>`; grid.appendChild(div);
  }
  for(let d = 1; d <= lastDate; d++){
    const ev = findCalEventForDay(d, yearValue, monthValue);
    const isNew = findNewCalEventForDay(d, yearValue, monthValue);
    const isSelected = G.selectedCalDay === d;
    const isToday = today.getFullYear() === yearValue && today.getMonth() === monthValue && today.getDate() === d;
    const div = document.createElement('div');
    div.className = `cal-cell${(ev && ev.today) || isToday ? ' today' : ''}${ev && ev.risk ? ' risk' : ''}${isNew ? ' new-event' : ''}${isSelected ? ' cal-selected' : ''}`;
    div.innerHTML = `<div class="cal-date">${d}</div><div class="cal-tags">${ev && ev.tags ? ev.tags.map(t => `<span class="cal-tag ${t.c}">${t.t}</span>`).join('') : ''}</div>${ev && ev.risk ? '<div class="risk-dot"></div>' : ''}`;
    div.addEventListener('click', () => openCalModal(d));
    grid.appendChild(div);
  }
  const renderedCells = firstDay + lastDate;
  const trailing = (Math.ceil(renderedCells / 7) * 7) - renderedCells;
  for(let x = 1; x <= trailing; x++){
    const div = document.createElement('div'); div.className = 'cal-cell other'; div.innerHTML = `<div class="cal-date">${x}</div>`; grid.appendChild(div);
  }
}
function goToPrevMonth(){
  ensureCalendarState();
  G.currentCalMonth -= 1;
  if(G.currentCalMonth < 0){ G.currentCalMonth = 11; G.currentCalYear -= 1; }
  G.selectedCalDay = null;
  renderCalendar(G.currentCalYear, G.currentCalMonth);
}
function goToNextMonth(){
  ensureCalendarState();
  G.currentCalMonth += 1;
  if(G.currentCalMonth > 11){ G.currentCalMonth = 0; G.currentCalYear += 1; }
  G.selectedCalDay = null;
  renderCalendar(G.currentCalYear, G.currentCalMonth);
}
function openCalModal(d) {
  ensureCalendarState();
  G.selectedCalDay = d;
  renderCalendar(G.currentCalYear, G.currentCalMonth);
  const ev = findCalEventForDay(d, G.currentCalYear, G.currentCalMonth);
  const tags = ev && ev.tags ? ev.tags : [];
  const modalDate = document.getElementById('calModalDate');
  if(modalDate) modalDate.textContent = `${G.currentCalYear}년 ${G.currentCalMonth + 1}월 ${d}일`;
  const list = document.getElementById('calModalList');
  if(list){
    list.innerHTML = tags.length ? tags.map((t, i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius-sm)"><span class="cal-tag ${t.c}" style="flex:1">${t.t}</span><div onclick="deleteCalTag(${d},${i})" style="cursor:pointer;color:var(--text3);font-size:14px;padding:2px 6px;border-radius:4px;border:1px solid var(--border)" title="삭제">×</div></div>`).join('') : `<div style="font-size:11px;color:var(--text3);text-align:center;padding:16px 0">등록된 일정이 없습니다.</div>`;
  }
  const input = document.getElementById('calModalInput'); if(input) input.value = '';
  calSelectedColor = 'ct-info';
  const dot = document.getElementById('calColorDot'); if(dot) dot.style.background = 'var(--accent)';
  const label = document.getElementById('calColorLabel'); if(label) label.textContent = '일반';
  openModal('calModal');
}
async function addCalTag() {
  ensureCalendarState();
  const d = G.selectedCalDay;
  const input = document.getElementById('calModalInput');
  const text = input ? input.value.trim() : '';
  const color = calSelectedColor || 'ct-info';
  if (!text || !d) return;
  if(!window.opsRadarCreateCalendarEvent || !window.opsRadarApi){
    showToast('DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.','warn');
    return;
  }
  try{
    await window.opsRadarCreateCalendarEvent({
      title:text,
      day:d,
      year:G.currentCalYear,
      month:G.currentCalMonth,
      color
    });

    await window.opsRadarApi.loadCalendar();
    renderCalendar(G.currentCalYear, G.currentCalMonth);
    openCalModal(d);
    showToast(`${G.currentCalMonth + 1}월 ${d}일 일정이 DB에 추가되었습니다.`, 'info');
  }catch(error){
    console.warn('Calendar create API failed',error);
    showToast('캘린더 등록에 실패했습니다.','warn');
  }
}
async function deleteCalTag(d, idx) {
  ensureCalendarState();

  const ev = findCalEventForDay(d, G.currentCalYear, G.currentCalMonth);
  if (!ev) return;
  const tag = ev.tags[idx];

  try{
    if(tag?.apiId){
      if(!window.opsRadarApi){
        showToast('DB 연결을 준비 중입니다. 잠시 후 다시 시도해주세요.','warn');
        return;
      }

      await window.opsRadarApi.request(`/calendar/${tag.apiId}`,{method:'DELETE'});
      await window.opsRadarApi.loadCalendar();
    }else{
      ev.tags.splice(idx,1);
      if(ev.tags.length === 0){
        G.calEvents = G.calEvents.filter(e => e !== ev);
      }
    }

    renderCalendar(G.currentCalYear,G.currentCalMonth);
    openCalModal(d);
    showToast('일정이 삭제되었습니다.','info');
  }catch(error){
    console.warn('Calendar delete API failed',error);
    showToast('캘린더 삭제에 실패했습니다.','warn');
  }
}
function registerCalEvent(parsed, calDate){
  ensureCalendarState();
  if(calDate){
    const ex = findCalEventForDay(calDate, G.currentCalYear, G.currentCalMonth);
    const nt = {t:`${parsed.person} ${parsed.type}`, c:'ct-new'};
    if(ex) ex.tags.push(nt); else G.calEvents.push({d:calDate, y:G.currentCalYear, m:G.currentCalMonth, tags:[nt]});
    G.newCalEvents.push({...parsed, calDate, y:G.currentCalYear, m:G.currentCalMonth});
  }
  const badge = document.getElementById('calBadge'); if(badge) badge.style.display='inline-block';
  if(G.currentScreen === 'calendar') renderCalendar(G.currentCalYear, G.currentCalMonth);
}
function addAISuggestEvent(title, reason) {
  ensureCalendarState();
  closeModal('aiSuggestModal');
  const calDate = Math.min(new Date().getDate() + 2, new Date(G.currentCalYear, G.currentCalMonth + 1, 0).getDate());
  const ev = findCalEventForDay(calDate, G.currentCalYear, G.currentCalMonth);
  const tag = { t: title, c: 'ct-info' };
  if (ev) ev.tags.push(tag); else G.calEvents.push({ d: calDate, y: G.currentCalYear, m: G.currentCalMonth, tags: [tag] });
  G.newCalEvents.push({ person: title, date: `${G.currentCalMonth + 1}/${calDate}`, type: '회의', impact: reason, calDate, y: G.currentCalYear, m: G.currentCalMonth });
  renderCalendar(G.currentCalYear, G.currentCalMonth);
  const badge = document.getElementById('calBadge'); if(badge) badge.style.display = 'inline-block';
  addNotif(`"${title}" 일정이 캘린더에 추가되었습니다. 출처: ${reason}`, 'success');
  showToast(`"${title}" 캘린더에 등록되었습니다.`, 'success');
}
function initCalendarMonthControls(){
  ensureCalendarState();
  updateCalendarHeader();
  const prevBtn = document.getElementById('calPrevBtn');
  const nextBtn = document.getElementById('calNextBtn');
  [prevBtn, nextBtn].forEach(btn => {
    if(!btn || btn.dataset.calendarKeyBound === 'true') return;
    btn.dataset.calendarKeyBound = 'true';
    btn.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); } });
  });
}
window.goToPrevMonth = goToPrevMonth;
window.goToNextMonth = goToNextMonth;
window.renderCalendar = renderCalendar;
window.filterEventsByMonth = filterEventsByMonth;
setTimeout(() => { initCalendarMonthControls(); renderCalendar(); }, 0);
function initCalendarModalOverlayClose(){
  const overlay = document.getElementById('calModal');
  if(!overlay || overlay.dataset.overlayCloseBound === 'true') return;
  overlay.dataset.overlayCloseBound = 'true';
  overlay.addEventListener('click', function(event){
    if(event.target === overlay){
      closeModal('calModal');
      G.selectedCalDay = null;
      renderCalendar();
    }
  });
  const modalContent = overlay.querySelector('.modal');
  if(modalContent){
    modalContent.addEventListener('click', function(event){
      event.stopPropagation();
    });
  }
}
setTimeout(initCalendarModalOverlayClose, 0);
setTimeout(initDocumentGenerationActions, 0);
setTimeout(bindRemainingActionButtons, 0);


// Handover center button and action repair
const HANDOFF_TYPES = ['onboarding','absence','offboard'];
const HANDOFF_FLOW_TYPE = { project:'briefing' };
const HANDOFF_LABELS = {
  onboarding:'신규 입사자 온보딩',
  absence:'부재자 업무 인수인계',
  offboard:'담당자 변경/퇴직 인수인계',

};
function normalizeHandoffType(type){
  if(type === 'briefing') return 'project';
  return HANDOFF_TYPES.includes(type) ? type : 'onboarding';
}
function getHandoffRenderType(type){
  const selected = normalizeHandoffType(type);
  return HANDOFF_FLOW_TYPE[selected] || selected;
}
function selectHandoffType(type){
  selectKnowledgeType(type);
}
function selectKnowledgeType(type) {
  const selected = normalizeHandoffType(type);
  G.currentKnowledgeType = selected;
  currentKType = selected;
  HANDOFF_TYPES.forEach(t => {
    const btn = document.getElementById('kbtn-' + t);
    if (!btn) return;
    btn.classList.toggle('active', t === selected);
    btn.removeAttribute('style');
    if (t === selected) {
      btn.style.background = 'var(--accent-soft)';
      btn.style.color = 'var(--accent)';
      btn.style.borderColor = 'var(--accent)';
    }
  });
  renderKnowledgeFlow(getHandoffRenderType(selected));
  setTimeout(bindHandoffCenterButtons, 0);
}
function getHandoffPreviewData(type){
  const selected = normalizeHandoffType(type || G.currentKnowledgeType || 'onboarding');
  const generatedAt = new Date().toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' });
  const map = {
    onboarding: {
      title:'신규 입사자 온보딩 브리핑', target:'신규 입사자 온보딩',
      sections:[
        ['프로젝트 개요','WorkRader는 운영 로그, Todo, Risk, Calendar, 인수인계 문맥을 AI가 연결해 운영 상태를 추론하는 SaaS형 운영 인텔리전스 시스템입니다.'],
        ['현재 운영 상태','결제 API 장기 미해결, Blocked Todo 누적, 승인 대기 항목이 핵심 관찰 지점입니다.'],
        ['최근 주요 이슈','운영 이벤트, 운영 리스크, Risk 데이터 없음가 반복적으로 관찰됩니다.'],
        ['우선 확인해야 할 문서','연결된 문서가 없습니다.'],
        ['첫 업무 시작 가이드','Dashboard의 High Risk 카드 확인 → 내 Todo 확인 → 관련 출처 문서 확인 → 담당자에게 상태 공유 순서로 시작하세요.']
      ]
    },
    absence: {
      title:'부재자 업무 인수인계', target:'부재자 업무 인수인계',
      sections:[
        ['현재 진행 업무','결제 API 대응 Todo 2건과 등록된 우선 작업 없음 작업이 진행 중입니다.'],
        ['긴급 대응 필요 항목','운영 데이터 확인, DB connection pool 임계치 조정, 배포 실패 원인 재점검이 필요합니다.'],
        ['승인 대기 건','AI 생성 Todo 0건, 승인 대기 항목 0건이 승인 대기 중입니다.'],
        ['이번 주 일정','수요일 등록된 일정 없음, 금요일 P1 리스크 점검이 예정되어 있습니다.'],
        ['주의사항','부재 기간에는 High Risk owner가 불명확해질 수 있으므로 승인 대기 Todo를 먼저 정리하세요.']
      ]
    },
    offboard: {
      title:'담당자 변경/퇴직 인수인계', target:'담당자 변경·퇴직 인수인계',
      sections:[
        ['장기 진행 업무','운영 로그 분석 정확도 개선, RAG 근거 연결, 배포 자동화 안정화가 장기 진행 중입니다.'],
        ['반복 발생 이슈','릴리즈 직전 승인 지연, 야간 브리핑 누락, 외부 운영 이벤트이 반복됩니다.'],
        ['암묵적 운영 룰','장애성 이슈는 Todo 승인 전에도 캘린더 리스크 일정으로 먼저 등록합니다.'],
        ['미완료 Risk','결제 API 백업 경로 검토와 QA 자동화 적용이 아직 완료되지 않았습니다.'],
        ['핵심 참고 문서','연결된 문서가 없습니다.']
      ]
    },
    project: {
      title:'프로젝트 운영 브리핑', target:'프로젝트 브리핑',
      sections:[
        ['현재 프로젝트 상태','Dashboard, Todo, Risk, Calendar, 인수인계, AI Assistant 화면의 핵심 데모 흐름이 연결된 상태입니다.'],
        ['최근 의사결정','운영 관제 중심 UX를 유지하고, AI 판단 근거는 태그와 출처 카드로 분리해 신뢰도를 높이는 방향으로 정리했습니다.'],
        ['주요 Risk','Risk 데이터 없음, Risk 데이터 없음, Risk 데이터 없음가 프로젝트 리스크로 관리됩니다.'],
        ['다음 액션','캘린더 일정 CRUD 점검, 인수인계 문서 생성 API 연결 준비, 보고서 저장 API 연동을 우선 처리합니다.'],
        ['관련 문서','figma_dashboard_notes.md, opsradar_front_prototype.html, api_contract_draft.md']
      ]
    },
    emergency: {
      title:'긴급 상황 브리핑', target:'긴급 상황 브리핑',
      sections:[
        ['발생 이슈','Azure OpenAI 운영 이벤트과 Risk 데이터 없음이 동시에 감지되었습니다.'],
        ['영향 범위','AI Assistant 응답 지연, Todo 자동 생성 지연, 결제 완료율 하락 가능성이 있습니다.'],
        ['우선 대응 Todo','API 재시도 로직 확인, 백업 엔드포인트 점검, 등록된 Todo 없음를 즉시 실행합니다.'],
        ['담당자','PM 관리자, Backend 이성우, Infra 박주원가 1차 대응 담당입니다.'],
        ['즉시 확인할 문서','incident_runbook.md, azure_timeout_log_0529.json, payment_api_health.csv']
      ]
    }
  };
  const data = map[selected] || map.onboarding;
  if(!data.sections.some(s => s[0] === '생성일')) data.sections.push(['생성일', generatedAt]);
  G.currentHandoffDraft = data;
  return data;
}
function openHandoffPreview(type){
  return generateHandoffPreview(type || G.currentKnowledgeType || 'onboarding');
}
function generateHandoffPreview(type){
  const selected = normalizeHandoffType(type || G.currentKnowledgeType || 'onboarding');
  G.currentKnowledgeType = selected;
  const data = getHandoffPreviewData(selected);
  renderHandoffPreview(data);
  showToast(`${HANDOFF_LABELS[selected]} 미리보기를 생성했습니다.`, 'success');
  return data;
}
function renderHandoffPreview(data){
  const body = data.sections.map(([label,value]) => `
    <div class="handoff-preview-row">
      <div class="handoff-preview-label text-content">${escapeHtml(label)}</div>
      <div class="handoff-preview-value text-content">${escapeHtml(value)}</div>
    </div>`).join('');
  let panel = document.getElementById('handoffPreviewPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'handoffPreviewPanel';
    panel.className = 'handoff-slide-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <div class="handoff-slide-backdrop" onclick="closeHandoffPreview()"></div>
    <aside class="handoff-slide-sheet" role="dialog" aria-modal="true" aria-label="인수인계 문서 미리보기" onclick="event.stopPropagation()">
      <div class="handoff-slide-head">
        <div>
          <div class="handoff-preview-eyebrow">AI GENERATED PREVIEW</div>
          <div class="handoff-preview-title text-content">${escapeHtml(data.title)}</div>
        </div>
        <button class="handoff-slide-close" onclick="closeHandoffPreview()" aria-label="닫기"><i class="ti ti-x"></i></button>
      </div>
      <div class="handoff-slide-meta"><span class="badge b-accent text-content">${escapeHtml(data.target)}</span><span><i class="ti ti-clock"></i> ${new Date().toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' })}</span></div>
      <div class="handoff-slide-body"><div class="handoff-preview-body">${body}</div></div>
      <div class="handoff-slide-actions">
        <div class="tbtn" onclick="editHandoffDraft()"><i class="ti ti-pencil"></i> 수정하기</div>
        <div class="tbtn" onclick="shareHandoffDraft()"><i class="ti ti-share"></i> 공유하기</div>
        <div class="tbtn" onclick="generateHandoffPreview(G.currentKnowledgeType || 'onboarding')"><i class="ti ti-refresh"></i> 다시 생성</div>
        <div class="tbtn primary" onclick="saveHandoffDraft()"><i class="ti ti-device-floppy"></i> 초안 저장</div>
      </div>
    </aside>`;
  requestAnimationFrame(() => panel.classList.add('show'));
}
function closeHandoffPreview(){
  const panel = document.getElementById('handoffPreviewPanel');
  if(panel) panel.classList.remove('show');
}
function saveHandoffDraft(){
  if(!G.currentHandoffDraft) G.currentHandoffDraft = getHandoffPreviewData(G.currentKnowledgeType || 'onboarding');
  G.savedHandoffDraft = { ...G.currentHandoffDraft, savedAt:new Date().toISOString() };
  showToast('인수인계 초안을 임시 저장했습니다.', 'success');
}
function editHandoffDraft(){
  showToast('미리보기 패널에서 내용을 검토한 뒤 편집 화면으로 연결할 수 있습니다.', 'info');
}
function shareHandoffDraft(){
  showToast('공유 링크를 생성했습니다. 실제 API 연결 전까지 mock 처리됩니다.', 'success');
}
function bindHandoffCenterButtons(){
  const screen = document.getElementById('s-knowledge');
  if(!screen) return;
  const previewButton = Array.from(screen.querySelectorAll('.tbtn,button')).find(btn => (btn.textContent || '').includes('문서 생성 미리보기'));
  if(previewButton && previewButton.dataset.handoffPreviewBound !== 'true'){
    previewButton.dataset.handoffPreviewBound = 'true';
    previewButton.addEventListener('click', () => openHandoffPreview(G.currentKnowledgeType || 'onboarding'));
  }
  Array.from(screen.querySelectorAll('.tbtn,button')).forEach(btn => {
    if(btn.dataset.handoffActionBound === 'true' || btn.onclick) return;
    const text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if(/브리핑 생성|문서 생성|상황 분석|대응 방안 생성|인수 완성도 평가/.test(text)){
      btn.dataset.handoffActionBound = 'true';
      btn.addEventListener('click', () => openHandoffPreview(G.currentKnowledgeType || 'onboarding'));
    }else if(/초안 저장|임시 저장|저장/.test(text)){
      btn.dataset.handoffActionBound = 'true';
      btn.addEventListener('click', saveHandoffDraft);
    }else if(/수정/.test(text)){
      btn.dataset.handoffActionBound = 'true';
      btn.addEventListener('click', editHandoffDraft);
    }else if(/공유/.test(text)){
      btn.dataset.handoffActionBound = 'true';
      btn.addEventListener('click', shareHandoffDraft);
    }else if(/닫기/.test(text)){
      btn.dataset.handoffActionBound = 'true';
      btn.addEventListener('click', closeHandoffPreview);
    }
  });
}
window.selectHandoffType = selectHandoffType;
window.selectKnowledgeType = selectKnowledgeType;
window.openHandoffPreview = openHandoffPreview;
window.generateHandoffPreview = generateHandoffPreview;
window.renderHandoffPreview = renderHandoffPreview;
window.closeHandoffPreview = closeHandoffPreview;
window.saveHandoffDraft = saveHandoffDraft;
window.editHandoffDraft = editHandoffDraft;
window.shareHandoffDraft = shareHandoffDraft;
setTimeout(() => { bindHandoffCenterButtons(); if(G.currentScreen === 'knowledge') selectKnowledgeType(G.currentKnowledgeType || 'onboarding'); }, 0);
function initHandoffPanelEventDelegation(){
  if(document.body.dataset.handoffPanelDelegationBound === 'true') return;
  document.body.dataset.handoffPanelDelegationBound = 'true';
  document.addEventListener('click', function(event){
    const panel = document.getElementById('handoffPreviewPanel');
    if(!panel || !panel.classList.contains('show')) return;
    const target = event.target;
    if(target === panel || target.classList?.contains('handoff-slide-backdrop')){
      event.preventDefault();
      event.stopPropagation();
      closeHandoffPreview();
      return;
    }
    if(target.closest?.('.handoff-slide-sheet') && !target.closest('.handoff-slide-actions')) return;
    const action = target.closest?.('#handoffPreviewPanel .handoff-slide-actions .tbtn, #handoffPreviewPanel .handoff-slide-close');
    if(!action) return;
    const text = (action.textContent || action.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if(text.includes('닫기')) closeHandoffPreview();
    else if(text.includes('수정')) editHandoffDraft();
    else if(text.includes('공유')) shareHandoffDraft();
    else if(text.includes('다시 생성')) generateHandoffPreview(G.currentKnowledgeType || 'onboarding');
    else if(text.includes('저장')) saveHandoffDraft();
  }, true);
}
setTimeout(initHandoffPanelEventDelegation, 0);
function formatOpsDate(style='long'){
  const today = new Date();
  if(style === 'short'){
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }
  return today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}
function renderCurrentDateLabels(){
  document.querySelectorAll('[data-current-date]').forEach(el => {
    el.textContent = formatOpsDate(el.dataset.currentDate || 'long');
  });
}
setTimeout(renderCurrentDateLabels, 0);
setTimeout(() => normalizeRenderedText(document.body), 0);
function setOpsRadarTheme(theme){
  const selected = theme === 'light' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', selected);
  document.body.setAttribute('data-skin', selected);
  try{
    localStorage.setItem('theme', selected);
    localStorage.setItem('opsradar-skin', selected);
  }catch(e){}
  document.querySelectorAll('[data-skin-choice]').forEach(btn => btn.classList.toggle('active', btn.dataset.skinChoice === selected));
  document.querySelectorAll('[data-theme-choice]').forEach(btn => btn.classList.toggle('active', btn.dataset.themeChoice === selected));
  const label = document.getElementById('settingsThemeLabel');
  if(label) label.textContent = selected === 'light' ? 'Light' : 'Dark';
}
function setOpsRadarSkin(skin){ setOpsRadarTheme(skin); }
function initOpsRadarSkin(){
  let saved = 'dark';
  try{ saved = localStorage.getItem('theme') || localStorage.getItem('opsradar-skin') || 'dark'; }catch(e){}
  setOpsRadarTheme(saved);
  updateSettingsPage();
}
function clearOpsRadarSession(){
  try{
    localStorage.removeItem('opsradar_user_role');
    localStorage.removeItem('opsradar_user_name');
    localStorage.removeItem('opsradar_user_id');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('opsradar_session');
    localStorage.removeItem('token');
    localStorage.removeItem('auth');
    sessionStorage.clear();
  }catch(e){}
}
function getStoredUserInfo(){
  let rawUser = null;
  let rawRole = null;
  let storedName = null;
  try{
    storedName = localStorage.getItem('opsradar_user_name');
    rawRole = localStorage.getItem('opsradar_user_role') || localStorage.getItem('role');
    rawUser = localStorage.getItem('user');
  }catch(e){}
  let userName = storedName || '김희진';
  if(!storedName && rawUser){
    try{
      const parsed = JSON.parse(rawUser);
      userName = parsed.name || parsed.username || parsed.email || rawUser;
    }catch(e){ userName = rawUser; }
  }
  const isMember = (rawRole || '').toLowerCase() === 'member' || document.getElementById('db-tab-member')?.classList.contains('active');
  return {
    userName,
    role: isMember ? 'Team Member' : 'Admin',
    roleKo: isMember ? '팀원' : '관리자',
    roleDescription: isMember ? 'Team Member' : 'PM · 팀장'
  };
}
function updateSidebarUserDisplay(){
  const info = getStoredUserInfo();
  const sidebarName = document.getElementById('sidebarUserName');
  const sidebarRole = document.getElementById('sidebarUserRole');
  const sidebarDescription = document.getElementById('sidebarUserDescription');
  const sidebarAvatar = document.getElementById('sidebarUserAvatar');
  if(sidebarName) sidebarName.textContent = info.userName;
  if(sidebarRole) sidebarRole.textContent = info.roleKo;
  if(sidebarDescription) sidebarDescription.textContent = info.roleDescription;
  if(sidebarAvatar) sidebarAvatar.textContent = (info.userName || 'U').trim().slice(0, 1).toUpperCase();
}
function updateSettingsPage(){
  const info = getStoredUserInfo();
  const userEl = document.getElementById('settingsUserName');
  const roleEl = document.getElementById('settingsUserRole');
  const stateEl = document.getElementById('settingsUserState');
  const statusEl = document.getElementById('settingsLoginStatus');
  const avatarEl = document.getElementById('settingsUserAvatar');
  const userMirror = document.getElementById('settingsUserNameMirror');
  const roleMirror = document.getElementById('settingsUserRoleMirror');
  const stateMirror = document.getElementById('settingsUserStateMirror');
  const displayRole = `${info.roleKo} · ${info.role}`;
  if(userEl) userEl.textContent = info.userName;
  if(roleEl) roleEl.textContent = displayRole;
  if(stateEl) stateEl.textContent = '로그인됨';
  if(statusEl) statusEl.textContent = '로그인됨';
  if(avatarEl) avatarEl.textContent = (info.userName || 'U').trim().slice(0, 1).toUpperCase();
  if(userMirror) userMirror.textContent = info.userName;
  if(roleMirror) roleMirror.textContent = info.role;
  if(stateMirror) stateMirror.textContent = 'Active';
  updateSidebarUserDisplay();
  let theme = 'dark';
  try{ theme = localStorage.getItem('theme') || localStorage.getItem('opsradar-skin') || document.body.dataset.theme || 'dark'; }catch(e){}
  setOpsRadarTheme(theme);
}
function logout(){
  if(typeof window.__workraderLogout === 'function'){
    window.__workraderLogout();
    return;
  }
  clearOpsRadarSession();
  document.body.classList.add('opsradar-login-required');
  window.location.reload();
}
window.setOpsRadarTheme = setOpsRadarTheme;
window.setOpsRadarSkin = setOpsRadarSkin;
window.updateSettingsPage = updateSettingsPage;
window.updateSidebarUserDisplay = updateSidebarUserDisplay;
window.clearOpsRadarSession = clearOpsRadarSession;
window.logout = logout;
window.getStoredUserInfo = getStoredUserInfo;
const ISSUE_DETAIL_MOCK = {
  'payment-api': {
    id:'payment-api', title:'결제 API 응답 지연', severity:'HIGH', status:'Blocked', elapsed:'48시간', assignee:'Backend',
    reason:'평균 응답시간 3.2초, 결제 완료율 하락, 고객 이탈 우려가 감지되었습니다.',
    dominoImpact:'API 지연 → 결제 실패 → 고객 문의 증가 → 고객 이탈 → 매출 영향',
    relatedTodos:['API 키 재발급 요청','DB 커넥션 풀 확인','백업 결제 경로 점검'],
    relatedDocs:['issue_log_20260514_azure_timeout.txt','payment_api_latency_report.csv'],
    actions:['대응 Todo 생성','담당자 지정','상태 변경']
  },
  'db-pool': {
    id:'db-pool', title:'DB 커넥션 풀 고갈', severity:'HIGH', status:'Monitoring', elapsed:'1일', assignee:'Infra',
    reason:'최대 연결 수에 근접한 상태가 반복되어 신규 요청 실패 가능성이 있습니다.',
    dominoImpact:'DB 연결 대기 → API timeout → 운영 로그 누락 → 장애 원인 추적 지연',
    relatedTodos:['커넥션 풀 임계치 조정','장기 실행 쿼리 확인','모니터링 알림 기준 재설정'],
    relatedDocs:['db_pool_metrics_202605.csv','ops_runbook_database.md'],
    actions:['대응 Todo 생성','담당자 지정','상태 변경']
  },
  'deploy-pipeline': {
    id:'deploy-pipeline', title:'배포 파이프라인 실패', severity:'HIGH', status:'Pending Fix', elapsed:'2일', assignee:'DevOps',
    reason:'최근 배포 실패가 반복되어 긴급 패치 반영과 QA 확인이 지연될 가능성이 있습니다.',
    dominoImpact:'배포 실패 → 패치 지연 → 장애 지속 → 인수인계 부담 증가',
    relatedTodos:['QA 자동화 로그 확인','롤백 경로 점검','배포 권한 및 secret 확인'],
    relatedDocs:['deploy_failure_202605.log','qa_pipeline_checklist.md'],
    actions:['대응 Todo 생성','담당자 지정','상태 변경']
  }
};
function getIssueDetailData(issueId){
  return ISSUE_DETAIL_MOCK[issueId] || ISSUE_DETAIL_MOCK['payment-api'];
}
function openIssueDetail(issueId){
  const data = getIssueDetailData(issueId);
  renderDashboardIssueDetail(data);
}
function closeIssueDetail(){
  const panel = document.getElementById('issueDetailPanel');
  if(panel) panel.classList.remove('show');
}
function renderDashboardIssueDetail(issueData){
  let panel = document.getElementById('issueDetailPanel');
  if(!panel){
    panel = document.createElement('div');
    panel.id = 'issueDetailPanel';
    panel.className = 'issue-detail-panel';
    document.body.appendChild(panel);
  }
  const todos = (issueData.relatedTodos || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const docs = (issueData.relatedDocs || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  panel.innerHTML = `
    <div class="issue-detail-backdrop" onclick="closeIssueDetail()"></div>
    <aside class="issue-detail-sheet" role="dialog" aria-modal="true" aria-label="이슈 상세 정보">
      <div class="issue-detail-head">
        <div>
          <div class="issue-detail-eyebrow">HIGH RISK DETAIL</div>
          <div class="issue-detail-title text-content">${escapeHtml(issueData.title)}</div>
        </div>
        <button class="issue-detail-close" onclick="closeIssueDetail()" aria-label="닫기"><i class="ti ti-x"></i></button>
      </div>
      <div class="issue-detail-body">
        <div class="issue-detail-meta">
          <div class="issue-detail-box"><span>심각도</span><strong><span class="badge b-danger issue-severity-high">${escapeHtml(issueData.severity)}</span></strong></div>
          <div class="issue-detail-box"><span>현재 상태</span><strong>${escapeHtml(issueData.status)}</strong></div>
          <div class="issue-detail-box"><span>발생/경과 시간</span><strong>${escapeHtml(issueData.elapsed)}</strong></div>
          <div class="issue-detail-box"><span>담당자</span><strong>${escapeHtml(issueData.assignee)}</strong></div>
        </div>
        <section class="issue-detail-section"><h4><i class="ti ti-brain"></i> AI 판단 근거</h4><p>${escapeHtml(issueData.reason)}</p></section>
        <section class="issue-detail-section"><h4><i class="ti ti-route"></i> 도미노 영향</h4><p>${escapeHtml(issueData.dominoImpact)}</p></section>
        <section class="issue-detail-section"><h4><i class="ti ti-checkbox"></i> 관련 Todo</h4><ul class="issue-detail-list">${todos || '<li>연결된 Todo가 없습니다.</li>'}</ul></section>
        <section class="issue-detail-section"><h4><i class="ti ti-file-text"></i> 관련 문서</h4><ul class="issue-detail-list">${docs || '<li>연결된 문서가 없습니다.</li>'}</ul></section>
      </div>
      <div class="issue-detail-actions">
        <div class="tbtn primary" onclick="createTodoFromIssue('${issueData.id}')"><i class="ti ti-plus"></i> 대응 Todo 생성</div>
        <div class="tbtn" onclick="assignIssueOwner('${issueData.id}')"><i class="ti ti-user-check"></i> 담당자 지정</div>
        <div class="tbtn" onclick="updateIssueStatus('${issueData.id}','in_progress')"><i class="ti ti-refresh"></i> 상태 변경</div>
      </div>
    </aside>`;
  requestAnimationFrame(() => panel.classList.add('show'));
}
function createTodoFromIssue(issueId){
  const issue = getIssueDetailData(issueId);
  G.createdTodosFromIssue = G.createdTodosFromIssue || [];
  G.createdTodosFromIssue.push({ id:'detail-todo-' + Date.now(), issueId, title:`${issue.title} 대응 Todo`, createdAt:new Date().toISOString() });
  showToast('대응 Todo가 생성되었습니다. Todo 화면에서 확인하세요.', 'success');
}
function assignIssueOwner(issueId){
  const issue = getIssueDetailData(issueId);
  showToast(`${issue.assignee} 담당자로 지정되었습니다.`, 'success');
}
function updateIssueStatus(issueId, status){
  const issue = getIssueDetailData(issueId);
  issue.status = status === 'in_progress' ? 'In Progress' : status;
  renderIssueDetail(issue);
  showToast('이슈 상태가 변경되었습니다.', 'success');
}
window.openIssueDetail = openIssueDetail;
window.closeIssueDetail = closeIssueDetail;
window.renderDashboardIssueDetail = renderDashboardIssueDetail;
window.createTodoFromIssue = createTodoFromIssue;
window.assignIssueOwner = assignIssueOwner;
window.updateIssueStatus = updateIssueStatus;
setTimeout(initOpsRadarSkin, 0);

(function initOpsRadarCleanVersion(){
  const CLEAN_EMPTY = '데이터 연결 후 표시됩니다.';
  function setText(selector, value){ const el = document.querySelector(selector); if(el) el.textContent = value; }
  function setAll(selector, value){ document.querySelectorAll(selector).forEach(el => el.textContent = value); }
  function clearDashboardRuntimeData(){
    setText('#pendingCount', '0');
    setText('#issueCount', '0');
    setText('#calBadge', '');
    const history = document.getElementById('historyList');
    if(history) history.innerHTML = '<div style="font-size:11px;color:var(--text3);padding:12px;text-align:center">업로드 이력이 없습니다.</div>';
    const riskSide = document.querySelector('#s-calendar .cal-side > div');
    if(riskSide) {
      riskSide.innerHTML = '<div style="font-size:11px;font-weight:500;color:var(--text);margin-bottom:10px;display:flex;align-items:center;gap:5px"><i class="ti ti-alert-triangle" style="font-size:13px;color:var(--text2)"></i> 리스크 구간</div><div style="font-size:11px;color:var(--text3);padding:10px 0;border-bottom:1px solid var(--border)">등록된 리스크 구간이 없습니다.</div><div style="font-size:11px;font-weight:500;color:var(--text);margin:14px 0 8px;display:flex;align-items:center;gap:5px"><i class="ti ti-user-off" style="font-size:13px;color:var(--text2)"></i> 부재 현황</div><div style="font-size:11px;color:var(--text3);padding:10px 0;border-bottom:1px solid var(--border)">등록된 부재 일정이 없습니다.</div><div style="font-size:11px;font-weight:500;color:var(--text);margin:14px 0 8px;display:flex;align-items:center;gap:5px"><i class="ti ti-flag" style="font-size:13px;color:var(--text2)"></i> 마일스톤</div><div style="font-size:11px;color:var(--text3);padding:10px 0">등록된 마일스톤이 없습니다.</div>';
    }
  }
  window.getHandoffPreviewData = function(type){
    const generatedAt = new Date().toLocaleString('ko-KR', { dateStyle:'medium', timeStyle:'short' });
    const labels = { onboarding:'신규 입사자 온보딩', absence:'부재자 업무 인수인계', offboard:'담당자 변경·퇴직 인수인계' };
    const selected = labels[type] ? type : (window.G && G.currentKnowledgeType) || 'onboarding';
    return {
      title: labels[selected] + ' 브리핑',
      target: labels[selected],
      sections: [
        ['현재 진행 업무', CLEAN_EMPTY],
        ['최근 주요 결정', CLEAN_EMPTY],
        ['반복 발생 이슈', CLEAN_EMPTY],
        ['미해결 Risk', CLEAN_EMPTY],
        ['다음 담당자 주의사항', CLEAN_EMPTY],
        ['관련 문서', '연결된 문서가 없습니다.'],
        ['생성일', generatedAt]
      ]
    };
  };
  window.getReportDraftData = function(){
    return {
      title:'운영 보고서 초안',
      sections:[
        ['완료된 업무', CLEAN_EMPTY],
        ['진행 중인 업무', CLEAN_EMPTY],
        ['AI 및 기술적 상세 내용', CLEAN_EMPTY],
        ['리스크 관리 및 해결 방안', CLEAN_EMPTY],
        ['팀 회고', CLEAN_EMPTY],
        ['차주 계획', CLEAN_EMPTY]
      ]
    };
  };
  setTimeout(function(){
    if(window.G){ G.calEvents = []; G.newCalEvents = []; G.analysisHistory = []; G.createdTodosFromIssue = []; }
    clearDashboardRuntimeData();
    if(typeof renderCalendar === 'function') renderCalendar();
    setAll('.ops-risk-card .badge', '대기');
  }, 0);
})();
