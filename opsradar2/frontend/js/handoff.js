(function () {
  window.OpsRadarFrontend?.registerModule('handoff', {
    file: 'js/handoff.js',
    screen: 'knowledge',
    owns: [
      'handoff type selection',
      'handoff flow rendering',
      'handoff preview panel',
      'handoff draft actions',
    ],
    legacyGlobals: [
      'selectKnowledgeType',
      'selectHandoffType',
      'renderKnowledgeFlow',
      'generateHandoffPreview',
      'openHandoffPreview',
      'closeHandoffPreview',
      'saveHandoffDraft',
      'editHandoffDraft',
      'shareHandoffDraft',
    ],
  });
})();
