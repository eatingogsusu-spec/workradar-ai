(function () {
  window.OpsRadarFrontend?.registerModule('assistant', {
    file: 'js/assistant.js',
    screen: 'chat',
    owns: [
      'chat session list',
      'chat message rendering',
      'assistant context panel',
      'floating assistant button',
      'schedule extraction confirmation',
    ],
    legacyGlobals: [
      'createNewChatSession',
      'clearCurrentChatSession',
      'deleteChatSession',
      'renderChatSessionList',
      'sendMsg',
      'appendChatMsg',
      'toggleFloatAI',
      'floatAsk',
      'floatSend',
      'showScheduleConfirm',
      'doRegisterCalEvent',
    ],
  });
})();
