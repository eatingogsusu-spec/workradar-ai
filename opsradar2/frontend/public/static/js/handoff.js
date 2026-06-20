// 인수인계센터 전용 화면 제어.
// 기존 Knowledge 화면 위에 프런트 데모를 구성하며, 백엔드 API/DB 계약은 변경하지 않는다.
(function () {
  if (window.__HANDOFF_REACT_ENABLED__) {
    const dispatch = (command, detail = {}) => {
      window.dispatchEvent(new CustomEvent('opsradar:handoff-command', {
        detail: { command, ...detail },
      }));
    };
    const normalizeMode = (type) => {
      if (type === 'onboarding') return 'onboarding';
      if (type === 'archive' || type === 'history') return 'archive';
      if (type === 'home' || !type) return 'home';
      return 'handoff';
    };

    window.initHandoffCenter = () => dispatch('open', { mode: 'home' });
    window.selectKnowledgeType = (type) => dispatch('open', { mode: normalizeMode(type) });
    window.selectHandoffType = window.selectKnowledgeType;
    window.renderKnowledgeFlow = window.selectKnowledgeType;
    window.openHandoffPreview = (type) => {
      const mode = normalizeMode(type) === 'onboarding' ? 'onboarding' : 'handoff';
      dispatch('preview', { mode });
      return window.__handoffReactState?.getPreviewData(mode) || null;
    };
    window.generateHandoffPreview = window.openHandoffPreview;
    window.getHandoffPreviewData = (type) => (
      window.__handoffReactState?.getPreviewData(type) || null
    );
    return;
  }

  const DEMO_SOURCE = {
    label: '데모 데이터',
    path: 'dummy_data/05_db_seed_v2 · expected_handover_sample.md',
    summary: '박서연 담당자의 고객 업무 이관 seed를 기준으로 화면 결과물을 구성합니다.',
  };

  const FLOWS = {
    offboard: {
      section: '퇴사자 인수인계',
      shortTitle: '퇴사자',
      icon: 'ti-logout',
      tone: 'b-warn',
      target: '퇴사자 · 전출자 · 업무 변경자',
      headline: 'AI가 업무 흔적을 읽고 인수인계서 초안을 먼저 만듭니다.',
      subline: '문서를 처음부터 쓰게 하지 않고, 보고서·Todo·고객 기록·메일·ZIP 자료에서 넘겨야 할 업무와 리스크를 먼저 정리합니다.',
      cta: 'AI로 인수인계서 만들기',
      homeResult: '업무 카드, 고객사 리스크, 팀장 확인 항목, 후임자 메모',
      homeMetrics: [
        ['자동 수집', '보고서·메일·일정·ZIP'],
        ['AI 판단', '진행 업무·반복 업무·누락 리스크'],
        ['최종 결과', '팀장 확인용 인수인계 초안'],
      ],
      centerStats: [
        ['자료 수집', '12건', '보고서 1 · Todo 5 · 고객 기록 3 · ZIP 3'],
        ['업무 후보', '8개', 'AI가 넘겨야 할 업무 카드를 구성'],
        ['리스크', '3건', '납기 지연·단가 협의·긴급 발주'],
        ['확인자', '2명', '팀장 승인 · 후임자 배정 대기'],
      ],
      pipeline: [
        ['자료 연결', '보고서, 메일, Todo, 이슈, 일정, ZIP 파일을 한 흐름으로 묶습니다.'],
        ['업무 추출', '반복 업무, 진행 중 업무, 고객사별 담당 범위를 카드로 나눕니다.'],
        ['리스크 판단', '미답변, 납기 지연, 고객 커뮤니케이션 주의사항을 표시합니다.'],
        ['초안 생성', '팀장이 바로 확인할 수 있는 인수인계서 초안과 후임자 메모를 만듭니다.'],
      ],
      mainDoc: {
        title: 'AI 인수인계서 초안',
        badge: '팀장 확인 전',
        rows: [
          ['이관 범위', 'Hyundai Mobis Tier2, Daesung Automotive 고객 업무와 긴급 납품 대응을 이관합니다.'],
          ['핵심 리스크', 'AP-TM-118, AP-WH-220 납기 리스크와 AP-CN-204 긴급 발주 대응이 남아 있습니다.'],
          ['미완료 Todo', '고객별 미완료 Todo 현황과 TE 단가 인상 적용 시점 확인이 필요합니다.'],
          ['후임자 메모', '고객 안내 문구는 단가 협상과 납기 대응 톤을 일관되게 유지해야 합니다.'],
        ],
      },
      lanes: [
        {
          icon: 'ti-briefcase',
          title: '업무 카드',
          items: [
            ['긴급 발주 대응', 'Daesung Automotive · 우선순위 높음'],
            ['납기 리스크 관리', 'Hyundai Mobis Tier2 · 반복 발생'],
            ['단가 인상 협의', 'TE Connectivity Korea · 적용 시점 확인'],
          ],
        },
        {
          icon: 'ti-alert-triangle',
          title: '고객사 리스크',
          items: [
            ['Hyundai Mobis Tier2', '긴급 항공 이송 승인 이력 있음'],
            ['Daesung Automotive', '긴급 발주와 단가 협상이 함께 연결됨'],
            ['KET Supplier', '재고 부족과 대체 출하 수량 확인 필요'],
          ],
        },
        {
          icon: 'ti-user-check',
          title: '팀장 확인 큐',
          items: [
            ['누락 업무 확인', 'AI 확신 낮은 업무만 최종 확인'],
            ['후임자 배정', '고객별 담당자와 사수 연결'],
            ['보완 요청', '위험 고객사와 마감 업무 승인'],
          ],
        },
      ],
      checklistTitle: '팀장이 마지막으로 확인할 것',
      checklist: ['AI가 놓친 업무가 없는지 확인', '고객사 리스크 표현이 맞는지 확인', '후임자와 사수 배정이 맞는지 확인'],
      queueTitle: '인수인계 처리 현황',
      queue: [
        ['접수', '퇴사 예정자 자료 수집 완료'],
        ['AI 분석', '업무 후보와 리스크 자동 추출 완료'],
        ['사람 확인', '팀장 승인과 후임자 배정 대기'],
      ],
      previewTitle: '업무 이관 초안',
    },
    onboarding: {
      section: '신규입사자 가이드',
      shortTitle: '신규입사자',
      icon: 'ti-user-plus',
      tone: 'b-accent',
      target: '신규입사자 · 내부 이동자 · 후임 담당자',
      headline: 'AI가 인수인계서를 첫날·첫주·첫달 적응 순서로 바꿉니다.',
      subline: '후임자가 긴 문서를 뒤지는 대신, 오늘 봐야 할 것과 이번 주에 직접 해볼 일을 순서대로 받습니다.',
      cta: 'AI로 적응 가이드 만들기',
      homeResult: '3분 요약, 첫날 체크리스트, 첫주 실습, 사수 교육 일정',
      homeMetrics: [
        ['입력 자료', '인수인계서·고객 맥락·미완료 Todo'],
        ['AI 재구성', '첫날·첫주·첫달 적응 순서'],
        ['최종 결과', '후임자 온보딩 가이드'],
      ],
      centerStats: [
        ['기준 문서', '1건', '퇴사자 인수인계 초안 기반'],
        ['고객 맥락', '2곳', 'Hyundai Mobis Tier2 · Daesung Automotive'],
        ['학습 단계', '3단계', '첫날 · 첫주 · 첫달'],
        ['교육 일정', '4개', '사수 동행 · 고객 응대 · 리스크 리뷰'],
      ],
      pipeline: [
        ['인수 자료 읽기', '고객 리스트, 미완료 Todo, 업무 맥락, 주의사항을 읽습니다.'],
        ['난이도 분리', '첫날 이해, 첫주 실습, 첫달 독립 처리 업무로 나눕니다.'],
        ['교육 설계', '사수 동행 업무와 질문 채널, 점검 일정을 제안합니다.'],
        ['가이드 생성', '3분 요약, 체크리스트, 교육 일정, 질문 목록을 만듭니다.'],
      ],
      mainDoc: {
        title: 'AI 신규입사자 적응 가이드',
        badge: '첫달 플랜',
        rows: [
          ['3분 요약', '이 업무는 고객 납기와 단가 협상 리스크를 연결해서 보는 운영 업무입니다.'],
          ['첫날', '자료 위치, 고객별 주의사항, 사수 질문 채널을 확인합니다.'],
          ['첫주', '긴급 발주 대응 1건과 납기 리스크 카드 1건을 사수와 함께 처리합니다.'],
          ['첫달', '고객 안내 문구 작성과 미완료 Todo 업데이트를 독립 처리합니다.'],
        ],
      },
      lanes: [
        {
          icon: 'ti-clock-hour-3',
          title: '첫날',
          items: [
            ['업무 3분 요약', '업무 목적과 고객 맥락 이해'],
            ['자료 위치 확인', '메일, 문서, Todo, 이슈 링크'],
            ['사수 연결', '질문 채널과 첫 동행 일정 확인'],
          ],
        },
        {
          icon: 'ti-calendar-week',
          title: '첫주',
          items: [
            ['업무 실습', '긴급 발주 대응 1건 같이 처리'],
            ['리스크 읽기', '납기 지연 알림 판단 기준 확인'],
            ['고객 톤 익히기', '단가 협상 안내 문구 검토'],
          ],
        },
        {
          icon: 'ti-calendar-month',
          title: '첫달',
          items: [
            ['독립 처리', '미완료 Todo를 날짜별 업데이트'],
            ['관리 리뷰', '위험 업무 판단 정확도 확인'],
            ['다음 범위', '추가 고객사 업무 인수 결정'],
          ],
        },
      ],
      checklistTitle: '사수와 팀장이 확인할 것',
      checklist: ['첫날에 볼 자료가 충분한지 확인', '사수 동행 업무가 현실적인지 확인', '독립 처리 기준이 명확한지 확인'],
      queueTitle: '온보딩 처리 현황',
      queue: [
        ['접수', '인수인계 초안 연결 완료'],
        ['AI 재구성', '첫날·첫주·첫달 가이드 생성'],
        ['교육 준비', '사수 교육 일정과 질문 목록 대기'],
      ],
      previewTitle: '후임자 적응 가이드',
    },
  };

  function esc(value) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(value);
    return String(value ?? '').replace(/[&<>"']/g, ch => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function flow(type) {
    return type === 'onboarding' ? FLOWS.onboarding : FLOWS.offboard;
  }

  function screen() {
    return document.getElementById('s-knowledge');
  }

  function ensureStyle() {
    if (document.getElementById('handoffCenterStyle')) return;
    const style = document.createElement('style');
    style.id = 'handoffCenterStyle';
    style.textContent = `
      #s-knowledge .topbar>div:last-child{display:none!important}
      #s-knowledge[data-handoff-view] #knowledgeContent{flex:1 1 auto!important;padding:16px!important;width:100%;max-width:100%!important;height:100%;min-height:0}
      .hf-home{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;width:100%;height:100%;min-height:0}
      .hf-home-card{position:relative;overflow:hidden;border:1px solid var(--border);background:linear-gradient(180deg,var(--surface) 0%,var(--surface2) 100%);border-radius:8px;padding:34px;text-align:left;color:var(--text);cursor:pointer;height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:28px}
      .hf-home-card:before{content:"";position:absolute;left:0;right:0;top:0;height:5px;background:var(--accent)}
      .hf-home-card:hover{border-color:var(--accent);box-shadow:0 18px 44px rgba(0,0,0,.16);transform:translateY(-1px)}
      .hf-home-top{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .hf-icon{width:64px;height:64px;border-radius:8px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0}
      .hf-home-card h2{font-size:44px;line-height:1.12;margin:26px 0 14px;color:var(--text);letter-spacing:0}
      .hf-home-card p{font-size:17px;line-height:1.68;color:var(--text2);margin:0;max-width:820px}
      .hf-result-box{margin-top:28px;border:1px solid var(--border2);background:var(--surface);border-radius:8px;padding:18px}
      .hf-result-box strong{display:flex;align-items:center;gap:8px;font-size:16px;color:var(--text);margin-bottom:10px}
      .hf-result-box span{display:block;font-size:14px;color:var(--text2);line-height:1.55}
      .hf-home-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .hf-home-metrics div{background:var(--surface);border:1px solid var(--border2);border-radius:8px;padding:14px;min-height:88px}
      .hf-home-metrics strong{display:block;font-size:14px;color:var(--text);margin-bottom:7px}
      .hf-home-metrics span{display:block;font-size:12px;color:var(--text3);line-height:1.45}
      .hf-enter{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--border);padding-top:20px;font-size:16px;font-weight:900;color:var(--accent)}
      .hf-detail{display:flex;flex-direction:column;gap:14px;width:100%;min-height:100%}
      .hf-hero{border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:22px;display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:18px;align-items:stretch}
      .hf-hero-main{display:flex;flex-direction:column;gap:16px;min-width:0}
      .hf-back{border:1px solid var(--border);background:var(--surface2);color:var(--text2);border-radius:8px;padding:9px 12px;font-size:13px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:6px;width:max-content}
      .hf-kicker{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900;color:var(--accent)}
      .hf-hero h2{font-size:34px;line-height:1.26;margin:0;color:var(--text);letter-spacing:0}
      .hf-hero p{font-size:15px;line-height:1.7;margin:0;color:var(--text2);max-width:940px}
      .hf-cta-row{display:flex;align-items:center;justify-content:flex-start;gap:12px;flex-wrap:wrap;padding:16px;border:1px solid var(--border2);background:var(--surface2);border-radius:8px}
      .hf-cta{border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;padding:17px 28px;font-size:16px;font-weight:900;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 12px 26px rgba(79,92,230,.18)}
      .hf-cta-note{font-size:12px;color:var(--text3);line-height:1.5}
      .hf-source-card{border:1px solid var(--border);background:var(--surface2);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:12px}
      .hf-source-title{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .hf-source-title strong{font-size:15px;color:var(--text)}
      .hf-source-title span{font-size:10px;color:var(--text3);font-family:var(--mono);text-align:right}
      .hf-source-card p{font-size:12px;line-height:1.55;color:var(--text3);margin:0}
      .hf-center-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .hf-stat{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;min-height:96px}
      .hf-stat small{display:block;font-size:11px;font-weight:900;color:var(--accent);margin-bottom:8px}
      .hf-stat strong{display:block;font-size:22px;color:var(--text);margin-bottom:6px;letter-spacing:0}
      .hf-stat span{display:block;font-size:12px;color:var(--text3);line-height:1.45}
      .hf-pipeline{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .hf-pipe{position:relative;border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:14px;min-height:112px}
      .hf-pipe b{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-size:11px;margin-bottom:10px}
      .hf-pipe strong{display:block;font-size:14px;color:var(--text);margin-bottom:6px}
      .hf-pipe span{display:block;font-size:11px;color:var(--text3);line-height:1.45}
      .hf-grid{display:grid;grid-template-columns:minmax(0,1fr) 410px;gap:14px;align-items:start}
      .hf-panel{border:1px solid var(--border);background:var(--surface);border-radius:8px;padding:18px}
      .hf-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .hf-panel h3{font-size:18px;margin:0;color:var(--text);letter-spacing:0}
      .hf-status{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border2);background:var(--surface2);border-radius:999px;padding:8px 10px;font-size:11px;font-weight:900;color:var(--text2);white-space:nowrap}
      .hf-status i{color:var(--accent)}
      .hf-output-doc{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .hf-doc-row{border:1px solid var(--border);background:var(--surface2);border-radius:8px;padding:13px;min-height:104px}
      .hf-doc-row strong{display:block;font-size:12px;color:var(--accent);margin-bottom:6px}
      .hf-doc-row span{display:block;font-size:13px;color:var(--text);line-height:1.58}
      .hf-queue{display:flex;flex-direction:column;gap:10px}
      .hf-queue-item{display:grid;grid-template-columns:78px minmax(0,1fr);gap:10px;align-items:start;border:1px solid var(--border);background:var(--surface2);border-radius:8px;padding:12px}
      .hf-queue-item strong{font-size:12px;color:var(--accent)}
      .hf-queue-item span{font-size:13px;color:var(--text);line-height:1.5}
      .hf-lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .hf-lane{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:13px;min-height:230px}
      .hf-lane-title{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:900;color:var(--text);margin-bottom:12px}
      .hf-lane-title i{font-size:18px;color:var(--accent)}
      .hf-lane-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:11px;margin-bottom:9px}
      .hf-lane-item strong{display:block;font-size:12px;color:var(--text);margin-bottom:5px}
      .hf-lane-item span{display:block;font-size:11px;color:var(--text3);line-height:1.45}
      .hf-checks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .hf-check{display:flex;gap:9px;align-items:flex-start;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:11px;font-size:12px;color:var(--text2);line-height:1.45}
      .hf-check i{color:var(--success);font-size:16px;margin-top:1px}
      .hf-running .hf-status{border-color:var(--accent);background:var(--accent-soft);color:var(--accent)}
      .hf-running .hf-doc-row,.hf-running .hf-lane-item,.hf-running .hf-queue-item{border-color:var(--accent)}
      @media(max-width:1320px){.hf-hero,.hf-grid{grid-template-columns:1fr}.hf-center-strip,.hf-pipeline{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:960px){.hf-home,.hf-home-metrics,.hf-center-strip,.hf-pipeline,.hf-grid,.hf-output-doc,.hf-lanes,.hf-checks{grid-template-columns:1fr}.hf-home{height:auto}.hf-home-card{min-height:420px}.hf-home-card h2{font-size:32px}.hf-hero h2{font-size:26px}}
    `;
    document.head.appendChild(style);
  }

  function metric(label, value) {
    return `<div><strong>${esc(label)}</strong><span>${esc(value)}</span></div>`;
  }

  function renderHomeCard(type) {
    const data = flow(type);
    return `
      <button type="button" class="hf-home-card" onclick="selectKnowledgeType('${type}')">
        <div>
          <div class="hf-home-top">
            <span class="badge ${data.tone}">${esc(data.target)}</span>
            <div class="hf-icon"><i class="ti ${data.icon}"></i></div>
          </div>
          <h2>${esc(data.section)}</h2>
          <p>${esc(data.subline)}</p>
          <div class="hf-result-box">
            <strong><i class="ti ti-sparkles"></i> AI가 찾는 결과물</strong>
            <span>${esc(data.homeResult)}</span>
          </div>
          <div class="hf-home-metrics">
            ${data.homeMetrics.map(row => metric(row[0], row[1])).join('')}
          </div>
        </div>
        <div class="hf-enter"><span>${esc(data.section)} 시작</span><i class="ti ti-arrow-right"></i></div>
      </button>`;
  }

  function renderHandoffHome() {
    ensureStyle();
    const root = screen();
    const content = document.getElementById('knowledgeContent');
    const title = document.querySelector('#s-knowledge .topbar-title');
    if (root) root.dataset.handoffView = 'home';
    if (title) title.textContent = '인수인계센터';
    if (content) content.innerHTML = `<section class="hf-home">${renderHomeCard('offboard')}${renderHomeCard('onboarding')}</section>`;
  }

  function renderCenterStats(data) {
    return data.centerStats.map(row => `
      <div class="hf-stat">
        <small>${esc(row[0])}</small>
        <strong>${esc(row[1])}</strong>
        <span>${esc(row[2])}</span>
      </div>`).join('');
  }

  function renderPipeline(data) {
    return data.pipeline.map((row, index) => `
      <div class="hf-pipe">
        <b>${index + 1}</b>
        <strong>${esc(row[0])}</strong>
        <span>${esc(row[1])}</span>
      </div>`).join('');
  }

  function renderDocument(data) {
    return data.mainDoc.rows.map(row => `
      <div class="hf-doc-row">
        <strong>${esc(row[0])}</strong>
        <span>${esc(row[1])}</span>
      </div>`).join('');
  }

  function renderQueue(data) {
    return data.queue.map(row => `
      <div class="hf-queue-item">
        <strong>${esc(row[0])}</strong>
        <span>${esc(row[1])}</span>
      </div>`).join('');
  }

  function renderLanes(data) {
    return data.lanes.map(column => `
      <div class="hf-lane">
        <div class="hf-lane-title"><i class="ti ${column.icon}"></i>${esc(column.title)}</div>
        ${column.items.map(row => `<div class="hf-lane-item"><strong>${esc(row[0])}</strong><span>${esc(row[1])}</span></div>`).join('')}
      </div>`).join('');
  }

  function renderChecks(data) {
    return data.checklist.map(text => `<div class="hf-check"><i class="ti ti-circle-check"></i><span>${esc(text)}</span></div>`).join('');
  }

  function renderHandoffDetail(type) {
    ensureStyle();
    const selected = type === 'onboarding' ? 'onboarding' : 'offboard';
    const data = flow(selected);
    const root = screen();
    const content = document.getElementById('knowledgeContent');
    const title = document.querySelector('#s-knowledge .topbar-title');
    if (root) root.dataset.handoffView = selected;
    if (title) title.textContent = data.section;
    if (!content) return;

    content.innerHTML = `
      <section class="hf-detail" id="handoffDetailRoot" data-flow="${selected}">
        <div class="hf-hero">
          <div class="hf-hero-main">
            <button type="button" class="hf-back" onclick="selectKnowledgeType('home')"><i class="ti ti-arrow-left"></i> 처음으로</button>
            <div class="hf-kicker"><i class="ti ${data.icon}"></i>${esc(data.section)} · AI 처리 센터</div>
            <h2>${esc(data.headline)}</h2>
            <p>${esc(data.subline)}</p>
            <div class="hf-cta-row">
              <button type="button" class="hf-cta" onclick="runHandoffOneClick('${selected}')"><i class="ti ti-wand"></i>${esc(data.cta)}</button>
              <span class="hf-cta-note">한 번 누르면 AI 출력물 미리보기까지 이어지는 데모 흐름입니다.</span>
            </div>
          </div>
          <aside class="hf-source-card">
            <div class="hf-source-title">
              <strong>${esc(DEMO_SOURCE.label)}</strong>
              <span>${esc(DEMO_SOURCE.path)}</span>
            </div>
            <p>${esc(DEMO_SOURCE.summary)}</p>
            <div class="hf-queue">${renderQueue(data)}</div>
          </aside>
        </div>

        <div class="hf-center-strip">${renderCenterStats(data)}</div>
        <div class="hf-pipeline">${renderPipeline(data)}</div>

        <div class="hf-grid">
          <section class="hf-panel">
            <div class="hf-panel-head">
              <h3>${esc(data.mainDoc.title)}</h3>
              <span class="hf-status" id="handoffAutoStatus"><i class="ti ti-sparkles"></i>${esc(data.mainDoc.badge)}</span>
            </div>
            <div class="hf-output-doc">${renderDocument(data)}</div>
          </section>
          <section class="hf-panel">
            <div class="hf-panel-head">
              <h3>${esc(data.queueTitle)}</h3>
              <span class="hf-status"><i class="ti ti-activity"></i>센터 큐</span>
            </div>
            <div class="hf-queue">${renderQueue(data)}</div>
          </section>
        </div>

        <section class="hf-panel">
          <div class="hf-panel-head">
            <h3>AI 추출 보드</h3>
            <span class="hf-status"><i class="ti ti-database-search"></i>근거 연결</span>
          </div>
          <div class="hf-lanes">${renderLanes(data)}</div>
        </section>

        <section class="hf-panel">
          <div class="hf-panel-head">
            <h3>${esc(data.checklistTitle)}</h3>
            <span class="hf-status"><i class="ti ti-user-check"></i>사람 확인 구간</span>
          </div>
          <div class="hf-checks">${renderChecks(data)}</div>
        </section>
      </section>`;
  }

  function runHandoffOneClick(type) {
    const selected = type === 'onboarding' ? 'onboarding' : 'offboard';
    const root = document.getElementById('handoffDetailRoot');
    const status = document.getElementById('handoffAutoStatus');
    if (root) root.classList.add('hf-running');
    if (status) status.innerHTML = '<i class="ti ti-circle-check"></i>AI 생성 완료';
    if (typeof window.openHandoffPreview === 'function') {
      setTimeout(() => window.openHandoffPreview(selected), 160);
    }
  }

  function selectKnowledgeType(type) {
    if (type === 'home' || !type) {
      if (window.G) window.G.currentKnowledgeType = 'home';
      renderHandoffHome();
      return;
    }
    const selected = type === 'onboarding' ? 'onboarding' : 'offboard';
    if (window.G) window.G.currentKnowledgeType = selected;
    renderHandoffDetail(selected);
  }

  function getHandoffPreviewData(type) {
    const selected = type === 'onboarding' ? 'onboarding' : 'offboard';
    const data = flow(selected);
    const boardSummary = data.lanes.map(column => `${column.title}: ${column.items.map(row => row[0]).join(', ')}`).join('\n');
    return {
      title: data.previewTitle,
      target: data.section,
      sections: [
        ['데모 출처', `${DEMO_SOURCE.path}\n${DEMO_SOURCE.summary}`],
        ['AI 처리 단계', data.pipeline.map(row => `${row[0]}: ${row[1]}`).join('\n')],
        ['핵심 초안', data.mainDoc.rows.map(row => `${row[0]}: ${row[1]}`).join('\n')],
        ['센터 처리 현황', data.queue.map(row => `${row[0]}: ${row[1]}`).join('\n')],
        ['AI 추출 보드', boardSummary],
        ['사람 확인 항목', data.checklist.join('\n')],
        ['생성 시각', new Date().toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })],
      ],
    };
  }

  function patchKnowledgeNav() {
    const navItem = document.getElementById('nav-knowledge');
    if (navItem && navItem.dataset.handoffCenterWired !== 'true') {
      navItem.dataset.handoffCenterWired = 'true';
      navItem.onclick = function (event) {
        if (event) event.preventDefault();
        if (typeof window.nav === 'function') window.nav('knowledge');
        setTimeout(renderHandoffHome, 0);
        setTimeout(renderHandoffHome, 30);
        requestAnimationFrame(renderHandoffHome);
        return false;
      };
    }

    if (!window.__handoffCenterNavPatched && typeof window.nav === 'function') {
      const originalNav = window.nav;
      window.__handoffCenterNavPatched = true;
      window.nav = function patchedNav(destination) {
        originalNav(destination);
        if (destination === 'knowledge') {
          setTimeout(renderHandoffHome, 0);
          setTimeout(renderHandoffHome, 30);
          requestAnimationFrame(renderHandoffHome);
        }
      };
    }
  }

  function initHandoffCenter() {
    ensureStyle();
    patchKnowledgeNav();
    window.selectKnowledgeType = selectKnowledgeType;
    window.selectHandoffType = selectKnowledgeType;
    window.renderKnowledgeFlow = selectKnowledgeType;
    window.renderHandoffHome = renderHandoffHome;
    window.runHandoffOneClick = runHandoffOneClick;
    window.getHandoffPreviewData = getHandoffPreviewData;

    const active = screen()?.classList.contains('active');
    if (active || window.G?.currentScreen === 'knowledge') renderHandoffHome();
  }

  initHandoffCenter();
  setTimeout(initHandoffCenter, 0);
  setTimeout(initHandoffCenter, 250);
  window.addEventListener('DOMContentLoaded', initHandoffCenter, { once: true });
  window.addEventListener('load', initHandoffCenter, { once: true });
  window.initHandoffCenter = initHandoffCenter;
})();
