(function () {
  window.OpsRadarFrontend?.registerModule('dashboard', {
    file: 'js/dashboard.js',
    screen: 'dashboard',
    owns: [
      'dashboard role switching',
      'risk summary cards',
      'dashboard issue detail panel',
      'current-date labels',
    ],
    legacyGlobals: [
      'openIssueDetail',
      'closeIssueDetail',
      'createTodoFromIssue',
      'assignIssueOwner',
      'updateIssueStatus',
      'renderCurrentDateLabels',
    ],
  });
})();

// Migrated from legacy app.js by scripts/import-legacy.mjs.
// Keep these globals until dashboard data/detail behavior is fully React-owned.
var ISSUE_DETAIL_MOCK = window.ISSUE_DETAIL_MOCK || {};
window.ISSUE_DETAIL_MOCK = ISSUE_DETAIL_MOCK;

function applyDashboard() { showToast('Dashboard에 반영되었습니다.'); setTimeout(()=>nav('dashboard'),1000); }

function fetchDashboard(){
  updateIssueDashboard();
}

function mapDashboardIssueToRisk(issue) {
  const issueId = `manual-${issue.id}`;
  ISSUE_DETAIL_MOCK[issueId] = {
    id: issueId,
    title: issue.title,
    severity: issue.severity.toUpperCase(),
    status: issue.status,
    elapsed: `${issue.days || 0}일`,
    assignee: issue.assignee || '미지정',
    reason: issue.desc || '수동 등록된 이슈입니다.',
    dominoImpact: issue.dominoFinal || '영향 분석 대기',
    relatedTodos: [issue.suggestTodo || `${issue.title} 대응 Todo`],
    relatedDocs: [issue.src || '수동 등록'],
    actions: ['대응 Todo 생성', '담당자 지정', '상태 변경'],
  };
  return {
    issueId,
    title: issue.title,
    description: issue.desc || '설명이 없습니다.',
    action: '대응 Todo 생성',
    badge: issue.severity === 'high' ? 'HIGH' : issue.severity.toUpperCase(),
    badgeClass: issue.severity === 'high' ? 'badge b-danger' : issue.severity === 'medium' ? 'badge b-warn' : 'badge b-gray',
    meta: [issue.status, `${issue.days || 0}일 경과`],
    domino: issue.dominoFinal || '영향 분석 대기',
  };
}

function getDashboardRiskSummaries() {
  const confirmed = issues.filter((issue) => issue.type === 'confirmed');
  return confirmed
    .filter((issue) => issue.severity === 'high' && issue.status !== 'resolved')
    .slice(0, 3)
    .map(mapDashboardIssueToRisk);
}

function updateIssueDashboard() {
  const risks = getDashboardRiskSummaries();
  const issueCount = document.getElementById('issueCount');
  if (issueCount) issueCount.textContent = String(risks.length);
  window.dispatchEvent(new CustomEvent('opsradar:dashboard-risks-updated', { detail: { risks } }));
  return risks;
}

window.applyDashboard = applyDashboard;
window.fetchDashboard = fetchDashboard;
window.updateIssueDashboard = updateIssueDashboard;
window.getDashboardRiskSummaries = getDashboardRiskSummaries;
window.getDashboardIssueDetailData = function getDashboardIssueDetailData(issueId) {
  return getIssueDetailData(issueId);
};
window.openIssueDetail = function openIssueDetail(issueId) {
  window.dispatchEvent(new CustomEvent('opsradar:dashboard-issue-detail', { detail: { issueId } }));
};
window.closeIssueDetail = function closeIssueDetail() {
  window.dispatchEvent(new CustomEvent('opsradar:dashboard-issue-detail-close'));
};
window.renderDashboardIssueDetail = function renderDashboardIssueDetail(issueData) {
  window.dispatchEvent(new CustomEvent('opsradar:dashboard-issue-detail-data', { detail: { issueData } }));
};
setTimeout(async () => { await fetchIssues(); window.renderIssues?.(); fetchDashboard(); }, 0);
