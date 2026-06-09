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
      'switchDbRole',
      'openIssueDetail',
      'closeIssueDetail',
      'createTodoFromIssue',
      'assignIssueOwner',
      'updateIssueStatus',
      'renderCurrentDateLabels',
    ],
  });
})();
