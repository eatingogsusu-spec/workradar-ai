(function () {
  window.OpsRadarFrontend?.registerModule('settings', {
    file: 'js/settings.js',
    screen: 'settings',
    owns: [
      'theme selection',
      'profile summary rendering',
      'logout/session cleanup flow',
    ],
    legacyGlobals: [
      'setOpsRadarTheme',
      'setOpsRadarSkin',
      'initOpsRadarSkin',
      'getStoredUserInfo',
      'updateSettingsPage',
      'logout',
    ],
  });
})();
