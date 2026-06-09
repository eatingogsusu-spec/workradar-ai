(function () {
  window.OpsRadarFrontend?.registerModule('issue', {
    file: 'js/issue.js',
    screen: 'issues',
    owns: [
      'issue list rendering',
      'issue detail rendering',
      'issue create modal',
      'issue approval and resolution workflow',
      'issue-to-todo handoff',
    ],
    legacyGlobals: [
      'renderIssues',
      'renderIssueDetail',
      'switchIssueTab',
      'openIssueCreateModal',
      'closeIssueCreateModal',
      'saveIssueCreate',
      'openConfirmIssue',
      'doConfirmIssue',
      'dismissIssue',
      'resolveIssue',
      'openTodoCreate',
      'confirmTodoCreate',
    ],
  });
})();
