(function () {
  window.OpsRadarFrontend?.registerModule('report', {
    file: 'js/report.js',
    screen: 'reports',
    owns: [
      'report list rendering',
      'report draft generation',
      'report editor actions',
      'report persistence fallback',
    ],
    legacyGlobals: [
      'fetchReports',
      'renderReportList',
      'selectReport',
      'setReportPeriod',
      'generateReportDraft',
      'renderReportDraft',
      'saveReport',
      'editReport',
      'shareReport',
      'formatReport',
      'initReportsScreen',
    ],
  });
})();
